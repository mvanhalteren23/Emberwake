import type { AssetManifestEntry } from '@/types/contracts';

/**
 * Environment billboard foliage cards, settlement architecture props, and
 * biome ground/material texture atlases generated via the shared HD-2D pipeline.
 */
export const environmentAssetRequests: readonly AssetManifestEntry[] = [
  {
    asset_id: 'env.foliage.frontier_cards',
    type: 'spritesheet',
    target_path: 'public/assets/generated/environment/env_foliage_frontier_cards.png',
    resolution: { width: 512, height: 128 },
    grid: { columns: 4, rows: 1, frame_width: 128, frame_height: 128 },
    fps: 1,
    loop: false,
    alpha_channel: true,
    prompt_spec:
      'HD-2D 32-bit pixel-art environment billboard prop sheet with 4 separate nature props in a single horizontal row (4 columns, 1 row): cell 1 is a lush Frontier oak tree with layered painterly pixel canopy and gnarled trunk; cell 2 is a tall Highland pine tree with deep emerald needles and rugged bark; cell 3 is a Bramblemeadow berry bush cluster with red berries and golden wildflowers at the base; cell 4 is a weathered Mirror Tarn mossy standing shrine stone carved with faint glowing amber runes. Crisp dark pixel sticker outlines around each prop for 2.5D diorama cards.',
    status: 'pending',
  },
  {
    asset_id: 'env.props.lanternwick_buildings',
    type: 'spritesheet',
    target_path: 'public/assets/generated/environment/env_props_lanternwick_buildings.png',
    resolution: { width: 512, height: 128 },
    grid: { columns: 4, rows: 1, frame_width: 128, frame_height: 128 },
    fps: 1,
    loop: false,
    alpha_channel: true,
    prompt_spec:
      'HD-2D 32-bit pixel-art fantasy town building and prop sheet with 4 separate architectural props in a single horizontal row (4 columns, 1 row): cell 1 is a cozy Lanternwick half-timber and plaster cottage with terracotta shingle roof and warm glowing window; cell 2 is a rustic wooden grain mill house with a timber waterwheel and grain sacks; cell 3 is a wrought-iron frontier street lantern post hanging a warm glowing amber glass lantern; cell 4 is a lively Saltmarket merchant stall with a striped crimson-and-cream cloth awning, crates, and barrels. Crisp dark pixel outlines and warm twilight lighting.',
    status: 'pending',
  },
  {
    asset_id: 'env.props.landmarks_sheet',
    type: 'spritesheet',
    target_path: 'public/assets/generated/environment/env_props_landmarks_sheet.png',
    resolution: { width: 512, height: 128 },
    grid: { columns: 4, rows: 1, frame_width: 128, frame_height: 128 },
    fps: 1,
    loop: false,
    alpha_channel: true,
    prompt_spec:
      'HD-2D 32-bit pixel-art fantasy world landmark prop sheet with 4 separate architectural props in a single horizontal row (4 columns, 1 row): cell 1 is a solemn Greyford Covenant stone chapel with arched stained-glass window and slate bell-gable; cell 2 is a weathered Saltmarket timber harbor dock section with mooring bollards, rope coils, and a wooden river barge; cell 3 is the Cinder Ring sandstone gladiator arena archway flanked by iron braziers burning with orange flame; cell 4 is a mossy cobblestone village well with a shingled roof pulley alongside a crackling frontier campfire. Crisp dark pixel outlines.',
    status: 'pending',
  },
  {
    asset_id: 'env.terrain.surface_atlas',
    type: 'texture',
    target_path: 'public/assets/generated/environment/env_terrain_surface_atlas.png',
    resolution: { width: 256, height: 256 },
    alpha_channel: false,
    prompt_spec:
      'HD-2D 32-bit pixel-art 2x2 material texture atlas divided into 4 equal square quadrants (top-left, top-right, bottom-left, bottom-right) filling the entire canvas edge-to-edge with no border: top-left quadrant is lush hand-pixelled frontier clover grass and sun-dappled moss; top-right quadrant is weathered town plaza cobblestones with earthy mortar; bottom-left quadrant is medieval half-timbered cream plaster and dark oak wood beams; bottom-right quadrant is warm rustic terracotta and thatch roof shingles. Rich pixel-art surface texture, warm grounded fantasy palette.',
    status: 'pending',
  },
  {
    asset_id: 'env.terrain.biomes_atlas',
    type: 'texture',
    target_path: 'public/assets/generated/environment/env_terrain_biomes_atlas.png',
    resolution: { width: 256, height: 256 },
    alpha_channel: false,
    prompt_spec:
      'HD-2D 32-bit pixel-art 2x2 biome ground texture atlas divided into 4 equal square quadrants (top-left, top-right, bottom-left, bottom-right) filling the entire canvas edge-to-edge with no border: top-left quadrant is warm packed frontier dirt road with small pebbles and wagon wheel ruts; top-right quadrant is Saltmarket golden coastal beach sand scattered with tiny seashells; bottom-left quadrant is Bramblemeadow forest floor covered in russet bracken ferns, fallen leaves, and deep moss; bottom-right quadrant is Greyford highland craggy slate bedrock with lichen patches. Rich pixel-art surface texture.',
    status: 'pending',
  },
];
