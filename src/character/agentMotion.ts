import type { Emotion } from './types';

export type AgentGesture = 'conversational' | 'explain' | 'question' | 'emphasis' | 'reassure' | 'warm';

export interface AgentMotionInput {
  nowMs: number;
  dtSeconds: number;
  speaking: boolean;
  energy: number;
  emotion: Emotion;
  text: string;
  strength: number;
}

export interface AgentMotionOffsets {
  bodyY: number;
  bodyLean: number;
  headY: number;
  headTilt: number;
  leftHandX: number;
  leftHandY: number;
  rightHandX: number;
  rightHandY: number;
  eyeScale: number;
  browY: number;
  gesture: AgentGesture;
  beat: number;
  energy: number;
}

export interface AgentMotionState {
  smoothedEnergy: number;
  previousEnergy: number;
  wasSpeaking: boolean;
  lastBeatAt: number;
  beatStartedAt: number;
  beatDurationMs: number;
  beatStrength: number;
  beatSide: -1 | 1;
  beatIndex: number;
  activeGesture: AgentGesture;
  previousGesture: AgentGesture;
  previousText: string;
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const contains = (text: string, pattern: RegExp) => pattern.test(text);
const smoothstep = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

export function inferAgentGesture(text: string, emotion: Emotion): AgentGesture {
  const normalized = text.trim().toLowerCase();

  if (
    contains(normalized, /[?؟]/) ||
    contains(normalized, /\b(why|how|what|when|where|who|can|could|would|do|does|is|are)\b/) ||
    contains(normalized, /(?:^|\s)(هل|ليه|لماذا|ازاي|إزاي|كيف|متى|فين|أين|مين)(?:\s|$)/)
  ) return 'question';

  if (
    contains(normalized, /!{1,}/) ||
    contains(normalized, /\b(important|must|exactly|definitely|really|key point|the point is)\b/) ||
    contains(normalized, /(?:مهم|لازم|بالظبط|بالضبط|فعلاً|فعلا|جداً|جدا|النقطة)/) ||
    emotion === 'excited'
  ) return 'emphasis';

  if (
    contains(normalized, /\b(don't worry|do not worry|no problem|of course|sure|absolutely|we can|it's okay|it is okay|sorry)\b/) ||
    contains(normalized, /(?:متقلقش|ما تقلقش|مافيش مشكلة|مفيش مشكلة|طبعاً|طبعا|أكيد|اكيد|هنقدر|نقدر|آسف|اسف)/)
  ) return 'reassure';

  if (
    contains(normalized, /\b(first|second|third|because|so|basically|for example|for instance|step|then|means|in other words)\b/) ||
    contains(normalized, /(?:أول|اولا|أولاً|ثاني|ثانياً|ثانيا|لأن|علشان|يعني|ببساطة|مثلاً|مثلا|خطوة|بعد كده|بمعنى)/)
  ) return 'explain';

  if (
    contains(normalized, /\b(great|awesome|amazing|love|lovely|glad|perfect|nice|wonderful|excellent)\b/) ||
    contains(normalized, /(?:جميل|حلو|عظيم|جامد|ممتاز|رائع|مبسوط|فرحان|حبيبي|تمام أوي|تمام اوي)/) ||
    emotion === 'happy'
  ) return 'warm';

  return 'conversational';
}

export function createAgentMotionState(): AgentMotionState {
  return {
    smoothedEnergy: 0,
    previousEnergy: 0,
    wasSpeaking: false,
    lastBeatAt: -10_000,
    beatStartedAt: -10_000,
    beatDurationMs: 720,
    beatStrength: 0,
    beatSide: 1,
    beatIndex: 0,
    activeGesture: 'conversational',
    previousGesture: 'conversational',
    previousText: '',
  };
}

function chooseSide(index: number): -1 | 1 {
  // Deliberately non-alternating so the character does not look metronomic.
  const sequence: Array<-1 | 1> = [1, 1, -1, 1, -1, -1, 1];
  return sequence[index % sequence.length];
}

function triggerBeat(
  state: AgentMotionState,
  nowMs: number,
  rawEnergy: number,
  gesture: AgentGesture,
  onset = false,
) {
  state.beatIndex += 1;
  state.beatSide = chooseSide(state.beatIndex);
  state.lastBeatAt = nowMs;
  state.beatStartedAt = nowMs;
  state.activeGesture = gesture;
  state.beatDurationMs = gesture === 'emphasis' ? 620 : gesture === 'question' ? 820 : 740;
  const base = onset ? 0.42 : 0.5;
  state.beatStrength = clamp(base + rawEnergy * 0.55, 0.38, 0.95);
}

function gestureEnvelope(state: AgentMotionState, nowMs: number) {
  const age = nowMs - state.beatStartedAt;
  if (age < 0 || age >= state.beatDurationMs) return 0;
  const progress = age / state.beatDurationMs;

  // Quick attack, a short readable hold, then a longer release back to neutral.
  if (progress < 0.22) return smoothstep(progress / 0.22) * state.beatStrength;
  if (progress < 0.5) return state.beatStrength;
  return (1 - smoothstep((progress - 0.5) / 0.5)) * state.beatStrength;
}

function newPunctuationArrived(previous: string, current: string) {
  if (!current || current === previous) return false;
  const fresh = current.startsWith(previous) ? current.slice(previous.length) : current;
  return /[,.!?؟،؛:]/.test(fresh);
}

export function stepAgentMotion(input: AgentMotionInput, state: AgentMotionState): AgentMotionOffsets {
  const nowMs = input.nowMs;
  const dt = clamp(input.dtSeconds, 0.001, 0.05);
  const strength = clamp(input.strength, 0, 1.5);
  const rawEnergy = input.speaking ? clamp(input.energy, 0, 1) : 0;
  const energyFollow = 1 - Math.exp(-dt * (input.speaking ? 8 : 4));
  state.smoothedEnergy += (rawEnergy - state.smoothedEnergy) * energyFollow;

  const gesture = inferAgentGesture(input.text, input.emotion);
  const speechOnset = input.speaking && !state.wasSpeaking;
  const semanticChange = input.speaking && gesture !== state.previousGesture;
  const punctuationBeat = input.speaking && newPunctuationArrived(state.previousText, input.text);
  const risingEnergy = rawEnergy - state.previousEnergy;
  const strongEnergyPeak = rawEnergy > 0.42 && risingEnergy > 0.075;
  const cooldown = input.emotion === 'excited' ? 620 : 820;
  const canBeat = nowMs - state.lastBeatAt > cooldown;

  if (speechOnset) {
    // One small acknowledgement at speech onset. No continuous movement follows it.
    triggerBeat(state, nowMs, Math.max(rawEnergy, 0.2), gesture, true);
  } else if (canBeat && (semanticChange || punctuationBeat || strongEnergyPeak)) {
    triggerBeat(state, nowMs, rawEnergy, gesture);
  }

  if (!input.speaking && state.wasSpeaking) {
    state.beatStrength = 0;
  }

  state.wasSpeaking = input.speaking;
  state.previousEnergy = rawEnergy;
  state.previousGesture = gesture;
  state.previousText = input.text;

  const beat = gestureEnvelope(state, nowMs);
  const activeGesture = beat > 0 ? state.activeGesture : gesture;
  const side = state.beatSide;

  // Neutral is intentionally still. Rive's authored idle can own breathing/blinks.
  let bodyY = 0;
  let bodyLean = 0;
  let headY = 0;
  let headTilt = 0;
  let leftHandX = 0;
  let leftHandY = 0;
  let rightHandX = 0;
  let rightHandY = 0;
  let eyeScale = 0;
  let browY = 0;

  if (beat > 0 && input.speaking) {
    switch (activeGesture) {
      case 'question': {
        headTilt = side * 0.034 * beat;
        eyeScale = 0.045 * beat;
        browY = -3.2 * beat;
        if (side < 0) {
          leftHandX = -10 * beat;
          leftHandY = -18 * beat;
        } else {
          rightHandX = 10 * beat;
          rightHandY = -18 * beat;
        }
        break;
      }
      case 'explain': {
        bodyLean = 0.01 * beat;
        headTilt = side * 0.009 * beat;
        browY = -1.4 * beat;
        if (side < 0) {
          leftHandX = -17 * beat;
          leftHandY = -24 * beat;
        } else {
          rightHandX = 17 * beat;
          rightHandY = -24 * beat;
        }
        break;
      }
      case 'emphasis': {
        bodyLean = 0.018 * beat;
        headY = -1.2 * beat;
        eyeScale = 0.025 * beat;
        browY = -2.3 * beat;
        leftHandX = -7 * beat;
        rightHandX = 7 * beat;
        leftHandY = -16 * beat;
        rightHandY = -16 * beat;
        break;
      }
      case 'reassure': {
        headTilt = side * 0.01 * beat;
        eyeScale = -0.018 * beat;
        browY = 0.8 * beat;
        if (side < 0) {
          leftHandX = 6 * beat;
          leftHandY = -12 * beat;
        } else {
          rightHandX = -6 * beat;
          rightHandY = -12 * beat;
        }
        break;
      }
      case 'warm': {
        headTilt = side * 0.009 * beat;
        eyeScale = -0.025 * beat;
        browY = -0.8 * beat;
        // Soft open posture, but no vertical bouncing.
        leftHandX = -5 * beat;
        rightHandX = 5 * beat;
        leftHandY = -8 * beat;
        rightHandY = -8 * beat;
        break;
      }
      default: {
        // Normal speech should mostly stay still. Only some beats get a tiny one-hand cue.
        headY = -0.7 * beat;
        if (state.beatIndex % 3 === 0) {
          if (side < 0) {
            leftHandX = -6 * beat;
            leftHandY = -9 * beat;
          } else {
            rightHandX = 6 * beat;
            rightHandY = -9 * beat;
          }
        }
      }
    }
  }

  const emotionScale = input.emotion === 'excited' ? 1.08 : input.emotion === 'happy' ? 1.02 : 0.96;
  const scale = strength * emotionScale;
  const faceScale = Math.min(1.05, strength);

  return {
    bodyY: bodyY * scale,
    bodyLean: bodyLean * scale,
    headY: headY * scale,
    headTilt: headTilt * scale,
    leftHandX: leftHandX * scale,
    leftHandY: leftHandY * scale,
    rightHandX: rightHandX * scale,
    rightHandY: rightHandY * scale,
    eyeScale: eyeScale * faceScale,
    browY: browY * faceScale,
    gesture,
    beat,
    energy: state.smoothedEnergy,
  };
}
