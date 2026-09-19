import type { PerformanceIntent } from './behaviorPacks';
import type {
  CharacterPerformanceAdapter,
  PerformanceSampleContext,
  StandardPerformancePose,
} from './performanceAdapter';

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));

function pulse(patternValue: number, phase: number, cycles = 1) {
  return patternValue * Math.sin(phase * Math.PI * 2 * cycles);
}

export const kiroPerformanceAdapter: CharacterPerformanceAdapter = {
  id: 'kiro-v1',
  sample(intent: PerformanceIntent, context: PerformanceSampleContext): StandardPerformancePose {
    const w = context.weight;
    const phase = context.phase;
    const bodyLift = clamp(intent.bodyLift ?? 0);
    const bodyLean = clamp(intent.bodyLean ?? 0);
    const bodyOpen = clamp(intent.bodyOpen ?? 0);
    const headLift = clamp(intent.headLift ?? 0);
    const headTilt = clamp(intent.headTilt ?? 0);
    const headNod = clamp(intent.headNod ?? 0);
    const eyeOpen = clamp(intent.eyeOpen ?? 0);
    const browLift = clamp(intent.browLift ?? 0);
    const smile = clamp(intent.smile ?? 0);
    const armRaise = clamp(intent.armRaise ?? 0);
    const armSpread = clamp(intent.armSpread ?? 0);
    const handToFace = clamp(intent.handToFace ?? 0);
    const shrug = clamp(intent.shrug ?? 0);

    let leftHandX = (-28 * armSpread - 10 * bodyOpen) * w;
    let rightHandX = (28 * armSpread + 10 * bodyOpen) * w;
    let leftHandY = (-52 * armRaise - 12 * shrug) * w;
    let rightHandY = (-52 * armRaise - 12 * shrug) * w;

    if (handToFace > 0) {
      rightHandX += -34 * handToFace * w;
      rightHandY += -62 * handToFace * w;
      leftHandY += -8 * handToFace * w;
    }

    const nod = Math.abs(headNod) > 0.001
      ? Math.sin(phase * Math.PI * 4) * headNod * 7
      : 0;

    return {
      bodyY: -12 * bodyLift * w,
      bodyLean: 0.055 * bodyLean * w,
      headY: (-11 * headLift + nod) * w,
      headTilt: 0.16 * headTilt * w,
      leftHandX,
      leftHandY,
      rightHandX,
      rightHandY,
      eyeScale: 0.24 * eyeOpen * w,
      browY: -8 * browLift * w,
      smileOpacity: Math.max(0, smile) * w,
      neutralOpacity: Math.max(0, -smile) * 0.35 * w,
    };
  },
  applyPattern(pose: StandardPerformancePose, pattern: string, phase: number) {
    if (pattern === 'shake') {
      return { ...pose, headTilt: pose.headTilt + pulse(0.11, phase, 2.2) };
    }
    if (pattern === 'wave') {
      return {
        ...pose,
        rightHandX: pose.rightHandX + pulse(20, phase, 2.4),
        rightHandY: pose.rightHandY - Math.abs(pulse(8, phase, 2.4)),
      };
    }
    if (pattern === 'tremble') {
      return {
        ...pose,
        bodyLean: pose.bodyLean + pulse(0.007, phase, 6),
        headTilt: pose.headTilt + pulse(0.012, phase, 6),
      };
    }
    if (pattern === 'bounce') {
      return { ...pose, bodyY: pose.bodyY - Math.max(0, pulse(5, phase, 1.6)) };
    }
    return pose;
  },
};
