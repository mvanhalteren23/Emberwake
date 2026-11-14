import { describe, expect, it } from 'vitest';
import { assetRequests, buildAssetManifest } from './index';

const ALLOWED_KEYS = new Set([
  'asset_id',
  'type',
  'target_path',
  'resolution',
  'grid',
  'fps',
  'loop',
  'alpha_channel',
  'prompt_spec',
  'status',
  'category',
  'animation_states',
]);

const COMMERCIAL_DENYLIST =
  /breath of fire|capcom|square ?enix|octopath|nintendo|zelda|final fantasy|pok[eé]mon|studio ghibli|ghibli|chrono|dragon quest|toriyama/i;

describe('Phase 3 asset manifests', () => {
  it('defines > 20 unique entries matching the shared AssetManifestEntry schema', () => {
    expect(assetRequests.length).toBeGreaterThan(20);
    const seen = new Set<string>();
    for (const entry of assetRequests) {
      expect(seen.has(entry.asset_id)).toBe(false);
      seen.add(entry.asset_id);
      for (const key of Object.keys(entry)) {
        expect(ALLOWED_KEYS.has(key)).toBe(true);
      }
      expect(entry.target_path.startsWith('public/assets/generated/')).toBe(true);
      expect(/\.(png|webp)$/.test(entry.target_path)).toBe(true);
      expect(entry.resolution.width).toBeGreaterThan(0);
      expect(entry.resolution.height).toBeGreaterThan(0);
      if (entry.grid) {
        expect(entry.grid.columns * entry.grid.frame_width).toBe(entry.resolution.width);
        expect(entry.grid.rows * entry.grid.frame_height).toBe(entry.resolution.height);
      }
      expect(entry.prompt_spec.length).toBeGreaterThan(40);
      expect(COMMERCIAL_DENYLIST.test(entry.prompt_spec)).toBe(false);
    }
  });

  it('covers mounts, the four required hazards, and all QTE inputs', () => {
    const categories = new Set(assetRequests.map((entry) => entry.category));
    for (const requiredCategory of ['mount', 'hazard', 'qte'] as const) {
      expect(categories.has(requiredCategory)).toBe(true);
    }
    for (const hazard of ['steam', 'electrified', 'frozen', 'smoke']) {
      expect(assetRequests.some((a) => a.category === 'hazard' && a.asset_id.includes(hazard) && a.type === 'icon')).toBe(true);
      expect(assetRequests.some((a) => a.category === 'hazard' && a.asset_id.includes(hazard) && a.type === 'spritesheet')).toBe(true);
    }
    for (const dir of ['up', 'down', 'left', 'right', 'tap']) {
      expect(assetRequests.some((a) => a.category === 'qte' && a.asset_id.includes(dir))).toBe(true);
    }
  });

  it('builds a valid AssetManifest envelope', () => {
    const manifest = buildAssetManifest();
    expect(manifest.manifest_version).toBe('1.0');
    expect(manifest.project).toBe('emberwake');
    expect(manifest.assets).toHaveLength(assetRequests.length);
  });
});
