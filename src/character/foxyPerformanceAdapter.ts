import { createMascotPerformanceAdapter } from './mascotPerformanceAdapter';

export const foxyPerformanceAdapter = createMascotPerformanceAdapter({
  id: 'foxy-v2.1',
  base: {
    bodyY: 0,
    bodyLean: 0,
    headY: 0,
    headTilt: 0,
    leftHandX: -118,
    leftHandY: 55,
    rightHandX: 118,
    rightHandY: 55,
    // EyeManual is a vertical scale control. The first rendered QA pass proved
    // 1.0 read as a narrow slit on this authored eye geometry.
    eyeScale: 1.62,
    // Brows already have their authored Y position (-68) inside the Rive file;
    // keep the ViewModel offset at zero so we do not double-translate them.
    browY: 0,
    smileOpacity: 0.04,
    neutralOpacity: 1,
    frownOpacity: 0,
    expressionMouthOpacity: 0,
    tearOpacity: 0,
    sparkleOpacity: 0,
    blushOpacity: 0.64,
    browTilt: 0,
    tailTilt: 0,
  },
  armX: 68,
  armY: 142,
  bodyLift: 19,
  bodyLean: 0.055,
  headLift: 16,
  headTilt: 0.18,
  eyeScale: 0.28,
  browLift: 12,
  browTilt: 1,
  tailTilt: 0.52,
  thinkHandX: -70,
  thinkHandY: -132,
  motionCharacter: 'nimble',
  emotion: {
    calm: { smileOpacity: 0.02, neutralOpacity: 1, blushOpacity: 0.62 },
    happy: { smileOpacity: 0.46, neutralOpacity: 0.18, eyeScale: -0.16, blushOpacity: 0.88, tailTilt: 0.14 },
    curious: { eyeScale: 0.08, browY: -3, headTilt: -0.04, browTilt: 0.1 },
    excited: { smileOpacity: 0.52, neutralOpacity: 0.08, eyeScale: 0.08, blushOpacity: 1, tailTilt: 0.2 },
  },
});
