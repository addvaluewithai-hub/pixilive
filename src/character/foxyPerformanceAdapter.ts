import { createMascotPerformanceAdapter } from './mascotPerformanceAdapter';

const neutralFace = {
  eyeScale: 1,
  // Rive data binding writes absolute Y, so keep the authored eyebrow baseline here.
  browY: -76,
  smileOpacity: 0,
  neutralOpacity: 1,
  frownOpacity: 0,
  expressionMouthOpacity: 0,
  tearOpacity: 0,
  sparkleOpacity: 0,
  blushOpacity: 0.62,
  browTilt: 0,
  tailTilt: -0.18,
} as const;

export const foxyPerformanceAdapter = createMascotPerformanceAdapter({
  id: 'foxy-v4.3',
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
  // Foxy folds long hidden arm chains at rest, then lets IK unfold them for acting.
  armX: 50,
  armY: 168,
  bodyLift: 18,
  bodyLean: 0.052,
  headLift: 16,
  headTilt: 0.18,
  eyeScale: 0.56,
  browLift: 18,
  browTilt: 1.08,
  tailTilt: 0.64,
  thinkHandX: -50,
  thinkHandY: -238,
  joyMouthOpen: 0.82,
  oneHandedWave: true,
  cryWithBothHands: true,
  motionCharacter: 'nimble',
  // Universal packs own the full performance; legacy aliases stay neutral.
  emotion: {
    calm: { ...neutralFace },
    happy: { ...neutralFace },
    curious: { ...neutralFace },
    excited: { ...neutralFace },
  },
});
