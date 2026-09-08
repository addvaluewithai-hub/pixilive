import type { SpeechDynamics } from '../audio/SpeechProsodyAnalyzer';
import {
  neutralPerformanceCue,
  type CharacterAffect,
  type CharacterGesture,
  type CharacterMode,
  type PerformanceCue,
} from './performance';

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

interface SemanticSignal {
  affect: CharacterAffect;
  confidence: number;
  question: boolean;
}

export type PerformanceCueSource = 'local' | 'tool';

export interface LocalPerformanceCallbacks {
  onCue: (cue: PerformanceCue, source: PerformanceCueSource, reason: string) => void;
}

const semanticLexicon: Array<{ affect: CharacterAffect; words: RegExp }> = [
  { affect: 'enthusiastic', words: /\b(amazing|awesome|fantastic|great|excellent|love it|perfect|brilliant)\b|(?:رائع|ممتاز|جامد|عظيم|تحفة|حلو جدا)/iu },
  { affect: 'surprised', words: /\b(wow|really|seriously|no way|wait)\b|(?:واو|بجد|معقول|استنى|لحظة)/iu },
  { affect: 'reassuring', words: /\b(don't worry|no worries|it'?s okay|you can|we can fix|all good)\b|(?:متقلقش|ما تقلقش|عادي|هنحل|نقدر نحل|تمام)/iu },
  { affect: 'concerned', words: /\b(sorry|unfortunately|problem|issue|risk|careful|concern)\b|(?:آسف|للأسف|مشكلة|خطر|خلي بالك|قلق)/iu },
  { affect: 'thoughtful', words: /\b(i think|maybe|perhaps|probably|let me think|it depends)\b|(?:أعتقد|ممكن|يمكن|غالبا|خليني أفكر|يعتمد)/iu },
  { affect: 'playful', words: /(?:😂|🤣|😄|ههه|هههه)|\b(haha|funny|kidding|joking)\b/iu },
  { affect: 'curious', words: /\b(why|how|what if|wonder|interesting)\b|(?:ليه|إزاي|ازاي|ماذا لو|مثير|غريب)/iu },
  { affect: 'warm', words: /\b(thank you|thanks|glad|happy to|of course|absolutely)\b|(?:شكرا|تسلم|سعيد|أكيد|طبعا)/iu },
];

const mergeIncrementalText = (current: string, incoming: string) => {
  const text = incoming.trim();
  if (!text) return current;
  if (!current) return text;
  if (text.startsWith(current)) return text;
  if (current.endsWith(text)) return current;

  const max = Math.min(current.length, text.length);
  for (let overlap = max; overlap > 0; overlap -= 1) {
    if (current.slice(-overlap) === text.slice(0, overlap)) return current + text.slice(overlap);
  }
  return `${current} ${text}`.trim();
};

const classifySemantic = (text: string): SemanticSignal => {
  const trimmed = text.trim();
  if (!trimmed) return { affect: 'neutral', confidence: 0, question: false };
  const question = /[?؟]/u.test(trimmed) || /^(why|how|what|when|where|who|ليه|ازاي|إزاي|ايه|إيه)\b/iu.test(trimmed);

  for (const item of semanticLexicon) {
    if (item.words.test(trimmed)) return { affect: item.affect, confidence: 0.82, question };
  }
  if (question) return { affect: 'curious', confidence: 0.58, question: true };
  if (/[!！]{1,3}$/u.test(trimmed)) return { affect: 'enthusiastic', confidence: 0.44, question };
  return { affect: 'neutral', confidence: 0.18, question };
};

const postureFor = (affect: CharacterAffect): PerformanceCue['posture'] => {
  if (affect === 'reassuring' || affect === 'concerned') return 'lean_in';
  if (affect === 'enthusiastic' || affect === 'playful') return 'open';
  if (affect === 'thoughtful') return 'lean_back';
  if (affect === 'curious' || affect === 'surprised') return 'engaged';
  return 'neutral';
};

/**
 * Character-level acting brain independent of the LLM provider.
 * It combines playback-synchronous prosody, transcript semantics, and turn state.
 * The LLM tool can still override it, but ordinary acting never depends on a tool.
 */
export class LocalPerformanceEngine {
  private mode: CharacterMode = 'idle';
  private outputText = '';
  private inputText = '';
  private semantic: SemanticSignal = { affect: 'neutral', confidence: 0, question: false };
  private speechClock = 0;
  private cueCooldown = 0;
  private gestureCooldown = 0;
  private sequence = 0;
  private energyAverage = 0;
  private pitchAverage = 0.35;
  private started = false;
  private lastGesture: CharacterGesture = 'none';

  constructor(private readonly callbacks: LocalPerformanceCallbacks) {}

  setMode(mode: CharacterMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode !== 'speaking') {
      this.started = false;
      this.speechClock = 0;
      this.energyAverage = 0;
    }
    if (mode === 'listening') this.emitListeningPresence();
  }

  pushOutputTranscript(text: string) {
    this.outputText = mergeIncrementalText(this.outputText, text);
    this.semantic = classifySemantic(this.outputText);
  }

  pushInputTranscript(text: string) {
    this.inputText = mergeIncrementalText(this.inputText, text);
  }

  beginSpeech(toolCue?: PerformanceCue | null) {
    this.mode = 'speaking';
    this.speechClock = 0;
    this.started = true;
    this.cueCooldown = 0.45;

    if (toolCue) {
      this.lastGesture = toolCue.gesture;
      this.gestureCooldown = toolCue.gesture === 'none' ? 0.8 : 1.8;
      this.callbacks.onCue(toolCue, 'tool', 'tool cue synchronized to playback start');
      return;
    }

    const affect = this.semantic.affect;
    const intensity = clamp(0.34 + this.semantic.confidence * 0.35, 0.3, 0.68);
    this.callbacks.onCue({
      affect,
      intensity,
      gesture: 'none',
      posture: postureFor(affect),
      gaze: affect === 'thoughtful' ? 'thinking_side' : 'user',
    }, 'local', 'speech-start semantic baseline');
  }

  endSpeech() {
    this.started = false;
    this.speechClock = 0;
    this.outputText = '';
    this.semantic = { affect: 'neutral', confidence: 0, question: false };
    this.gestureCooldown = 0;
    this.cueCooldown = 0;
  }

  updateSpeech(dynamics: SpeechDynamics, deltaSeconds = 0.03) {
    if (!this.started) this.beginSpeech();
    this.speechClock += deltaSeconds;
    this.cueCooldown = Math.max(0, this.cueCooldown - deltaSeconds);
    this.gestureCooldown = Math.max(0, this.gestureCooldown - deltaSeconds);
    this.energyAverage += (dynamics.energy - this.energyAverage) * 0.18;
    this.pitchAverage += (dynamics.pitchNorm - this.pitchAverage) * 0.12;

    if (this.cueCooldown <= 0 && this.semantic.confidence > 0.58 && this.speechClock < 1.4) {
      this.callbacks.onCue({
        affect: this.semantic.affect,
        intensity: clamp(0.4 + this.semantic.confidence * 0.42 + this.energyAverage * 0.12),
        gesture: 'none',
        posture: postureFor(this.semantic.affect),
        gaze: this.semantic.affect === 'thoughtful' ? 'thinking_side' : 'user',
      }, 'local', 'transcript affect refinement');
      this.cueCooldown = 1.5;
    }

    const strongBeat = dynamics.onset > 0.34 || (dynamics.energy > 0.63 && dynamics.energy > this.energyAverage + 0.08);
    if (!strongBeat || this.gestureCooldown > 0 || this.speechClock < 0.32) return;

    const gesture = this.chooseGesture(dynamics);
    if (gesture === 'none') {
      this.gestureCooldown = 0.65;
      return;
    }

    const affect = this.resolveAffectFromProsody(dynamics);
    const intensity = clamp(0.42 + dynamics.energy * 0.38 + dynamics.onset * 0.18, 0.42, 0.9);
    this.callbacks.onCue({
      affect,
      intensity,
      gesture,
      posture: postureFor(affect),
      gaze: affect === 'thoughtful' ? 'thinking_side' : 'user',
    }, 'local', `prosodic beat: energy=${dynamics.energy.toFixed(2)} pitch=${dynamics.pitchNorm.toFixed(2)}`);

    this.lastGesture = gesture;
    this.gestureCooldown = gesture === 'emphasize' ? 1.1 : 1.8;
    this.cueCooldown = 1.1;
  }

  private resolveAffectFromProsody(dynamics: SpeechDynamics): CharacterAffect {
    if (this.semantic.confidence >= 0.55) return this.semantic.affect;
    if (dynamics.energy > 0.72 && dynamics.pitchNorm > 0.55) return 'enthusiastic';
    if (dynamics.pitchDelta > 0.28 && dynamics.pitchNorm > 0.5) return 'curious';
    if (dynamics.energy < 0.34 && dynamics.voiced > 0.35) return 'thoughtful';
    if (dynamics.brightness > 0.72 && dynamics.energy > 0.5) return 'playful';
    return 'neutral';
  }

  private chooseGesture(dynamics: SpeechDynamics): CharacterGesture {
    this.sequence += 1;
    const semantic = this.semantic.affect;

    if (semantic === 'reassuring' || semantic === 'concerned') return this.lastGesture === 'reassure' ? 'emphasize' : 'reassure';
    if (semantic === 'thoughtful' && this.speechClock < 2.4) return this.lastGesture === 'think' ? 'emphasize' : 'think';
    if (semantic === 'surprised') return 'emphasize';
    if (semantic === 'enthusiastic' && dynamics.energy > 0.72 && this.speechClock < 1.6 && this.sequence % 4 === 0) return 'celebrate';
    if (semantic === 'enthusiastic' || semantic === 'curious') return this.lastGesture === 'explain' ? 'emphasize' : 'explain';
    if (semantic === 'playful') return this.sequence % 3 === 0 ? 'shrug' : 'emphasize';

    // Neutral speech should often remain still. Gesture only on genuinely strong beats.
    if (dynamics.onset > 0.58 && dynamics.energy > 0.56 && this.sequence % 2 === 0) return 'emphasize';
    return 'none';
  }

  private emitListeningPresence() {
    const userSemantic = classifySemantic(this.inputText);
    const affect = userSemantic.confidence > 0.55 ? userSemantic.affect : 'warm';
    this.callbacks.onCue({
      ...neutralPerformanceCue,
      affect: affect === 'enthusiastic' ? 'curious' : affect,
      intensity: 0.28,
      gesture: 'none',
      posture: 'engaged',
      gaze: 'user',
    }, 'local', 'listening presence');
    this.inputText = '';
  }
}
