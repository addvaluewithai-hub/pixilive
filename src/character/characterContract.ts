export type CharacterCapability =
  | 'face'
  | 'arms'
  | 'legs'
  | 'tail'
  | 'ears'
  | 'wings'
  | 'antenna'
  | 'squashStretch'
  | 'tears'
  | 'sparkle'
  | 'glow'
  | 'blush'
  | 'accessory';

export type CharacterAssetPart =
  | 'body'
  | 'head'
  | 'eyes'
  | 'brows'
  | 'mouth'
  | 'leftArm'
  | 'rightArm'
  | 'leftLeg'
  | 'rightLeg'
  | 'tail'
  | 'leftWing'
  | 'rightWing'
  | 'ears'
  | 'hair'
  | 'accessory'
  | 'tears'
  | 'sparkles';

export interface CharacterAuthoringContract {
  /** Human-readable archetype only; behavior packs never depend on it. */
  archetype: 'humanoid' | 'animal' | 'robot' | 'blob' | 'plant' | 'object' | 'custom';
  capabilities: readonly CharacterCapability[];
  /** Optional inventory of separately supplied art pieces. */
  suppliedParts?: readonly CharacterAssetPart[];
  /** If true, the art arrives pre-separated and ready for rigging. */
  layeredArtwork?: boolean;
  /** Notes for non-standard anatomy: e.g. "leaves act as arms" or "cloud has no limbs". */
  anatomyNotes?: string;
}

/**
 * Recommended delivery format for a new character. PNG works for painted art,
 * SVG is ideal for clean vector mascots, and a layered source (PSD/AI/Figma export)
 * is best when available. The runtime only cares that movable pieces can be isolated.
 */
export interface CharacterAssetDelivery {
  format: 'svg' | 'png' | 'webp' | 'psd' | 'ai' | 'figma-export' | 'mixed';
  transparentBackground: boolean;
  frontView: boolean;
  minimumWorkingSizePx?: number;
  notes?: string;
}
