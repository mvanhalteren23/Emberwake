import type { AssetManifestEntry } from '@/types/contracts';

/** Phase 3 HUD badges for stamina, fast-travel waypoints, mount summon, and Sync gauge. */
export const hudAssetRequests: readonly AssetManifestEntry[] = [
  {
    asset_id: 'hud.stamina.crest',
    type: 'icon',
    target_path: 'public/assets/generated/ui/hud_stamina_crest.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'hud',
    prompt_spec:
      'Compact 16-bit fantasy RPG HUD medallion depicting a winged boot and wind ribbon in brushed brass and emerald enamel',
    status: 'pending',
  },
  {
    asset_id: 'hud.waypoint.beacon',
    type: 'icon',
    target_path: 'public/assets/generated/ui/hud_waypoint_beacon.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'hud',
    prompt_spec:
      'Ornamental frontier stone brazier beacon glowing with steady amber fire inside a brass compass bezel, crisp 16-bit fantasy RPG fast-travel map icon',
    status: 'pending',
  },
  {
    asset_id: 'hud.mount.call_horn',
    type: 'icon',
    target_path: 'public/assets/generated/ui/hud_mount_call_horn.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'hud',
    prompt_spec:
      'Carved bone and copper war-horn wrapped in leather cord on a circular slate-iron HUD badge, crisp 16-bit fantasy RPG action icon',
    status: 'pending',
  },
  {
    asset_id: 'hud.sync.emblem',
    type: 'icon',
    target_path: 'public/assets/generated/ui/hud_sync_emblem.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'hud',
    prompt_spec:
      'Twin intertwined flame-and-ash rings around an incandescent diamond core, crisp 16-bit fantasy RPG combat Sync meter emblem',
    status: 'pending',
  },
];
