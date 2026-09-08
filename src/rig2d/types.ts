export interface Vec2 {
  x: number;
  y: number;
}

export interface Transform2D {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export type ParentAnchor = 'origin' | 'end';

export interface BoneDefinition {
  name: string;
  parent?: string;
  anchor?: ParentAnchor;
  x?: number;
  y?: number;
  rotation?: number;
  length?: number;
  minRotation?: number;
  maxRotation?: number;
}

export interface BonePose {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export type RigPose = Record<string, BonePose>;

export interface BoneSnapshot {
  name: string;
  parent?: string;
  start: Vec2;
  end: Vec2;
  worldRotation: number;
  local: Transform2D;
  length: number;
}

export interface TwoBoneIKOptions {
  upper: string;
  lower: string;
  target: Vec2;
  /** Fallback elbow branch when no continuity/pole hint is available. */
  bend?: -1 | 1;
  /** Anatomical pole. Prefer this over hard-coded bend signs for authored bodies. */
  pole?: Vec2;
  /**
   * Previous or otherwise preferred elbow position. When supplied for a new
   * chain, Rig2D evaluates both legal two-bone solutions and chooses the one
   * closest to this point.
   */
  preferredElbow?: Vec2;
  /**
   * Allow a remembered IK branch to change to the branch requested by pole/bend,
   * but only when the two elbow solutions are already close enough to make the
   * transition visually safe (normally near a straight/unfolded arm).
   */
  allowTopologySwitch?: boolean;
  /** Maximum distance in pixels between the two legal elbow solutions at switch. */
  topologySwitchDistance?: number;
  weight?: number;
  stretch?: number;
}

export interface AimConstraintOptions {
  bone: string;
  target: Vec2;
  weight?: number;
  offset?: number;
}

export interface RigAttachmentDefinition {
  name: string;
  bone: string;
  x?: number;
  y?: number;
  rotation?: number;
}

export interface RigAttachmentSnapshot {
  name: string;
  bone: string;
  position: Vec2;
  rotation: number;
}

export interface RigDebugSnapshot {
  bones: BoneSnapshot[];
  attachments: RigAttachmentSnapshot[];
}
