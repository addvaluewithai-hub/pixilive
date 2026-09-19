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
  id: 'foxy-v4.2',
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
  // Foxy is compact, but her hands need a large semantic range because the face
  // sits far above the shoulder root. The IK solver owns the actual joint angles.
  armX: 46,
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
  oneHandedWave: true,
  cryWithBothHands: true,
  motionCharacter: 'nimble',
  // The universal mood/action pack owns the acting. These aliases remain neutral
  // so a pack never stacks on top of a legacy facial recipe.
  emotion: {
    calm: { ...neutralFace },
    happy: { ...neutralFace },
    curious: { ...neutralFace },
    excited: { ...neutralFace },
  },
});
