import type { AssetId, AssetManifestEntry, AssetRecord } from '@/types/contracts';

export interface AssetDeliveredPayload {
  readonly assetId: AssetId;
  readonly targetPath: string;
  readonly url: string;
}

/** Converts a repo-relative `public/...` path into a root-relative public URL. */
export function targetPathToPublicUrl(targetPath: string): string {
  const trimmed = targetPath.replace(/^\/+/, '');
  return trimmed.startsWith('public/') ? `/${trimmed.slice('public/'.length)}` : `/${trimmed}`;
}

export class AssetRegistry {
  private readonly records = new Map<AssetId, AssetRecord>();
  private readonly listeners = new Set<(record: AssetRecord) => void>();

  constructor(entries: readonly AssetManifestEntry[] = []) {
    this.seed(entries);
  }

  /** Registers or refreshes manifest definitions while preserving delivered versions. */
  seed(entries: readonly AssetManifestEntry[]): void {
    for (const entry of entries) {
      const prev = this.records.get(entry.asset_id);
      const ready = entry.status === 'delivered' || (prev?.ready ?? false);
      const version = prev?.version ?? (ready ? 1 : 0);
      const baseUrl = targetPathToPublicUrl(entry.target_path);
      this.records.set(entry.asset_id, {
        assetId: entry.asset_id,
        entry,
        ready,
        url: ready ? `${baseUrl}?v=${version}` : null,
        version,
      });
    }
  }

  get(assetId: AssetId): AssetRecord {
    return (
      this.records.get(assetId) ?? {
        assetId,
        entry: null,
        ready: false,
        url: null,
        version: 0,
      }
    );
  }

  all(): readonly AssetRecord[] {
    return [...this.records.values()];
  }

  /** Marks an asset delivered and bumps its cache-busting version for live hot-swaps. */
  markDelivered(assetId: AssetId, targetPath?: string): AssetRecord {
    const prev = this.records.get(assetId);
    const entry = prev?.entry ?? null;
    const resolvedTarget = targetPath ?? entry?.target_path;
    const version = (prev?.version ?? 0) + 1;
    const url = resolvedTarget ? `${targetPathToPublicUrl(resolvedTarget)}?v=${version}` : null;
    const next: AssetRecord = {
      assetId,
      entry: entry ? { ...entry, status: 'delivered' } : null,
      ready: url !== null,
      url,
      version,
    };
    this.records.set(assetId, next);
    for (const listener of this.listeners) {
      listener(next);
    }
    return next;
  }

  subscribe(listener: (record: AssetRecord) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const assetRegistry = new AssetRegistry();

/** Wires Vite HMR custom events from `tools/asset-pipeline/vitePlugin.ts` to `assetRegistry`. */
export function attachAssetHmr(registry: AssetRegistry = assetRegistry): void {
  if (import.meta.hot) {
    import.meta.hot.on('emberwake:asset-delivered', (payload: AssetDeliveredPayload) => {
      registry.markDelivered(payload.assetId, payload.targetPath);
    });
  }
}
