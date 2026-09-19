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
  | 'confident';

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

/**
 * Semantic, anatomy-free performance channels.
 * Values are normalized around -1..1 (or 0..1 where noted).
 * A character adapter decides how each channel maps to its own rig.
 */
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
  smile?: number;
  armRaise?: number;
  armSpread?: number;
  handToFace?: number;
  shrug?: number;
  tears?: number;
  sparkle?: number;
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
  { id: 'calm', label: 'Calm', emoji: '😌', kind: 'mood', pattern: 'hold', intent: { valence: 0.15, arousal: 0.12, eyeOpen: -0.05, smile: 0.08 } },
  { id: 'happy', label: 'Happy', emoji: '😊', kind: 'mood', pattern: 'hold', intent: { valence: 0.8, arousal: 0.45, bodyOpen: 0.35, headLift: 0.18, eyeOpen: -0.18, browLift: 0.12, smile: 0.8 } },
  { id: 'sad', label: 'Sad', emoji: '😔', kind: 'mood', pattern: 'hold', intent: { valence: -0.8, arousal: -0.25, bodyLift: -0.35, bodyOpen: -0.45, headLift: -0.45, eyeOpen: -0.22, browLift: -0.4, smile: -0.75 } },
  { id: 'thinking', label: 'Thinking', emoji: '🤔', kind: 'mood', pattern: 'hold', intent: { valence: 0.02, arousal: 0.18, bodyLean: 0.15, headTilt: -0.38, eyeOpen: -0.08, browLift: 0.25, handToFace: 0.75 } },
  { id: 'curious', label: 'Curious', emoji: '🧐', kind: 'mood', pattern: 'hold', intent: { valence: 0.25, arousal: 0.38, bodyLean: 0.14, headTilt: 0.32, eyeOpen: 0.22, browLift: 0.35, smile: 0.12 } },
  { id: 'excited', label: 'Excited', emoji: '🤩', kind: 'mood', pattern: 'hold', intent: { valence: 0.9, arousal: 0.95, bodyLift: 0.28, bodyOpen: 0.65, headLift: 0.3, eyeOpen: 0.25, browLift: 0.35, smile: 1, armSpread: 0.25 } },
  { id: 'worried', label: 'Worried', emoji: '😟', kind: 'mood', pattern: 'hold', intent: { valence: -0.55, arousal: 0.55, bodyOpen: -0.4, headLift: -0.18, headTilt: -0.15, eyeOpen: 0.18, browLift: 0.48, smile: -0.45 } },
  { id: 'listening', label: 'Listening', emoji: '👂', kind: 'mood', pattern: 'hold', intent: { valence: 0.2, arousal: 0.2, bodyLean: 0.08, headTilt: 0.12, eyeOpen: 0.06, browLift: 0.08, smile: 0.06 } },
  { id: 'confident', label: 'Confident', emoji: '😎', kind: 'mood', pattern: 'hold', intent: { valence: 0.55, arousal: 0.45, bodyLift: 0.15, bodyOpen: 0.55, headLift: 0.25, eyeOpen: -0.08, browLift: 0.08, smile: 0.32 } },
] as const;

export const actionPacks: readonly BehaviorPack<ActionId>[] = [
  { id: 'celebrate', label: 'Celebrate', emoji: '🎉', kind: 'action', pattern: 'bounce', durationMs: 1350, intent: { valence: 1, arousal: 1, bodyLift: 0.7, bodyOpen: 1, headLift: 0.65, eyeOpen: 0.18, browLift: 0.45, smile: 1, armRaise: 1, armSpread: 0.65, sparkle: 1 } },
  { id: 'laugh', label: 'Laugh', emoji: '😂', kind: 'action', pattern: 'bounce', durationMs: 1250, intent: { valence: 1, arousal: 0.8, bodyLean: -0.12, headLift: 0.2, eyeOpen: -0.65, browLift: 0.12, smile: 1, armSpread: 0.25 } },
  { id: 'cry', label: 'Cry', emoji: '😭', kind: 'action', pattern: 'tremble', durationMs: 1900, intent: { valence: -1, arousal: 0.55, bodyLift: -0.55, bodyOpen: -0.7, headLift: -0.72, eyeOpen: -0.55, browLift: -0.55, smile: -1, handToFace: 0.72, tears: 1 } },
  { id: 'surprised', label: 'Surprised', emoji: '😮', kind: 'action', pattern: 'pulse', durationMs: 900, intent: { valence: 0.12, arousal: 1, bodyLift: 0.28, bodyOpen: 0.45, headLift: 0.35, eyeOpen: 0.82, browLift: 0.9, smile: 0.08, armSpread: 0.5 } },
  { id: 'shrug', label: 'Shrug', emoji: '🤷', kind: 'action', pattern: 'pulse', durationMs: 1150, intent: { valence: 0, arousal: 0.25, bodyOpen: 0.3, headTilt: 0.25, browLift: 0.32, armRaise: 0.42, armSpread: 0.72, shrug: 1 } },
  { id: 'nod', label: 'Nod', emoji: '👍', kind: 'action', pattern: 'nod', durationMs: 850, intent: { valence: 0.35, arousal: 0.35, headNod: 1, smile: 0.18 } },
  { id: 'shakeNo', label: 'No', emoji: '🙅', kind: 'action', pattern: 'shake', durationMs: 900, intent: { valence: -0.18, arousal: 0.4, headTilt: 0.9, smile: -0.12 } },
  { id: 'aha', label: 'Aha!', emoji: '💡', kind: 'action', pattern: 'pulse', durationMs: 1000, intent: { valence: 0.75, arousal: 0.9, bodyLift: 0.22, headLift: 0.42, eyeOpen: 0.45, browLift: 0.72, smile: 0.62, armRaise: 0.32, sparkle: 0.7 } },
  { id: 'greet', label: 'Hello', emoji: '👋', kind: 'action', pattern: 'wave', durationMs: 1450, intent: { valence: 0.72, arousal: 0.55, bodyOpen: 0.42, headTilt: 0.12, smile: 0.65, armRaise: 0.65, armSpread: 0.35 } },
  { id: 'reassure', label: 'Reassure', emoji: '🫶', kind: 'action', pattern: 'pulse', durationMs: 1250, intent: { valence: 0.62, arousal: -0.05, bodyLean: 0.08, bodyOpen: 0.2, headTilt: 0.12, eyeOpen: -0.16, browLift: 0.05, smile: 0.34, armRaise: 0.2 } },
  { id: 'agree', label: 'Agree', emoji: '✅', kind: 'action', pattern: 'nod', durationMs: 780, intent: { valence: 0.58, arousal: 0.4, headNod: 0.8, smile: 0.42 } },
  { id: 'disagree', label: 'Disagree', emoji: '❌', kind: 'action', pattern: 'shake', durationMs: 900, intent: { valence: -0.35, arousal: 0.45, headTilt: 0.82, browLift: -0.18, smile: -0.28 } },
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
