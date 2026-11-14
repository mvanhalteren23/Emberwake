import type { AssetManifestEntry } from '@/types/contracts';

/** Phase 3 elemental terrain hazard HUD icons and battlefield effect sheets. */
export const hazardAssetRequests: readonly AssetManifestEntry[] = [
  {
    asset_id: 'hazard.steam.icon',
    type: 'icon',
    target_path: 'public/assets/generated/ui/hazard_steam_icon.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'hazard',
    prompt_spec:
      'Compact 16-bit fantasy RPG status icon of swirling scalding white-cyan steam plumes rising from cracked ember stone inside a hammered brass rim',
    status: 'pending',
  },
  {
    asset_id: 'hazard.steam.fx',
    type: 'spritesheet',
    target_path: 'public/assets/generated/fx/hazard_steam_fx.png',
    resolution: { width: 512, height: 128 },
    grid: { columns: 4, rows: 1, frame_width: 128, frame_height: 128 },
    fps: 8,
    loop: true,
    alpha_channel: true,
    category: 'hazard',
    animation_states: [{ name: 'loop', row: 0, from: 0, count: 4 }],
    prompt_spec:
      'Billowing ground-level scalding steam veil with rising vapor wisps and warm orange thermal glow beneath, original 16-bit fantasy RPG combat field effect sprite sheet',
    status: 'pending',
  },
  {
    asset_id: 'hazard.electrified.icon',
    type: 'icon',
    target_path: 'public/assets/generated/ui/hazard_electrified_icon.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'hazard',
    prompt_spec:
      'Compact 16-bit fantasy RPG status icon showing crackling golden-cyan lightning arcs dancing across a shallow puddle inside a dark steel ring',
    status: 'pending',
  },
  {
    asset_id: 'hazard.electrified.fx',
    type: 'spritesheet',
    target_path: 'public/assets/generated/fx/hazard_electrified_fx.png',
    resolution: { width: 512, height: 128 },
    grid: { columns: 4, rows: 1, frame_width: 128, frame_height: 128 },
    fps: 12,
    loop: true,
    alpha_channel: true,
    category: 'hazard',
    animation_states: [{ name: 'loop', row: 0, from: 0, count: 4 }],
    prompt_spec:
      'Crackling electric puddle terrain hazard with branching cobalt and pale-gold sparks arcing across shallow water ripples, original 16-bit fantasy RPG battle FX sheet',
    status: 'pending',
  },
  {
    asset_id: 'hazard.frozen.icon',
    type: 'icon',
    target_path: 'public/assets/generated/ui/hazard_frozen_icon.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'hazard',
    prompt_spec:
      'Compact 16-bit fantasy RPG status icon showing jagged frost crystal shards emerging from pale glacier ice inside a silver-rimmed medallion',
    status: 'pending',
  },
  {
    asset_id: 'hazard.frozen.fx',
    type: 'spritesheet',
    target_path: 'public/assets/generated/fx/hazard_frozen_fx.png',
    resolution: { width: 512, height: 128 },
    grid: { columns: 4, rows: 1, frame_width: 128, frame_height: 128 },
    fps: 8,
    loop: true,
    alpha_channel: true,
    category: 'hazard',
    animation_states: [{ name: 'loop', row: 0, from: 0, count: 4 }],
    prompt_spec:
      'Crystalline rime-ice ground hazard with glinting frost spikes and drifting cold mist flecks along the floor plane, original 16-bit fantasy RPG battle FX sheet',
    status: 'pending',
  },
  {
    asset_id: 'hazard.smoke.icon',
    type: 'icon',
    target_path: 'public/assets/generated/ui/hazard_smoke_icon.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'hazard',
    prompt_spec:
      'Compact 16-bit fantasy RPG status icon of dense charcoal ash-smoke curls with glowing red cinder flecks inside a tarnished copper frame',
    status: 'pending',
  },
  {
    asset_id: 'hazard.smoke.fx',
    type: 'spritesheet',
    target_path: 'public/assets/generated/fx/hazard_smoke_fx.png',
    resolution: { width: 512, height: 128 },
    grid: { columns: 4, rows: 1, frame_width: 128, frame_height: 128 },
    fps: 8,
    loop: true,
    alpha_channel: true,
    category: 'hazard',
    animation_states: [{ name: 'loop', row: 0, from: 0, count: 4 }],
    prompt_spec:
      'Thick swirling soot and cinder smoke screen rolling low over the battleground with faint glowing ash embers, original 16-bit fantasy RPG battle FX sheet',
    status: 'pending',
  },
];
