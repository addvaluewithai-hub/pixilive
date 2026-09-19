export type BehaviorKind = 'mood' | 'action';

export type MoodId =
  | 'calm'
  | 'happy'
  | 'sad'
  | 'thinking'
  | 'curious'
  | 'excited'
  | 'worried'
  | 'listening'
  | 'confident'
  | 'angry'
  | 'sleepy';

export type ActionId =
  | 'celebrate'
  | 'laugh'
  | 'cry'
  | 'surprised'
  | 'shrug'
  | 'nod'
  | 'shakeNo'
  | 'aha'
  | 'greet'
  | 'reassure'
  | 'agree'
  | 'disagree';

export type BehaviorId = MoodId | ActionId;
export type MotionPattern = 'hold' | 'pulse' | 'bounce' | 'nod' | 'shake' | 'wave' | 'tremble';

/** Semantic, anatomy-free channels. Character adapters own the translation. */
export interface PerformanceIntent {
  valence?: number;
  arousal?: number;
  bodyLift?: number;
  bodyLean?: number;
  bodyOpen?: number;
  headLift?: number;
  headTilt?: number;
  headNod?: number;
  eyeOpen?: number;
  browLift?: number;
  browTilt?: number;
  smile?: number;
  mouthOpen?: number;
  armRaise?: number;
  armSpread?: number;
  handToFace?: number;
  shrug?: number;
  tears?: number;
  sparkle?: number;
  blush?: number;
  tailLift?: number;
}

export interface BehaviorPack<TId extends BehaviorId = BehaviorId> {
  id: TId;
  label: string;
  emoji: string;
  kind: BehaviorKind;
  intent: PerformanceIntent;
  pattern: MotionPattern;
  durationMs?: number;
}

export interface ActionCommand {
  id: ActionId;
  nonce: number;
}

export interface SampledPerformance extends PerformanceIntent {
  weight: number;
  phase: number;
}

export const moodPacks: readonly BehaviorPack<MoodId>[] = [
  { id: 'calm', label: 'Calm', emoji: '😌', kind: 'mood', pattern: 'hold', intent: { valence: 0.15, arousal: 0.12, eyeOpen: -0.05, smile: 0.06, blush: 0.42, tailLift: 0.05 } },
  { id: 'happy', label: 'Happy', emoji: '😊', kind: 'mood', pattern: 'hold', intent: { valence: 0.8, arousal: 0.45, bodyOpen: 0.35, headLift: 0.18, eyeOpen: -0.16, browLift: 0.1, smile: 0.9, blush: 0.85, tailLift: 0.42 } },
  { id: 'sad', label: 'Sad', emoji: '😔', kind: 'mood', pattern: 'hold', intent: { valence: -0.8, arousal: -0.25, bodyLift: -0.25, bodyOpen: -0.42, headLift: -0.42, headTilt: -0.08, eyeOpen: -0.18, browLift: 0.28, browTilt: 0.55, smile: -0.9, blush: 0.24, tailLift: -0.48 } },
  { id: 'thinking', label: 'Thinking', emoji: '🤔', kind: 'mood', pattern: 'hold', intent: { valence: 0.02, arousal: 0.18, bodyLean: 0.12, headTilt: -0.38, eyeOpen: -0.04, browLift: 0.18, browTilt: 0.28, smile: 0.02, handToFace: 0.78, blush: 0.3, tailLift: 0.1 } },
  { id: 'curious', label: 'Curious', emoji: '🧐', kind: 'mood', pattern: 'hold', intent: { valence: 0.25, arousal: 0.38, bodyLean: 0.12, headTilt: 0.32, eyeOpen: 0.18, browLift: 0.28, browTilt: 0.18, smile: 0.12, blush: 0.4, tailLift: 0.18 } },
  { id: 'excited', label: 'Excited', emoji: '🤩', kind: 'mood', pattern: 'hold', intent: { valence: 0.9, arousal: 0.95, bodyLift: 0.22, bodyOpen: 0.62, headLift: 0.28, eyeOpen: 0.18, browLift: 0.32, smile: 1, mouthOpen: 0.28, armSpread: 0.22, sparkle: 0.32, blush: 1, tailLift: 0.7 } },
  { id: 'worried', label: 'Worried', emoji: '😟', kind: 'mood', pattern: 'hold', intent: { valence: -0.55, arousal: 0.55, bodyOpen: -0.35, headLift: -0.12, headTilt: -0.12, eyeOpen: 0.15, browLift: 0.42, browTilt: 0.62, smile: -0.48, blush: 0.24, tailLift: -0.28 } },
  { id: 'listening', label: 'Listening', emoji: '👂', kind: 'mood', pattern: 'hold', intent: { valence: 0.2, arousal: 0.2, bodyLean: 0.06, headTilt: 0.1, eyeOpen: 0.05, browLift: 0.06, smile: 0.06, blush: 0.35, tailLift: 0.08 } },
  { id: 'confident', label: 'Confident', emoji: '😎', kind: 'mood', pattern: 'hold', intent: { valence: 0.55, arousal: 0.45, bodyLift: 0.12, bodyOpen: 0.5, headLift: 0.22, eyeOpen: -0.08, browLift: 0.02, browTilt: -0.12, smile: 0.34, blush: 0.38, tailLift: 0.34 } },
  { id: 'angry', label: 'Angry', emoji: '😠', kind: 'mood', pattern: 'hold', intent: { valence: -0.82, arousal: 0.78, bodyLean: 0.1, bodyOpen: 0.08, headLift: 0.04, eyeOpen: -0.18, browLift: -0.32, browTilt: -0.92, smile: -0.95, armSpread: 0.08, blush: 0.18, tailLift: 0.2 } },
  { id: 'sleepy', label: 'Sleepy', emoji: '😴', kind: 'mood', pattern: 'hold', intent: { valence: 0.02, arousal: -0.88, bodyLift: -0.2, bodyLean: -0.06, headLift: -0.28, headTilt: 0.18, eyeOpen: -0.82, browLift: -0.08, smile: -0.02, mouthOpen: 0.28, blush: 0.22, tailLift: -0.32 } },
] as const;

export const actionPacks: readonly BehaviorPack<ActionId>[] = [
  { id: 'celebrate', label: 'Celebrating', emoji: '🎉', kind: 'action', pattern: 'bounce', durationMs: 1350, intent: { valence: 1, arousal: 1, bodyLift: 0.68, bodyOpen: 1, headLift: 0.62, eyeOpen: -0.1, browLift: 0.32, smile: 1, mouthOpen: 0.8, armRaise: 1, armSpread: 0.62, sparkle: 1, blush: 1, tailLift: 1 } },
  { id: 'laugh', label: 'Laughing', emoji: '😂', kind: 'action', pattern: 'bounce', durationMs: 1250, intent: { valence: 1, arousal: 0.8, bodyLean: -0.1, headLift: 0.16, eyeOpen: -0.72, browLift: 0.08, smile: 1, mouthOpen: 0.92, armSpread: 0.22, blush: 0.92, tailLift: 0.5 } },
  { id: 'cry', label: 'Crying', emoji: '😭', kind: 'action', pattern: 'tremble', durationMs: 1900, intent: { valence: -1, arousal: 0.55, bodyLift: -0.48, bodyOpen: -0.62, headLift: -0.58, eyeOpen: -0.48, browLift: 0.26, browTilt: 0.78, smile: -1, mouthOpen: 0.72, handToFace: 0.72, tears: 1, blush: 0.18, tailLift: -0.68 } },
  { id: 'surprised', label: 'Surprised', emoji: '😮', kind: 'action', pattern: 'pulse', durationMs: 900, intent: { valence: 0.12, arousal: 1, bodyLift: 0.24, bodyOpen: 0.42, headLift: 0.3, eyeOpen: 0.72, browLift: 0.82, smile: 0.02, mouthOpen: 0.82, armSpread: 0.46, blush: 0.42, tailLift: 0.34 } },
  { id: 'shrug', label: 'Shrug', emoji: '🤷', kind: 'action', pattern: 'pulse', durationMs: 1150, intent: { valence: 0, arousal: 0.25, bodyOpen: 0.28, headTilt: 0.23, browLift: 0.28, browTilt: 0.15, armRaise: 0.4, armSpread: 0.68, shrug: 1, tailLift: 0.05 } },
  { id: 'nod', label: 'Nod', emoji: '👍', kind: 'action', pattern: 'nod', durationMs: 850, intent: { valence: 0.35, arousal: 0.35, headNod: 1, smile: 0.18, blush: 0.35, tailLift: 0.12 } },
  { id: 'shakeNo', label: 'No', emoji: '🙅', kind: 'action', pattern: 'shake', durationMs: 900, intent: { valence: -0.18, arousal: 0.4, headTilt: 0.9, smile: -0.12, browTilt: -0.18, tailLift: -0.1 } },
  { id: 'aha', label: 'Aha!', emoji: '💡', kind: 'action', pattern: 'pulse', durationMs: 1000, intent: { valence: 0.75, arousal: 0.9, bodyLift: 0.2, headLift: 0.38, eyeOpen: 0.38, browLift: 0.62, smile: 0.64, mouthOpen: 0.28, armRaise: 0.3, sparkle: 0.72, blush: 0.7, tailLift: 0.5 } },
  { id: 'greet', label: 'Waving', emoji: '👋', kind: 'action', pattern: 'wave', durationMs: 1450, intent: { valence: 0.72, arousal: 0.55, bodyOpen: 0.4, headTilt: 0.1, smile: 0.68, armRaise: 0.62, armSpread: 0.32, blush: 0.68, tailLift: 0.4 } },
  { id: 'reassure', label: 'Reassure', emoji: '🫶', kind: 'action', pattern: 'pulse', durationMs: 1250, intent: { valence: 0.62, arousal: -0.05, bodyLean: 0.06, bodyOpen: 0.18, headTilt: 0.1, eyeOpen: -0.14, browLift: 0.05, smile: 0.34, armRaise: 0.18, blush: 0.45, tailLift: 0.08 } },
  { id: 'agree', label: 'Agree', emoji: '✅', kind: 'action', pattern: 'nod', durationMs: 780, intent: { valence: 0.58, arousal: 0.4, headNod: 0.8, smile: 0.42, blush: 0.45, tailLift: 0.22 } },
  { id: 'disagree', label: 'Disagree', emoji: '❌', kind: 'action', pattern: 'shake', durationMs: 900, intent: { valence: -0.35, arousal: 0.45, headTilt: 0.82, browLift: -0.12, browTilt: -0.35, smile: -0.3, tailLift: -0.18 } },
] as const;

export const behaviorPacks = [...moodPacks, ...actionPacks] as const;

export function getMoodPack(id: MoodId) {
  return moodPacks.find((pack) => pack.id === id) ?? moodPacks[0];
}

export function getActionPack(id: ActionId) {
  return actionPacks.find((pack) => pack.id === id) ?? actionPacks[0];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export function actionEnvelope(pattern: MotionPattern, elapsedMs: number, durationMs: number) {
  if (elapsedMs < 0 || elapsedMs >= durationMs) return { weight: 0, phase: 1 };
  const phase = elapsedMs / durationMs;
  const attack = smoothstep(phase / 0.2);
  const release = 1 - smoothstep((phase - 0.62) / 0.38);
  let weight = Math.min(attack, release);
  if (pattern === 'bounce') weight *= 0.82 + Math.sin(phase * Math.PI * 3) * 0.18;
  if (pattern === 'tremble') weight *= 0.9 + Math.sin(phase * Math.PI * 12) * 0.1;
  return { weight: clamp01(weight), phase };
}
