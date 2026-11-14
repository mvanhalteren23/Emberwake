import type { AssetManifest, AssetManifestEntry } from '@/types/contracts';
import { characterAssetRequests } from './characters';
import { environmentAssetRequests } from './environment';
import { fxAssetRequests } from './fx';
import { hazardAssetRequests } from './hazards';
import { hudAssetRequests } from './hud';
import { mountAssetRequests } from './mounts';
import { qteAssetRequests } from './qte';

export { characterAssetRequests } from './characters';
export { environmentAssetRequests } from './environment';
export { fxAssetRequests } from './fx';
export { hazardAssetRequests } from './hazards';
export { hudAssetRequests } from './hud';
export { mountAssetRequests } from './mounts';
export { qteAssetRequests } from './qte';

/** Complete list of external Phase 3 visuals requested from the shared asset pipeline. */
export const assetRequests: readonly AssetManifestEntry[] = [
  ...mountAssetRequests,
  ...hazardAssetRequests,
  ...qteAssetRequests,
  ...fxAssetRequests,
  ...hudAssetRequests,
  ...characterAssetRequests,
  ...environmentAssetRequests,
];

/** Builds the serialized `AssetManifest` envelope expected in `shared_pipeline/manifests/pending_assets.json`. */
export function buildAssetManifest(entries: readonly AssetManifestEntry[] = assetRequests): AssetManifest {
  return {
    manifest_version: '1.0',
    project: 'emberwake',
    assets: entries,
  };
}
