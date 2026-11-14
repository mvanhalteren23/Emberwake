import type { AssetManifestEntry } from '@/types/contracts';

/** Phase 3 quick-time event directional prompts, tap sigil, and timing FX. */
export const qteAssetRequests: readonly AssetManifestEntry[] = [
  {
    asset_id: 'qte.prompt.up',
    type: 'icon',
    target_path: 'public/assets/generated/ui/qte_prompt_up.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'qte',
    prompt_spec:
      'Forged bronze and ember-gold upward chevron directional prompt emblem for a fantasy RPG combat timing cue, glowing warm core, crisp pixel-art edges',
    status: 'pending',
  },
  {
    asset_id: 'qte.prompt.down',
    type: 'icon',
    target_path: 'public/assets/generated/ui/qte_prompt_down.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'qte',
    prompt_spec:
      'Forged bronze and ember-gold downward chevron directional prompt emblem for a fantasy RPG combat timing cue, glowing warm core, crisp pixel-art edges',
    status: 'pending',
  },
  {
    asset_id: 'qte.prompt.left',
    type: 'icon',
    target_path: 'public/assets/generated/ui/qte_prompt_left.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'qte',
    prompt_spec:
      'Forged bronze and ember-gold leftward chevron directional prompt emblem for a fantasy RPG combat timing cue, glowing warm core, crisp pixel-art edges',
    status: 'pending',
  },
  {
    asset_id: 'qte.prompt.right',
    type: 'icon',
    target_path: 'public/assets/generated/ui/qte_prompt_right.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'qte',
    prompt_spec:
      'Forged bronze and ember-gold rightward chevron directional prompt emblem for a fantasy RPG combat timing cue, glowing warm core, crisp pixel-art edges',
    status: 'pending',
  },
  {
    asset_id: 'qte.prompt.tap',
    type: 'icon',
    target_path: 'public/assets/generated/ui/qte_prompt_tap.png',
    resolution: { width: 128, height: 128 },
    alpha_channel: true,
    category: 'qte',
    prompt_spec:
      'Radiant starburst dragon-seal tap emblem framed by a beveled gold ring for a fantasy RPG combat action cue, crisp 16-bit pixel art UI medallion',
    status: 'pending',
  },
  {
    asset_id: 'qte.ring.pulse',
    type: 'spritesheet',
    target_path: 'public/assets/generated/ui/qte_ring_pulse.png',
    resolution: { width: 512, height: 128 },
    grid: { columns: 4, rows: 1, frame_width: 128, frame_height: 128 },
    fps: 12,
    loop: true,
    alpha_channel: true,
    category: 'qte',
    animation_states: [{ name: 'pulse', row: 0, from: 0, count: 4 }],
    prompt_spec:
      'Concentric contracting amber timing halo ring etched with subtle arcane tick marks, four-frame closing ring sequence for fantasy RPG QTE timing feedback',
    status: 'pending',
  },
  {
    asset_id: 'qte.burst.perfect',
    type: 'spritesheet',
    target_path: 'public/assets/generated/fx/qte_burst_perfect.png',
    resolution: { width: 512, height: 128 },
    grid: { columns: 4, rows: 1, frame_width: 128, frame_height: 128 },
    fps: 14,
    loop: false,
    alpha_channel: true,
    category: 'qte',
    animation_states: [{ name: 'burst', row: 0, from: 0, count: 4 }],
    prompt_spec:
      'Crisp golden-crimson radial spark flare bursting outward from center across four sequential animation frames, 16-bit fantasy RPG perfect-hit flash effect',
    status: 'pending',
  },
];
