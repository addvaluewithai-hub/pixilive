import { createMascotPerformanceAdapter } from './mascotPerformanceAdapter';

const neutralFace = {
  eyeScale: 1,
  browY: 0,
  smileOpacity: 0,
  neutralOpacity: 1,
  frownOpacity: 0,
  expressionMouthOpacity: 0,
  tearOpacity: 0,
  sparkleOpacity: 0,
  blushOpacity: 0.62,
  browTilt: 0,
  tailTilt: 0,
} as const;

export const foxyPerformanceAdapter = createMascotPerformanceAdapter({
  id: 'foxy-v4.1',
  base: {
    bodyY: 0,
    bodyLean: 0,
    headY: 0,
    headTilt: 0,
    leftHandX: -88,
    leftHandY: 58,
    rightHandX: 88,
    rightHandY: 58,
    ...neutralFace,
  },
  // Compact at rest, with enough range for clear staged reactions.
  armX: 58,
  armY: 118,
  bodyLift: 18,
  bodyLean: 0.052,
  headLift: 16,
  headTilt: 0.18,
  eyeScale: 0.52,
  browLift: 16,
  browTilt: 0.95,
  tailTilt: 0.58,
  thinkHandX: -48,
  thinkHandY: -102,
  motionCharacter: 'nimble',
  // The universal mood/action pack owns the acting. These legacy four emotion
  // aliases stay deliberately neutral so Angry never inherits an Excited smile,
  // and Thinking never stacks two different face recipes.
  emotion: {
    calm: { ...neutralFace },
    happy: { ...neutralFace },
    curious: { ...neutralFace },
    excited: { ...neutralFace },
  },
});
