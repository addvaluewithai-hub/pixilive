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
  speechStartedAt: number;
  lastBeatAt: number;
  beatStartedAt: number;
  beatDurationMs: number;
  beatStrength: number;
  beatSide: -1 | 1;
  beatIndex: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const contains = (text: string, pattern: RegExp) => pattern.test(text);

export function inferAgentGesture(text: string, emotion: Emotion): AgentGesture {
  const normalized = text.trim().toLowerCase();

  if (
    contains(normalized, /[?؟]/) ||
    contains(normalized, /\b(why|how|what|when|where|who|can|could|would|do|does|is|are)\b/) ||
    contains(normalized, /(?:^|\s)(هل|ليه|لماذا|ازاي|إزاي|كيف|متى|فين|أين|مين)(?:\s|$)/)
  ) {
    return 'question';
  }

  if (
    contains(normalized, /!{1,}/) ||
    contains(normalized, /\b(important|must|exactly|definitely|really|key point|the point is)\b/) ||
    contains(normalized, /(?:مهم|لازم|بالظبط|بالضبط|فعلاً|فعلا|جداً|جدا|النقطة)/) ||
    emotion === 'excited'
  ) {
    return 'emphasis';
  }

  if (
    contains(normalized, /\b(don't worry|do not worry|no problem|of course|sure|absolutely|we can|it's okay|it is okay|sorry)\b/) ||
    contains(normalized, /(?:متقلقش|ما تقلقش|مافيش مشكلة|مفيش مشكلة|طبعاً|طبعا|أكيد|اكيد|هنقدر|نقدر|آسف|اسف)/)
  ) {
    return 'reassure';
  }

  if (
    contains(normalized, /\b(first|second|third|because|so|basically|for example|for instance|step|then|means|in other words)\b/) ||
    contains(normalized, /(?:أول|اولا|أولاً|ثاني|ثانياً|ثانيا|لأن|علشان|يعني|ببساطة|مثلاً|مثلا|خطوة|بعد كده|بمعنى)/)
  ) {
    return 'explain';
  }

  if (
    contains(normalized, /\b(great|awesome|amazing|love|lovely|glad|perfect|nice|wonderful|excellent)\b/) ||
    contains(normalized, /(?:جميل|حلو|عظيم|جامد|ممتاز|رائع|مبسوط|فرحان|حبيبي|تمام أوي|تمام اوي)/) ||
    emotion === 'happy'
  ) {
    return 'warm';
  }

  return 'conversational';
}

export function createAgentMotionState(): AgentMotionState {
  return {
    smoothedEnergy: 0,
    previousEnergy: 0,
    wasSpeaking: false,
    speechStartedAt: 0,
    lastBeatAt: -10_000,
    beatStartedAt: -10_000,
    beatDurationMs: 430,
    beatStrength: 0,
    beatSide: -1,
    beatIndex: 0,
  };
}

function triggerBeat(state: AgentMotionState, nowMs: number, rawEnergy: number, emotion: Emotion) {
  state.beatIndex += 1;
  state.beatSide = state.beatSide === -1 ? 1 : -1;
  state.lastBeatAt = nowMs;
  state.beatStartedAt = nowMs;
  state.beatDurationMs = emotion === 'excited' ? 360 : emotion === 'calm' ? 470 : 420;
  state.beatStrength = clamp(0.48 + rawEnergy * 0.72, 0.48, 1.2);
}

export function stepAgentMotion(input: AgentMotionInput, state: AgentMotionState): AgentMotionOffsets {
  const nowMs = input.nowMs;
  const dt = clamp(input.dtSeconds, 0.001, 0.05);
  const strength = clamp(input.strength, 0, 1.5);
  const rawEnergy = input.speaking ? clamp(input.energy, 0, 1) : 0;
  const energyFollow = 1 - Math.exp(-dt * (input.speaking ? 11 : 5));
  state.smoothedEnergy += (rawEnergy - state.smoothedEnergy) * energyFollow;

  const speechOnset = input.speaking && !state.wasSpeaking;
  if (speechOnset) {
    state.speechStartedAt = nowMs;
    state.lastBeatAt = nowMs - 900;
    triggerBeat(state, nowMs, Math.max(rawEnergy, 0.28), input.emotion);
  }

  if (!input.speaking && state.wasSpeaking) {
    state.beatStrength = 0;
  }

  const risingEnergy = rawEnergy - state.previousEnergy;
  const beatCooldown = input.emotion === 'excited' ? 330 : 430;
  const overdueBeat = input.speaking && nowMs - state.lastBeatAt > 860 && state.smoothedEnergy > 0.07;
  const energyPeak = rawEnergy > 0.18 && risingEnergy > 0.035;
  if (input.speaking && nowMs - state.lastBeatAt > beatCooldown && (energyPeak || overdueBeat)) {
    triggerBeat(state, nowMs, rawEnergy, input.emotion);
  }

  state.wasSpeaking = input.speaking;
  state.previousEnergy = rawEnergy;

  const beatAge = nowMs - state.beatStartedAt;
  const beatProgress = clamp(beatAge / Math.max(1, state.beatDurationMs));
  const beatEnvelope = beatAge >= 0 && beatProgress < 1
    ? Math.pow(Math.sin(Math.PI * beatProgress), 1.15) * state.beatStrength
    : 0;

  const gesture = inferAgentGesture(input.text, input.emotion);
  const phase = nowMs / 1000;
  const speechEnergy = input.speaking ? clamp(0.14 + state.smoothedEnergy * 1.25) : 0;
  const breath = Math.sin(phase * 1.35) * (input.speaking ? 0.8 : 1.35);
  const speechRhythm = Math.sin(phase * 2.6 + 0.7) * speechEnergy;
  const engagement = input.speaking ? clamp((nowMs - state.speechStartedAt) / 240) : 0;
  const side = state.beatSide;

  let bodyY = breath + speechRhythm * 1.15 - speechEnergy * 1.1;
  let bodyLean = Math.sin(phase * 0.82) * 0.006 * speechEnergy;
  let headY = -speechEnergy * 1.8 + Math.sin(phase * 2.15 + 0.4) * 0.8 * speechEnergy;
  let headTilt = Math.sin(phase * 1.08 + 1.2) * 0.014 * (0.35 + speechEnergy);
  let leftHandX = 0;
  let leftHandY = 0;
  let rightHandX = 0;
  let rightHandY = 0;
  let eyeScale = 0;
  let browY = 0;

  if (input.speaking) bodyLean += 0.012 * engagement;

  switch (gesture) {
    case 'question': {
      headTilt += (0.038 + 0.018 * beatEnvelope) * side;
      bodyLean += 0.012 * engagement;
      eyeScale += 0.035 + 0.025 * beatEnvelope;
      browY -= 2.5 + 2.5 * beatEnvelope;
      if (side < 0) {
        leftHandX -= 14 * beatEnvelope;
        leftHandY -= 28 * beatEnvelope;
        rightHandY -= 5 * beatEnvelope;
      } else {
        rightHandX += 14 * beatEnvelope;
        rightHandY -= 28 * beatEnvelope;
        leftHandY -= 5 * beatEnvelope;
      }
      break;
    }
    case 'explain': {
      headTilt += side * 0.014 * beatEnvelope;
      bodyLean += 0.01 * speechEnergy;
      browY -= 1.8 * beatEnvelope;
      if (side < 0) {
        leftHandX -= 20 * beatEnvelope;
        leftHandY -= 34 * beatEnvelope;
        rightHandY -= 7 * beatEnvelope;
      } else {
        rightHandX += 20 * beatEnvelope;
        rightHandY -= 34 * beatEnvelope;
        leftHandY -= 7 * beatEnvelope;
      }
      break;
    }
    case 'emphasis': {
      bodyY -= 2.5 * beatEnvelope;
      bodyLean += 0.025 * beatEnvelope;
      headY -= 3.5 * beatEnvelope;
      headTilt += side * 0.024 * beatEnvelope;
      eyeScale += 0.05 * beatEnvelope;
      browY -= 3.5 * beatEnvelope;
      leftHandX -= 11 * beatEnvelope;
      rightHandX += 11 * beatEnvelope;
      leftHandY -= 26 * beatEnvelope;
      rightHandY -= 26 * beatEnvelope;
      break;
    }
    case 'reassure': {
      bodyLean -= 0.006 * speechEnergy;
      headTilt += side * 0.011 * beatEnvelope;
      eyeScale -= 0.025 * speechEnergy;
      browY += 1.2 * speechEnergy;
      if (side < 0) {
        leftHandX += 10 * beatEnvelope;
        leftHandY -= 20 * beatEnvelope;
        rightHandY -= 4 * beatEnvelope;
      } else {
        rightHandX -= 10 * beatEnvelope;
        rightHandY -= 20 * beatEnvelope;
        leftHandY -= 4 * beatEnvelope;
      }
      break;
    }
    case 'warm': {
      bodyLean += 0.008 * engagement;
      headTilt += side * 0.012 * beatEnvelope;
      eyeScale -= 0.045 * (0.35 + beatEnvelope);
      browY -= 1.2 * beatEnvelope;
      leftHandX -= 8 * beatEnvelope;
      rightHandX += 8 * beatEnvelope;
      leftHandY -= 15 * beatEnvelope;
      rightHandY -= 15 * beatEnvelope;
      break;
    }
    default: {
      headTilt += side * 0.012 * beatEnvelope;
      browY -= 1.1 * beatEnvelope;
      if (side < 0) {
        leftHandX -= 10 * beatEnvelope;
        leftHandY -= 20 * beatEnvelope;
        rightHandY -= 4 * beatEnvelope;
      } else {
        rightHandX += 10 * beatEnvelope;
        rightHandY -= 20 * beatEnvelope;
        leftHandY -= 4 * beatEnvelope;
      }
    }
  }

  const emotionScale = input.emotion === 'excited' ? 1.22 : input.emotion === 'happy' ? 1.08 : input.emotion === 'curious' ? 1.04 : 0.92;
  const scale = strength * emotionScale;
  const faceScale = Math.min(1.15, strength);

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
    beat: beatEnvelope,
    energy: state.smoothedEnergy,
  };
}
