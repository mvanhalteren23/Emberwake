import type { AssetManifestEntry } from '@/types/contracts';

/** Phase 3 mount sprite sheets and HUD badges (Ashen Wing & Cragstrider). */
export const mountAssetRequests: readonly AssetManifestEntry[] = [
  {
    asset_id: 'mount.ashen_drake.sheet',
    type: 'spritesheet',
    target_path: 'public/assets/generated/mounts/mount_ashen_drake_sheet.png',
    resolution: { width: 512, height: 512 },
    grid: { columns: 4, rows: 4, frame_width: 128, frame_height: 128 },
    fps: 10,
    loop: true,
    alpha_channel: true,
    category: 'mount',
    animation_states: [
      { name: 'idle', row: 0, from: 0, count: 4 },
      { name: 'glide', row: 1, from: 0, count: 4 },
      { name: 'dash', row: 2, from: 0, count: 4 },
      { name: 'soar', row: 3, from: 0, count: 4 },
    ],
    prompt_spec:
      'Winged ashen-scale sky drake mount with folded bronze saddle harness and ember-lit wing membranes, original 16-bit painterly pixel fantasy sprite sheet, four animation rows (hover idle, glide, gust dash, high soar)',
    status: 'pending',
  },
  {
    asset_id: 'mount.ashen_drake.icon',
    type: 'icon',
    target_path: 'public/assets/generated/ui/mount_ashen_drake_icon.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'mount',
    prompt_spec:
      'Ornate circular bronze and crimson crest icon featuring a winged ashen drake silhouette in profile with glowing amber eye, crisp 16-bit fantasy RPG HUD emblem',
    status: 'pending',
  },
  {
    asset_id: 'mount.cragstrider.sheet',
    type: 'spritesheet',
    target_path: 'public/assets/generated/mounts/mount_cragstrider_sheet.png',
    resolution: { width: 512, height: 512 },
    grid: { columns: 4, rows: 4, frame_width: 128, frame_height: 128 },
    fps: 10,
    loop: true,
    alpha_channel: true,
    category: 'mount',
    animation_states: [
      { name: 'idle', row: 0, from: 0, count: 4 },
      { name: 'trot', row: 1, from: 0, count: 4 },
      { name: 'sprint', row: 2, from: 0, count: 4 },
      { name: 'leap', row: 3, from: 0, count: 4 },
    ],
    prompt_spec:
      'Sturdy horned highland cragstrider beast mount wearing woven frontier blanket and leather bridle, original 16-bit painterly pixel fantasy sprite sheet, four animation rows (idle, trot, sprint, bound leap)',
    status: 'pending',
  },
  {
    asset_id: 'mount.cragstrider.icon',
    type: 'icon',
    target_path: 'public/assets/generated/ui/mount_cragstrider_icon.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'mount',
    prompt_spec:
      'Ornate round iron and moss-green HUD badge depicting a horned cragstrider mount head in crisp 16-bit fantasy RPG pixel illustration style',
    status: 'pending',
  },
];
