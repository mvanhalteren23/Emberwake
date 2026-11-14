import fs from 'node:fs';
import path from 'node:path';
import type { AssetId, AssetManifest, AssetManifestEntry, AssetStatus } from '@/types/contracts';

const VALID_STATUSES = new Set<AssetStatus>(['pending', 'in_progress', 'delivered', 'rejected']);

export interface EmitOptions {
  readonly repoRoot: string;
  readonly pipelineDir?: string;
  readonly onlyIds?: readonly AssetId[];
  readonly reset?: boolean;
}

export interface ManifestCounts {
  readonly total: number;
  readonly pending: number;
  readonly in_progress: number;
  readonly delivered: number;
  readonly rejected: number;
}

export interface SyncResult {
  readonly manifest: AssetManifest;
  readonly delivered: readonly { readonly assetId: AssetId; readonly targetPath: string }[];
}

export function resolvePipelineDir(repoRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  const custom = env.EMBERWAKE_PIPELINE_DIR?.trim();
  return custom ? path.resolve(repoRoot, custom) : path.join(repoRoot, 'shared_pipeline');
}

export function manifestFilePath(pipelineDir: string): string {
  return path.join(pipelineDir, 'manifests', 'pending_assets.json');
}

export function outputDirPath(pipelineDir: string): string {
  return path.join(pipelineDir, 'output');
}

function isNonEmptyFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

export function readExistingStatuses(manifestPath: string): ReadonlyMap<AssetId, string> {
  const statuses = new Map<AssetId, string>();
  if (!fs.existsSync(manifestPath)) return statuses;
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { assets?: readonly { asset_id?: unknown; status?: unknown }[] };
    if (!Array.isArray(raw.assets)) return statuses;
    for (const entry of raw.assets) {
      if (typeof entry.asset_id === 'string' && typeof entry.status === 'string') {
        statuses.set(entry.asset_id, entry.status);
      }
    }
  } catch {
    // Ignore partially written or malformed manifest files.
  }
  return statuses;
}

function resolveStatus(entry: AssetManifestEntry, previous: string | undefined, repoRoot: string, reset: boolean): AssetStatus {
  if (reset) return 'pending';
  const targetAbs = path.resolve(repoRoot, entry.target_path);
  if (isNonEmptyFile(targetAbs)) return 'delivered';
  if (previous && VALID_STATUSES.has(previous as AssetStatus)) {
    return previous as AssetStatus;
  }
  return entry.status;
}

export function mergeManifest(
  entries: readonly AssetManifestEntry[],
  options: EmitOptions,
): { readonly manifest: AssetManifest; readonly counts: ManifestCounts; readonly manifestPath: string; readonly pipelineDir: string } {
  const pipelineDir = options.pipelineDir ?? resolvePipelineDir(options.repoRoot);
  const manifestPath = manifestFilePath(pipelineDir);

  let selected = entries;
  if (options.onlyIds && options.onlyIds.length > 0) {
    const requested = new Set(options.onlyIds);
    const available = new Set(entries.map((e) => e.asset_id));
    const unknown = options.onlyIds.filter((id) => !available.has(id));
    if (unknown.length > 0) {
      throw new Error(`Unknown asset_id(s): ${unknown.join(', ')}`);
    }
    selected = entries.filter((e) => requested.has(e.asset_id));
  }

  const prevStatuses = options.reset ? new Map<AssetId, string>() : readExistingStatuses(manifestPath);
  const counts = { total: 0, pending: 0, in_progress: 0, delivered: 0, rejected: 0 };

  const mergedAssets: AssetManifestEntry[] = selected.map((entry) => {
    const status = resolveStatus(entry, prevStatuses.get(entry.asset_id), options.repoRoot, Boolean(options.reset));
    counts.total += 1;
    counts[status] += 1;
    return { ...entry, status };
  });

  const manifest: AssetManifest = {
    manifest_version: '1.0',
    project: 'emberwake',
    assets: mergedAssets,
  };

  return { manifest, counts, manifestPath, pipelineDir };
}

/**
 * Copies rendered `<asset_id>.png` / `<asset_id>.webp` files from `shared_pipeline/output/`
 * into their `target_path` under `public/assets/generated/`, and marks delivered assets.
 */
export function syncOutputToTargets(manifest: AssetManifest, pipelineDir: string, repoRoot: string): SyncResult {
  const outDir = outputDirPath(pipelineDir);
  const delivered: { assetId: AssetId; targetPath: string }[] = [];

  const updatedAssets: AssetManifestEntry[] = manifest.assets.map((entry) => {
    const targetAbs = path.resolve(repoRoot, entry.target_path);
    const ext = path.extname(entry.target_path).toLowerCase();
    const candidates = [ext, '.png', '.webp'].filter((v, idx, arr) => v && arr.indexOf(v) === idx);

    for (const candidateExt of candidates) {
      const stagedPath = path.join(outDir, `${entry.asset_id}${candidateExt}`);
      if (isNonEmptyFile(stagedPath)) {
        fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
        fs.copyFileSync(stagedPath, targetAbs);

        const stagedAtlas = path.join(outDir, `${entry.asset_id}.json`);
        if (isNonEmptyFile(stagedAtlas)) {
          fs.copyFileSync(stagedAtlas, targetAbs.replace(/\.[^.]+$/, '.json'));
        }
        break;
      }
    }

    if (isNonEmptyFile(targetAbs)) {
      if (entry.status !== 'delivered') {
        delivered.push({ assetId: entry.asset_id, targetPath: entry.target_path });
      }
      return entry.status === 'delivered' ? entry : { ...entry, status: 'delivered' };
    }
    return entry;
  });

  return {
    manifest: { ...manifest, assets: updatedAssets },
    delivered,
  };
}

export function writeManifest(manifestPath: string, manifest: AssetManifest): void {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}
