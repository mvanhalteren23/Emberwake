import os
import io
import json
import time
import logging
from pathlib import Path
from datetime import datetime, timezone

from PIL import Image
from rembg import remove
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [GEMINI-PIPELINE] %(levelname)s: %(message)s"
)

MANIFEST_PATH = Path("shared_pipeline/manifests/pending_assets.json")
COMPLETED_LOG_PATH = Path("shared_pipeline/manifests/completed_manifest.json")

# Global HD-2D style lock injected into every Claude asset request
HD2D_STYLE_LOCK = (
    "16-bit JRPG HD-2D remaster aesthetic, Emberwake and Octopath Traveler "
    "color palette, crisp pixel-art silhouettes, clean orthographic top-down 3/4 RPG "
    "perspective, isolated subject on a solid flat high-contrast magenta (#FF00FF) "
    "background for clean chroma extraction, zero background clutter, no drop shadows "
    "clipping frame borders."
)

class GeminiAssetOrchestrator:
    def __init__(self):
        # Automatically picks up GEMINI_API_KEY from environment
        self.client = genai.Client()
        self.image_model = "gemini-3.1-flash-image"

    def enrich_prompt(self, asset: dict) -> str:
        """Agent 1: Enriches Claude's raw prompt_spec with grid & aesthetic constraints."""
        base_prompt = asset.get("prompt_spec", "")
        grid = asset.get("grid", {"columns": 1, "rows": 1})
        cols, rows = grid.get("columns", 1), grid.get("rows", 1)
        total_frames = cols * rows

        grid_instruction = ""
        if total_frames > 1:
            grid_instruction = (
                f"Organized strictly as a uniform {cols}x{rows} sprite sheet grid "
                f"({total_frames} sequential animation frames total), evenly spaced, "
                f"consistent character/effect scale and pivot across all frames. "
            )

        return f"{base_prompt}. {grid_instruction}{HD2D_STYLE_LOCK}"

    def synthesize_image(self, enriched_prompt: str) -> Image.Image:
        """Agent 2: Calls Gemini 3.1 Flash Image to synthesize raw visual data."""
        logging.info(f"Synthesizing visual via {self.image_model}...")
        response = self.client.models.generate_content(
            model=self.image_model,
            contents=enriched_prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )

        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.data:
                return Image.open(io.BytesIO(part.inline_data.data)).convert("RGBA")

        raise RuntimeError("No image payload returned from Gemini API.")

    def post_process_and_pack(self, raw_img: Image.Image, asset: dict) -> Path:
        """Agent 3: Strips background, enforces exact pixel dimensions, and exports atlas JSON."""
        target_path = Path(asset["target_path"])
        target_path.parent.mkdir(parents=True, exist_ok=True)

        # 1. Strip solid background for RGBA transparency
        if asset.get("alpha_channel", True):
            logging.info(f"Applying alpha matting for {asset['asset_id']}...")
            processed_img = remove(raw_img)
        else:
            processed_img = raw_img

        # 2. Enforce exact target resolution using Nearest Neighbor to preserve pixel crispness
        res = asset.get("resolution", {"width": 512, "height": 512})
        target_w, target_h = res["width"], res["height"]
        if processed_img.size != (target_w, target_h):
            processed_img = processed_img.resize(
                (target_w, target_h), Image.Resampling.NEAREST
            )

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

    def validate_and_process_manifest(self):
        """Agent 4: Polls manifest, orchestrates generation, validates output, and updates status."""
        if not MANIFEST_PATH.exists():
            return

        try:
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except (json.JSONDecodeError, OSError):
            # File is currently being written by Claude Code; retry on next tick
            return

        assets = manifest.get("assets", [])
        pending = [a for a in assets if a.get("status") == "pending"]

        if not pending:
            return

        logging.info(f"Found {len(pending)} pending asset(s) in manifest.")
        modified = False

        for asset in assets:
            if asset.get("status") != "pending":
                continue

            asset_id = asset["asset_id"]
            try:
                logging.info(f"Processing [{asset_id}]...")
                prompt = self.enrich_prompt(asset)
                raw_img = self.synthesize_image(prompt)
                output_file = self.post_process_and_pack(raw_img, asset)

                # Verify output integrity
                if output_file.exists() and output_file.stat().st_size > 0:
                    asset["status"] = "completed"
                    asset["completed_at"] = datetime.now(timezone.utc).isoformat()
                    modified = True
                    logging.info(f"Successfully deployed [{asset_id}] -> {output_file}")
                    self._log_completed(asset)
            except Exception as e:
                logging.error(f"Failed processing [{asset_id}]: {e}")
                asset["status"] = "error"
                asset["error_msg"] = str(e)
                modified = True

        if modified:
            with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2)

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
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    orchestrator = GeminiAssetOrchestrator()

    # Run initial sweep in case Claude already emitted pending assets
    orchestrator.validate_and_process_manifest()

    observer = Observer()
    handler = ManifestWatchHandler(orchestrator)
    observer.schedule(handler, str(MANIFEST_PATH.parent), recursive=False)
    observer.start()

    logging.info(f"Watching {MANIFEST_PATH} for Claude Code asset requests...")
    try:
        while True:
            time.sleep(2)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
