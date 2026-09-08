import { add, angleOf, clamp, cross, lerp, lerpAngle, normalizeAngle, rotate, sub } from './math';
import type {
  AimConstraintOptions,
  BoneDefinition,
  BonePose,
  BoneSnapshot,
  RigAttachmentDefinition,
  RigAttachmentSnapshot,
  RigDebugSnapshot,
  RigPose,
  Transform2D,
  TwoBoneIKOptions,
  Vec2,
} from './types';

interface BoneRuntime {
  definition: BoneDefinition;
  rest: Transform2D;
  local: Transform2D;
  start: Vec2;
  end: Vec2;
  worldRotation: number;
}

const transformFrom = (definition: BoneDefinition): Transform2D => ({
  x: definition.x ?? 0,
  y: definition.y ?? 0,
  rotation: definition.rotation ?? 0,
  scaleX: 1,
  scaleY: 1,
});

const cloneTransform = (value: Transform2D): Transform2D => ({ ...value });

/**
 * Minimal code-first 2D skeleton runtime.
 *
 * Invariant: callers start every animation frame with resetToRest(), then layer
 * poses/constraints. No modifier is allowed to accumulate transforms from the
 * previous frame. This makes long-running agents stable and keeps authored poses
 * deterministic.
 */
export class Rig2D {
  private readonly bones = new Map<string, BoneRuntime>();
  private readonly orderedBones: BoneRuntime[] = [];
  private readonly attachments = new Map<string, RigAttachmentDefinition>();

  constructor(definitions: BoneDefinition[], attachments: RigAttachmentDefinition[] = []) {
    if (!definitions.length) throw new Error('Rig2D requires at least one bone');

    for (const definition of definitions) {
      if (this.bones.has(definition.name)) throw new Error(`Duplicate Rig2D bone: ${definition.name}`);
      const rest = transformFrom(definition);
      this.bones.set(definition.name, {
        definition: { ...definition },
        rest,
        local: cloneTransform(rest),
        start: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
        worldRotation: 0,
      });
    }

    for (const bone of this.bones.values()) {
      const parent = bone.definition.parent;
      if (parent && !this.bones.has(parent)) throw new Error(`Rig2D bone ${bone.definition.name} references missing parent ${parent}`);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) throw new Error(`Rig2D cycle detected at ${name}`);
      visiting.add(name);
      const bone = this.requireBone(name);
      if (bone.definition.parent) visit(bone.definition.parent);
      visiting.delete(name);
      visited.add(name);
      this.orderedBones.push(bone);
    };
    for (const name of this.bones.keys()) visit(name);

    for (const attachment of attachments) {
      if (!this.bones.has(attachment.bone)) throw new Error(`Rig2D attachment ${attachment.name} references missing bone ${attachment.bone}`);
      if (this.attachments.has(attachment.name)) throw new Error(`Duplicate Rig2D attachment: ${attachment.name}`);
      this.attachments.set(attachment.name, { ...attachment });
    }

    this.updateWorld();
  }

  resetToRest() {
    for (const bone of this.bones.values()) bone.local = cloneTransform(bone.rest);
    this.updateWorld();
  }

  applyPose(pose: RigPose, weight = 1) {
    const w = clamp(weight, 0, 1);
    for (const [name, value] of Object.entries(pose)) this.applyBonePose(name, value, w);
    this.updateWorld();
  }

  applyBonePose(name: string, pose: BonePose, weight = 1) {
    const bone = this.requireBone(name);
    const w = clamp(weight, 0, 1);
    if (pose.x !== undefined) bone.local.x = lerp(bone.local.x, pose.x, w);
    if (pose.y !== undefined) bone.local.y = lerp(bone.local.y, pose.y, w);
    if (pose.rotation !== undefined) bone.local.rotation = this.limitRotation(bone, lerpAngle(bone.local.rotation, pose.rotation, w));
    if (pose.scaleX !== undefined) bone.local.scaleX = lerp(bone.local.scaleX, pose.scaleX, w);
    if (pose.scaleY !== undefined) bone.local.scaleY = lerp(bone.local.scaleY, pose.scaleY, w);
  }

  setBonePosition(name: string, position: Vec2) {
    const bone = this.requireBone(name);
    bone.local.x = position.x;
    bone.local.y = position.y;
    this.updateWorld();
  }

  setBoneRotation(name: string, rotation: number) {
    const bone = this.requireBone(name);
    bone.local.rotation = this.limitRotation(bone, rotation);
    this.updateWorld();
  }

  getBone(name: string): BoneSnapshot {
    const bone = this.requireBone(name);
    return this.snapshotBone(bone);
  }

  getAttachment(name: string): RigAttachmentSnapshot {
    const attachment = this.attachments.get(name);
    if (!attachment) throw new Error(`Unknown Rig2D attachment: ${name}`);
    const bone = this.requireBone(attachment.bone);
    const offset = rotate({ x: attachment.x ?? 0, y: attachment.y ?? 0 }, bone.worldRotation);
    return {
      name,
      bone: attachment.bone,
      position: add(bone.start, offset),
      rotation: bone.worldRotation + (attachment.rotation ?? 0),
    };
  }

  solveAim(options: AimConstraintOptions) {
    this.updateWorld();
    const bone = this.requireBone(options.bone);
    const parentRotation = bone.definition.parent ? this.requireBone(bone.definition.parent).worldRotation : 0;
    const desiredWorld = angleOf(sub(options.target, bone.start)) + (options.offset ?? 0);
    const desiredLocal = this.limitRotation(bone, normalizeAngle(desiredWorld - parentRotation));
    bone.local.rotation = lerpAngle(bone.local.rotation, desiredLocal, clamp(options.weight ?? 1, 0, 1));
    this.updateWorld();
  }

  solveTwoBoneIK(options: TwoBoneIKOptions) {
    this.updateWorld();
    const upper = this.requireBone(options.upper);
    const lower = this.requireBone(options.lower);
    if (lower.definition.parent !== upper.definition.name || (lower.definition.anchor ?? 'end') !== 'end') {
      throw new Error(`Rig2D IK chain requires ${lower.definition.name} to attach to the end of ${upper.definition.name}`);
    }

    const shoulder = upper.start;
    const targetVector = sub(options.target, shoulder);
    const targetDistance = Math.max(0.0001, Math.hypot(targetVector.x, targetVector.y));
    const l1 = Math.max(0.0001, (upper.definition.length ?? 0) * upper.local.scaleX);
    const l2 = Math.max(0.0001, (lower.definition.length ?? 0) * lower.local.scaleX);
    const maximum = Math.max(0.0002, l1 + l2 - 0.0001);
    const minimum = Math.max(0.0001, Math.abs(l1 - l2) + 0.0001);
    const stretch = clamp(options.stretch ?? 0, 0, 1);
    const solvedDistance = clamp(targetDistance, minimum, maximum + Math.max(0, targetDistance - maximum) * stretch);
    const targetAngle = angleOf(targetVector);

    let bend: -1 | 1 = options.bend ?? 1;
    if (options.pole) {
      const poleVector = sub(options.pole, shoulder);
      bend = cross(targetVector, poleVector) >= 0 ? 1 : -1;
    }

    const cosShoulder = clamp((l1 * l1 + solvedDistance * solvedDistance - l2 * l2) / (2 * l1 * solvedDistance), -1, 1);
    const shoulderOffset = Math.acos(cosShoulder);
    const upperWorld = targetAngle + bend * shoulderOffset;
    const parentRotation = upper.definition.parent ? this.requireBone(upper.definition.parent).worldRotation : 0;
    const upperLocal = this.limitRotation(upper, normalizeAngle(upperWorld - parentRotation));
    const weight = clamp(options.weight ?? 1, 0, 1);
    upper.local.rotation = lerpAngle(upper.local.rotation, upperLocal, weight);

    this.updateWorld();
    const elbow = upper.end;
    const lowerWorld = angleOf(sub(options.target, elbow));
    const lowerLocal = this.limitRotation(lower, normalizeAngle(lowerWorld - upper.worldRotation));
    lower.local.rotation = lerpAngle(lower.local.rotation, lowerLocal, weight);
    this.updateWorld();
  }

  distanceBetween(a: string, b: string) {
    const first = this.requireBone(a).start;
    const second = this.requireBone(b).start;
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  debugSnapshot(): RigDebugSnapshot {
    return {
      bones: this.orderedBones.map((bone) => this.snapshotBone(bone)),
      attachments: [...this.attachments.keys()].map((name) => this.getAttachment(name)),
    };
  }

  updateWorld() {
    for (const bone of this.orderedBones) {
      const parentName = bone.definition.parent;
      if (!parentName) {
        bone.start = { x: bone.local.x, y: bone.local.y };
        bone.worldRotation = bone.local.rotation;
      } else {
        const parent = this.requireBone(parentName);
        const parentAnchor = (bone.definition.anchor ?? 'end') === 'end' ? parent.end : parent.start;
        const localOffset = rotate({ x: bone.local.x, y: bone.local.y }, parent.worldRotation);
        bone.start = add(parentAnchor, localOffset);
        bone.worldRotation = parent.worldRotation + bone.local.rotation;
      }
      const length = (bone.definition.length ?? 0) * bone.local.scaleX;
      bone.end = add(bone.start, rotate({ x: length, y: 0 }, bone.worldRotation));
    }
  }

  private snapshotBone(bone: BoneRuntime): BoneSnapshot {
    return {
      name: bone.definition.name,
      parent: bone.definition.parent,
      start: { ...bone.start },
      end: { ...bone.end },
      worldRotation: bone.worldRotation,
      local: cloneTransform(bone.local),
      length: bone.definition.length ?? 0,
    };
  }

  private limitRotation(bone: BoneRuntime, rotation: number) {
    const min = bone.definition.minRotation;
    const max = bone.definition.maxRotation;
    if (min === undefined && max === undefined) return normalizeAngle(rotation);
    return clamp(normalizeAngle(rotation), min ?? -Math.PI, max ?? Math.PI);
  }

  private requireBone(name: string) {
    const bone = this.bones.get(name);
    if (!bone) throw new Error(`Unknown Rig2D bone: ${name}`);
    return bone;
  }
}
