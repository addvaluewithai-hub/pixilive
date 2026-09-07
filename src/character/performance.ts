export type CharacterAffect =
  | 'neutral'
  | 'warm'
  | 'curious'
  | 'enthusiastic'
  | 'reassuring'
  | 'concerned'
  | 'surprised'
  | 'thoughtful'
  | 'playful';

export type CharacterGesture =
  | 'none'
  | 'explain'
  | 'emphasize'
  | 'reassure'
  | 'agree'
  | 'disagree'
  | 'think'
  | 'celebrate'
  | 'shrug'
  | 'greet'
  | 'goodbye';

export type CharacterPosture = 'neutral' | 'engaged' | 'lean_in' | 'lean_back' | 'open';
export type CharacterGaze = 'user' | 'thinking_up' | 'thinking_side' | 'away' | 'auto';
export type CharacterMode = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface PerformanceCue {
  affect: CharacterAffect;
  intensity: number;
  gesture: CharacterGesture;
  posture: CharacterPosture;
  gaze: CharacterGaze;
}

export interface PerformanceState extends PerformanceCue {
  mode: CharacterMode;
  speechEnergy: number;
  speechBeat: number;
  listeningBeat: number;
  gesturePhase: number;
  gestureEnvelope: number;
  gestureVariant: number;
}

export const neutralPerformanceCue: PerformanceCue = {
  affect: 'neutral',
  intensity: 0.35,
  gesture: 'none',
  posture: 'neutral',
  gaze: 'auto',
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function normalizePerformanceCue(input: Partial<PerformanceCue> | null | undefined): PerformanceCue {
  const affect: CharacterAffect = [
    'neutral', 'warm', 'curious', 'enthusiastic', 'reassuring', 'concerned', 'surprised', 'thoughtful', 'playful',
  ].includes(input?.affect ?? '')
    ? (input!.affect as CharacterAffect)
    : 'neutral';
  const gesture: CharacterGesture = [
    'none', 'explain', 'emphasize', 'reassure', 'agree', 'disagree', 'think', 'celebrate', 'shrug', 'greet', 'goodbye',
  ].includes(input?.gesture ?? '')
    ? (input!.gesture as CharacterGesture)
    : 'none';
  const posture: CharacterPosture = ['neutral', 'engaged', 'lean_in', 'lean_back', 'open'].includes(input?.posture ?? '')
    ? (input!.posture as CharacterPosture)
    : 'neutral';
  const gaze: CharacterGaze = ['user', 'thinking_up', 'thinking_side', 'away', 'auto'].includes(input?.gaze ?? '')
    ? (input!.gaze as CharacterGaze)
    : 'auto';

  return {
    affect,
    gesture,
    posture,
    gaze,
    intensity: clamp01(input?.intensity ?? 0.5),
  };
}
