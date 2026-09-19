import type { PerformanceIntent } from './behaviorPacks';
import type {
  CharacterPerformanceAdapter,
  StandardPerformancePose,
} from './performanceAdapter';
import type { Emotion } from './types';

export interface MascotAdapterTuning {
  id: string;
  base: StandardPerformancePose;
  /** How far hands move for normalized semantic arm channels. */
  armX: number;
  armY: number;
  bodyLift: number;
  bodyLean: number;
  headLift: number;
  headTilt: number;
  eyeScale: number;
  browLift: number;
  thinkHandX: number;
  thinkHandY: number;
  browTilt?: number;
  tailTilt?: number;
  motionCharacter?: 'soft' | 'bouncy' | 'nimble';
  emotion?: Partial<Record<Emotion, Partial<StandardPerformancePose>>>;
}

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const pulse = (amplitude: number, phase: number, cycles = 1) => amplitude * Math.sin(phase * Math.PI * 2 * cycles);

const defaultEmotion: Record<Emotion, Partial<StandardPerformancePose>> = {
  calm: { eyeScale: 0, browY: 0, smileOpacity: 0.02, neutralOpacity: 0 },
  happy: { eyeScale: -0.07, browY: -2, smileOpacity: 0.34, neutralOpacity: -0.18, headTilt: 0.018 },
  curious: { eyeScale: 0.05, browY: -3, smileOpacity: 0.08, headTilt: -0.045 },
  excited: { eyeScale: 0.08, browY: -4, smileOpacity: 0.45, neutralOpacity: -0.25, headTilt: 0.025 },
};

export function createMascotPerformanceAdapter(tuning: MascotAdapterTuning): CharacterPerformanceAdapter {
  return {
    id: tuning.id,
    base: tuning.base,
    emotion(emotion: Emotion) {
      return {
        ...defaultEmotion[emotion],
        ...(tuning.emotion?.[emotion] ?? {}),
      };
    },
    sample(intent: PerformanceIntent, context): StandardPerformancePose {
      const w = context.weight;
      const bodyLift = clamp(intent.bodyLift ?? 0);
      const bodyLean = clamp(intent.bodyLean ?? 0);
      const bodyOpen = clamp(intent.bodyOpen ?? 0);
      const headLift = clamp(intent.headLift ?? 0);
      const headTilt = clamp(intent.headTilt ?? 0);
      const headNod = clamp(intent.headNod ?? 0);
      const eyeOpen = clamp(intent.eyeOpen ?? 0);
      const browLift = clamp(intent.browLift ?? 0);
      const browTilt = clamp(intent.browTilt ?? 0);
      const smile = clamp(intent.smile ?? 0);
      const mouthOpen = clamp01(intent.mouthOpen ?? 0);
      const armRaise = clamp(intent.armRaise ?? 0);
      const armSpread = clamp(intent.armSpread ?? 0);
      const handToFace = clamp(intent.handToFace ?? 0);
      const shrug = clamp(intent.shrug ?? 0);
      const tears = clamp01(intent.tears ?? 0);
      const sparkle = clamp01(intent.sparkle ?? 0);
      const blush = clamp01(intent.blush ?? 0);
      const tailLift = clamp(intent.tailLift ?? 0);

      let leftHandX = (-tuning.armX * armSpread - tuning.armX * 0.24 * bodyOpen) * w;
      let rightHandX = (tuning.armX * armSpread + tuning.armX * 0.24 * bodyOpen) * w;
      let leftHandY = (-tuning.armY * armRaise - tuning.armY * 0.2 * shrug) * w;
      let rightHandY = (-tuning.armY * armRaise - tuning.armY * 0.2 * shrug) * w;

      if (handToFace > 0) {
        rightHandX += tuning.thinkHandX * handToFace * w;
        rightHandY += tuning.thinkHandY * handToFace * w;
        leftHandY -= tuning.armY * 0.08 * handToFace * w;
      }

      const nod = Math.abs(headNod) > 0.001
        ? Math.sin(context.phase * Math.PI * 4) * headNod * tuning.headLift * 0.55
        : 0;

      // Mouth readability rule: when an open-expression mouth is active, the
      // closed smile/frown shapes fade aggressively instead of ghosting on top.
      const closedMouthWeight = (1 - mouthOpen) * (1 - mouthOpen);

      return {
        bodyY: -tuning.bodyLift * bodyLift * w,
        bodyLean: tuning.bodyLean * bodyLean * w,
        headY: (-tuning.headLift * headLift + nod) * w,
        headTilt: tuning.headTilt * headTilt * w,
        leftHandX,
        leftHandY,
        rightHandX,
        rightHandY,
        eyeScale: tuning.eyeScale * eyeOpen * w,
        browY: -tuning.browLift * browLift * w,
        smileOpacity: Math.max(0, smile) * closedMouthWeight * w,
        // Negative values intentionally subtract from the authored neutral mouth.
        neutralOpacity: (-mouthOpen * 1.15 + Math.max(0, -smile) * 0.04) * w,
        frownOpacity: Math.max(0, -smile) * closedMouthWeight * w,
        expressionMouthOpacity: mouthOpen * w,
        tearOpacity: tears * w,
        sparkleOpacity: sparkle * w,
        blushOpacity: blush * w,
        browTilt: (tuning.browTilt ?? 1) * browTilt * w,
        tailTilt: (tuning.tailTilt ?? 0.4) * tailLift * w,
      };
    },
    applyPattern(pose, pattern, phase) {
      const character = tuning.motionCharacter ?? 'soft';
      if (pattern === 'shake') {
        const amount = character === 'nimble' ? 0.13 : character === 'bouncy' ? 0.1 : 0.08;
        return { ...pose, headTilt: pose.headTilt + pulse(amount, phase, 2.2) };
      }
      if (pattern === 'wave') {
        const amount = character === 'nimble' ? 24 : character === 'bouncy' ? 18 : 15;
        return {
          ...pose,
          rightHandX: pose.rightHandX + pulse(amount, phase, 2.4),
          rightHandY: pose.rightHandY - Math.abs(pulse(amount * 0.35, phase, 2.4)),
          tailTilt: (pose.tailTilt ?? 0) + pulse(character === 'nimble' ? 0.1 : 0.06, phase, 1.4),
        };
      }
      if (pattern === 'tremble') {
        return {
          ...pose,
          bodyLean: pose.bodyLean + pulse(character === 'soft' ? 0.005 : 0.008, phase, 6),
          headTilt: pose.headTilt + pulse(character === 'soft' ? 0.009 : 0.013, phase, 6),
        };
      }
      if (pattern === 'bounce') {
        const amount = character === 'bouncy' ? 9 : character === 'nimble' ? 7 : 5;
        return {
          ...pose,
          bodyY: pose.bodyY - Math.max(0, pulse(amount, phase, 1.6)),
          tailTilt: (pose.tailTilt ?? 0) + Math.abs(pulse(character === 'nimble' ? 0.08 : 0.05, phase, 1.6)),
        };
      }
      if (pattern === 'pulse') {
        return { ...pose, bodyY: pose.bodyY - Math.max(0, pulse(3, phase, 1)) };
      }
      return pose;
    },
  };
}
