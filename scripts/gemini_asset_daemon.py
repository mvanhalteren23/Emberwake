import os
import io
import json
import math
import time
import logging
import argparse
import threading
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
from PIL import Image
from rembg import new_session, remove
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [GEMINI-PIPELINE] %(levelname)s: %(message)s"
)

MANIFEST_PATH = Path("shared_pipeline/manifests/pending_assets.json")
COMPLETED_LOG_PATH = Path("shared_pipeline/manifests/completed_manifest.json")


def load_dotenv(env_path: Path) -> None:
    """Loads KEY=VALUE pairs from `.env` into `os.environ` if not already set."""
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        existing = os.environ.get(key, "").strip()
        if key and value and (not existing or existing == "your-gemini-api-key"):
            os.environ[key] = value


# Global HD-2D style lock injected into every Claude asset request
HD2D_STYLE_LOCK = (
    "16-bit JRPG HD-2D remaster aesthetic, Emberwake original warm ember-lit "
    "pixel diorama color palette, crisp pixel-art silhouettes, clean orthographic top-down 3/4 RPG "
    "perspective, isolated subject on a solid flat high-contrast magenta (#FF00FF) "
    "background for clean chroma extraction, zero background clutter, no drop shadows "
    "clipping frame borders."
)

class GeminiAssetOrchestrator:
    def __init__(self):
        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key or api_key == "your-gemini-api-key":
            raise SystemExit(
                "GEMINI_API_KEY is missing or still a placeholder. "
                "Add GEMINI_API_KEY=... to .env or run ./run-assets.sh."
            )
        self._lock = threading.Lock()
        self.client = genai.Client(api_key=api_key)
        self.image_model = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
        self._rembg_session = None

    def _get_rembg_session(self):
        if self._rembg_session is None:
            self._rembg_session = new_session()
        return self._rembg_session

    def verify_api_key(self) -> bool:
        """Verifies the configured Gemini API key with a lightweight read-only models lookup."""
        try:
            next(iter(self.client.models.list(config={"page_size": 1})), None)
            return True
        except genai_errors.APIError as exc:
            logging.error(f"Gemini API key check failed: {exc}")
            return False

    def enrich_prompt(self, asset: dict) -> str:
        """Agent 1: Enriches Claude's raw prompt_spec with grid & aesthetic constraints."""
        base_prompt = asset.get("prompt_spec", "")
        if not asset.get("alpha_channel", True):
            return (
                f"{base_prompt}. "
                "16-bit JRPG HD-2D remaster aesthetic, Emberwake original warm ember-lit "
                "pixel diorama color palette, crisp pixel-art surface details, full-bleed "
                "opaque texture filling the entire canvas edge-to-edge with no border."
            )

        grid = asset.get("grid", {"columns": 1, "rows": 1})
        cols, rows = grid.get("columns", 1), grid.get("rows", 1)
        total_frames = cols * rows

        grid_instruction = ""
        if total_frames > 1:
            row_desc = (
                f"ONE single horizontal row of {cols} sequential animation frames side-by-side (ONLY 1 row, never 2 rows)"
                if rows == 1
                else f"a uniform {cols}-column by {rows}-row grid ({total_frames} sequential animation frames total, ordered left-to-right top-to-bottom)"
            )
            grid_instruction = (
                f"Arranged strictly as {row_desc}, filling every grid cell evenly without crowding, "
                f"with NO grid lines, NO boxes, NO border frames, NO dividing lines, and NO labels between frames "
                f"(separate frames ONLY with pure flat seamless #FF00FF background space), "
                f"maintaining consistent subject scale and pivot across all frames. "
            )

        return f"{base_prompt}. {grid_instruction}{HD2D_STYLE_LOCK}"

    @staticmethod
    def _pick_aspect_ratio(asset: dict) -> str:
        """Selects the closest Gemini ImageConfig aspect ratio for the asset's target resolution."""
        res = asset.get("resolution", {"width": 512, "height": 512})
        w = max(1, int(res.get("width", 512)))
        h = max(1, int(res.get("height", 512)))
        target = w / h
        supported = (
            ("1:1", 1.0),
            ("2:3", 2 / 3),
            ("3:2", 3 / 2),
            ("3:4", 3 / 4),
            ("4:3", 4 / 3),
            ("9:16", 9 / 16),
            ("16:9", 16 / 9),
            ("21:9", 21 / 9),
        )
        return min(supported, key=lambda item: abs(math.log(target / item[1])))[0]

    def synthesize_image(self, enriched_prompt: str, asset: dict) -> Image.Image:
        """Agent 2: Calls Gemini 3.1 Flash Image to synthesize raw visual data."""
        aspect_ratio = self._pick_aspect_ratio(asset)
        retry_delays = (12, 24, 45, 60)
        for attempt in range(len(retry_delays) + 1):
            logging.info(f"Synthesizing visual via {self.image_model} (aspect_ratio={aspect_ratio})...")
            try:
                response = self.client.models.generate_content(
                    model=self.image_model,
                    contents=enriched_prompt,
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                        image_config=types.ImageConfig(aspect_ratio=aspect_ratio),
                    ),
                )
                break
            except genai_errors.APIError as exc:
                msg_lower = str(exc).lower()
                is_hard_cap = "monthly spending cap" in msg_lower or "project spend cap" in msg_lower
                if getattr(exc, "code", None) in (429, 503) and not is_hard_cap and attempt < len(retry_delays):
                    wait_s = retry_delays[attempt]
                    logging.warning(
                        f"Rate/capacity limit ({exc.code}) for [{asset['asset_id']}]; "
                        f"waiting {wait_s}s before retry {attempt + 1}/{len(retry_delays)}..."
                    )
                    time.sleep(wait_s)
                    continue
                raise

        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.data:
                raw = Image.open(io.BytesIO(part.inline_data.data)).convert("RGBA")
                logging.info(f"Received raw image {raw.size} for {asset['asset_id']}")
                return raw

        raise RuntimeError("No image payload returned from Gemini API.")

    def _strip_background(self, raw_img: Image.Image, asset: dict) -> Image.Image:
        """Removes chroma #FF00FF background cleanly, or falls back to per-cell rembg."""
        rgba = raw_img.convert("RGBA")
        arr = np.asarray(rgba, dtype=np.float32)
        h, w = arr.shape[:2]
        pad_y = min(max(4, h // 40), max(4, h // 4))
        pad_x = min(max(4, w // 40), max(4, w // 4))
        samples = np.concatenate(
            [
                arr[pad_y : pad_y + 8, pad_x : w - pad_x, :3].reshape(-1, 3),
                arr[h - pad_y - 8 : h - pad_y, pad_x : w - pad_x, :3].reshape(-1, 3),
                arr[pad_y : h - pad_y, pad_x : pad_x + 8, :3].reshape(-1, 3),
                arr[pad_y : h - pad_y, w - pad_x - 8 : w - pad_x, :3].reshape(-1, 3),
            ],
            axis=0,
        )
        bg = np.median(samples, axis=0)
        magenta_score = min(float(bg[0]), float(bg[2])) - float(bg[1])
        logging.info(f"[{asset['asset_id']}] border_bg={[round(float(c)) for c in bg]} magenta_score={magenta_score:.1f}")

        if magenta_score > 60.0:
            rgb = arr[:, :, :3]
            dist = np.linalg.norm(rgb - bg[None, None, :], axis=2)
            pixel_magenta = np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1]

            # Core flat magenta pixels become fully transparent; tight ramp feathers edges.
            alpha = np.clip((dist - 55.0) / 35.0, 0.0, 1.0)
            pure_bg = (dist < 55.0) | ((pixel_magenta > 95.0) & (dist < 105.0))
            alpha = np.where(pure_bg, 0.0, alpha)

            # Despill semi-transparent fringe pixels so magenta does not tint outlines.
            fringe = (alpha > 0.0) & (alpha < 1.0) & (pixel_magenta > 10.0)
            out = arr.copy()
            out[:, :, 0] = np.where(fringe, np.minimum(out[:, :, 0], out[:, :, 1] + 24.0), out[:, :, 0])
            out[:, :, 2] = np.where(fringe, np.minimum(out[:, :, 2], out[:, :, 1] + 24.0), out[:, :, 2])
            out[:, :, 3] = np.round(alpha * 255.0)
            return Image.fromarray(np.clip(out, 0.0, 255.0).astype(np.uint8))

        session = self._get_rembg_session()
        grid = asset.get("grid") or {}
        cols = int(grid.get("columns", 1))
        rows = int(grid.get("rows", 1))
        if cols * rows > 1:
            canvas = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
            for r in range(rows):
                for c in range(cols):
                    x0 = round(c * w / cols)
                    x1 = round((c + 1) * w / cols)
                    y0 = round(r * h / rows)
                    y1 = round((r + 1) * h / rows)
                    cell = remove(rgba.crop((x0, y0, x1, y1)), session=session)
                    canvas.paste(cell, (x0, y0))
            return canvas

        return remove(rgba, session=session)

    @staticmethod
    def _polish_alpha_sheet(img: Image.Image, asset: dict) -> Image.Image:
        """Removes residual interior magenta pixels and thin cell-boundary divider lines."""
        arr = np.asarray(img.convert("RGBA"), dtype=np.float32).copy()
        rgb = arr[:, :, :3]
        alpha = arr[:, :, 3]

        mag = np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1]
        is_magenta = (mag > 48.0) & (rgb[:, :, 0] > 110.0) & (rgb[:, :, 2] > 110.0)
        alpha = np.where(is_magenta, 0.0, alpha)

        fringe = (alpha > 0.0) & (mag > 22.0) & (rgb[:, :, 0] > 90.0) & (rgb[:, :, 2] > 90.0)
        arr[:, :, 0] = np.where(fringe, np.minimum(arr[:, :, 0], arr[:, :, 1] + 20.0), arr[:, :, 0])
        arr[:, :, 2] = np.where(fringe, np.minimum(arr[:, :, 2], arr[:, :, 1] + 20.0), arr[:, :, 2])

        grid = asset.get("grid")
        if grid:
            cols = int(grid.get("columns", 1))
            rows = int(grid.get("rows", 1))
            fw = int(grid.get("frame_width", img.width))
            fh = int(grid.get("frame_height", img.height))
            for c in range(1, cols):
                x = c * fw
                for dx in (-1, 0, 1):
                    xi = x + dx
                    if 0 <= xi < arr.shape[1] and np.mean(alpha[:, xi] > 128) > 0.50:
                        alpha[:, xi] = 0.0
            for r in range(1, rows):
                y = r * fh
                for dy in (-1, 0, 1):
                    yi = y + dy
                    if 0 <= yi < arr.shape[0] and np.mean(alpha[yi, :] > 128) > 0.50:
                        alpha[yi, :] = 0.0

        arr[:, :, 3] = alpha
        return Image.fromarray(np.clip(arr, 0.0, 255.0).astype(np.uint8))

    def post_process_and_pack(self, raw_img: Image.Image, asset: dict) -> Path:
        """Agent 3: Strips background, enforces exact pixel dimensions, and exports atlas JSON."""
        target_path = Path(asset["target_path"])
        target_path.parent.mkdir(parents=True, exist_ok=True)

        # 1. Strip solid background for RGBA transparency
        if asset.get("alpha_channel", True):
            logging.info(f"Applying background extraction for {asset['asset_id']}...")
            processed_img = self._strip_background(raw_img, asset)
        else:
            processed_img = raw_img

        # 2. Enforce exact target resolution using Nearest Neighbor to preserve pixel crispness
        res = asset.get("resolution", {"width": 512, "height": 512})
        target_w, target_h = res["width"], res["height"]
        if processed_img.size != (target_w, target_h):
            processed_img = processed_img.resize(
                (target_w, target_h), Image.Resampling.NEAREST
            )

        # 2b. Clean residual interior magenta pixels and thin cell-divider lines
        if asset.get("alpha_channel", True):
            processed_img = self._polish_alpha_sheet(processed_img, asset)

        # 3. Save optimized WebP/PNG asset
        ext = target_path.suffix.lower()
        if ext == ".webp":
            processed_img.save(target_path, "WEBP", lossless=True, quality=100)
        else:
            processed_img.save(target_path, "PNG")

        # 4. Generate companion sprite sheet JSON metadata for engine consumption
        if asset.get("type") == "spritesheet" and "grid" in asset:
            self._write_atlas_metadata(target_path, asset)

        return target_path

    def _write_atlas_metadata(self, image_path: Path, asset: dict):
        """Writes TexturePacker / PixiJS / Three.js compatible frame coordinate data."""
        grid = asset["grid"]
        cols, rows = grid["columns"], grid["rows"]
        fw, fh = grid["frame_width"], grid["frame_height"]

        frames = {}
        frame_idx = 0
        for r in range(rows):
            for c in range(cols):
                frame_name = f"{asset['asset_id']}_{frame_idx:02d}"
                frames[frame_name] = {
                    "frame": {"x": c * fw, "y": r * fh, "w": fw, "h": fh},
                    "rotated": False,
                    "trimmed": False,
                    "spriteSourceSize": {"x": 0, "y": 0, "w": fw, "h": fh},
                    "sourceSize": {"w": fw, "h": fh}
                }
                frame_idx += 1

        atlas_data = {
            "frames": frames,
            "meta": {
                "app": "gemini-antigravity-pipeline",
                "image": image_path.name,
                "format": "RGBA8888",
                "size": asset["resolution"],
                "scale": "1",
                "fps": asset.get("fps", 12),
                "loop": asset.get("loop", True)
            }
        }

        atlas_json_path = image_path.with_suffix(".json")
        with open(atlas_json_path, "w", encoding="utf-8") as f:
            json.dump(atlas_data, f, indent=2)

    def _save_manifest(self, manifest: dict) -> None:
        with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

    def validate_and_process_manifest(self) -> tuple[int, int]:
        """Agent 4: Polls manifest, orchestrates generation, validates output, and updates status."""
        if not MANIFEST_PATH.exists():
            return (0, 0)

        with self._lock:
            try:
                with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                    manifest = json.load(f)
            except (json.JSONDecodeError, OSError):
                # File is currently being written; retry on next event
                return (0, 0)

            assets = manifest.get("assets", [])
            pending = [a for a in assets if a.get("status") == "pending"]

            if not pending:
                return (0, 0)

            logging.info(f"Found {len(pending)} pending asset(s) in manifest.")
            delivered_count = 0
            failed_count = 0
            processed_idx = 0

            for asset in assets:
                if asset.get("status") != "pending":
                    continue

                if processed_idx > 0:
                    time.sleep(5)
                processed_idx += 1

                asset_id = asset["asset_id"]
                try:
                    logging.info(f"Processing [{asset_id}]...")
                    prompt = self.enrich_prompt(asset)
                    raw_img = self.synthesize_image(prompt, asset)
                    output_file = self.post_process_and_pack(raw_img, asset)

                    # Verify output integrity
                    if output_file.exists() and output_file.stat().st_size > 0:
                        asset["status"] = "delivered"
                        asset["completed_at"] = datetime.now(timezone.utc).isoformat()
                        asset.pop("error_msg", None)
                        delivered_count += 1
                        logging.info(f"Successfully deployed [{asset_id}] -> {output_file}")
                        self._log_completed(asset)
                        self._save_manifest(manifest)
                    else:
                        raise RuntimeError(f"Output file missing or empty: {output_file}")
                except Exception as e:
                    logging.error(f"Failed processing [{asset_id}]: {e}")
                    asset["status"] = "error"
                    asset["error_msg"] = str(e)
                    failed_count += 1
                    self._save_manifest(manifest)
                    if isinstance(e, genai_errors.APIError) and getattr(e, "code", None) == 429:
                        logging.error("Persistent 429 quota/rate limit after retries; pausing batch so remaining items stay pending.")
                        break

            return (delivered_count, failed_count)

    def _log_completed(self, asset: dict):
        COMPLETED_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        history = []
        if COMPLETED_LOG_PATH.exists():
            try:
                with open(COMPLETED_LOG_PATH, "r", encoding="utf-8") as f:
                    history = json.load(f)
            except Exception:
                history = []
        history.append(asset)
        with open(COMPLETED_LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)


class ManifestWatchHandler(FileSystemEventHandler):
    def __init__(self, orchestrator: GeminiAssetOrchestrator):
        self.orchestrator = orchestrator

    def on_modified(self, event):
        if not event.is_directory and Path(event.src_path).name == "pending_assets.json":
            self.orchestrator.validate_and_process_manifest()

    def on_created(self, event):
        if not event.is_directory and Path(event.src_path).name == "pending_assets.json":
            self.orchestrator.validate_and_process_manifest()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Emberwake Gemini asset generation daemon")
    parser.add_argument("--once", action="store_true", help="Process all currently pending assets and exit")
    parser.add_argument("--check-key", action="store_true", help="Verify GEMINI_API_KEY with Gemini API and exit")
    args = parser.parse_args()

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    orchestrator = GeminiAssetOrchestrator()

    if args.check_key:
        raise SystemExit(0 if orchestrator.verify_api_key() else 2)

    delivered, failed = orchestrator.validate_and_process_manifest()

    if args.once:
        logging.info(f"Batch complete: {delivered} delivered, {failed} failed.")
        raise SystemExit(1 if failed > 0 else 0)

    observer = Observer()
    handler = ManifestWatchHandler(orchestrator)
    observer.schedule(handler, str(MANIFEST_PATH.parent), recursive=False)
    observer.start()

    logging.info(f"Watching {MANIFEST_PATH} for Emberwake asset requests...")
    try:
        while True:
            time.sleep(2)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
