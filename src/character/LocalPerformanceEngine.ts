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

const gestureFor = (affect: CharacterAffect): CharacterGesture => {
  if (affect === 'reassuring' || affect === 'concerned') return 'reassure';
  if (affect === 'thoughtful') return 'think';
  if (affect === 'enthusiastic') return 'explain';
  if (affect === 'curious') return 'explain';
  if (affect === 'playful') return 'emphasize';
  if (affect === 'surprised') return 'emphasize';
  return 'none';
};

/**
 * Provider-independent acting brain.
 * Transcript meaning may select an occasional major gesture; raw prosody only
 * drives micro movement. Explicit model tools are rare overrides and may arrive
 * before or during playback, so they are protected briefly from local refinement.
 */
export class LocalPerformanceEngine {
  private mode: CharacterMode = 'idle';
  private outputText = '';
  private inputText = '';
  private semantic: SemanticSignal = { affect: 'neutral', confidence: 0, question: false };
  private speechClock = 0;
  private semanticCueCooldown = 0;
  private majorGestureCooldown = 0;
  private toolOverrideSeconds = 0;
  private energyAverage = 0;
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
      this.toolOverrideSeconds = 0;
    }
    if (mode === 'listening') this.emitListeningPresence();
  }

  pushOutputTranscript(text: string) {
    this.outputText = mergeIncrementalText(this.outputText, text);
    const recent = this.outputText.slice(-220);
    const next = classifySemantic(recent);
    if (next.confidence >= 0.44 || this.semantic.confidence < 0.44) this.semantic = next;
  }

  pushInputTranscript(text: string) {
    this.inputText = mergeIncrementalText(this.inputText, text);
  }

  beginSpeech(toolCue?: PerformanceCue | null) {
    this.mode = 'speaking';
    this.speechClock = 0;
    this.started = true;
    this.semanticCueCooldown = 0.5;
    this.majorGestureCooldown = 1.1;
    this.toolOverrideSeconds = 0;

    if (toolCue) {
      this.applyToolCue(toolCue, 'tool cue synchronized to playback start');
      return;
    }

    const affect = this.semantic.affect;
    this.callbacks.onCue({
      affect,
      intensity: clamp(0.32 + this.semantic.confidence * 0.34, 0.28, 0.64),
      gesture: 'none',
      posture: postureFor(affect),
      gaze: affect === 'thoughtful' ? 'thinking_side' : 'user',
    }, 'local', 'speech-start semantic baseline');
  }

  /** Execute a rare explicit stage direction even if Gemini sends it after audio starts. */
  applyToolCue(cue: PerformanceCue, reason = 'tool cue arrived during playback') {
    this.lastGesture = cue.gesture;
    this.majorGestureCooldown = cue.gesture === 'none' ? 1.5 : 4.5;
    this.toolOverrideSeconds = cue.gesture === 'none' ? 1.2 : 2.8;
    this.callbacks.onCue(cue, 'tool', reason);
  }

  endSpeech() {
    this.started = false;
    this.speechClock = 0;
    this.outputText = '';
    this.semantic = { affect: 'neutral', confidence: 0, question: false };
    this.majorGestureCooldown = 0;
    this.semanticCueCooldown = 0;
    this.toolOverrideSeconds = 0;
  }

  updateSpeech(dynamics: SpeechDynamics, deltaSeconds = 0.03) {
    if (!this.started) this.beginSpeech();
    this.speechClock += deltaSeconds;
    this.semanticCueCooldown = Math.max(0, this.semanticCueCooldown - deltaSeconds);
    this.majorGestureCooldown = Math.max(0, this.majorGestureCooldown - deltaSeconds);
    this.toolOverrideSeconds = Math.max(0, this.toolOverrideSeconds - deltaSeconds);
    this.energyAverage += (dynamics.energy - this.energyAverage) * 0.12;

    // Do not let an automatic transcript refinement cancel a deliberate tool
    // gesture halfway through its readable hold/settle phase.
    if (this.toolOverrideSeconds > 0) return;

    if (this.semanticCueCooldown <= 0 && this.semantic.confidence > 0.58) {
      const semanticGesture = this.majorGestureCooldown <= 0 ? gestureFor(this.semantic.affect) : 'none';
      const gesture = semanticGesture === this.lastGesture ? 'none' : semanticGesture;
      this.callbacks.onCue({
        affect: this.semantic.affect,
        intensity: clamp(0.38 + this.semantic.confidence * 0.36 + this.energyAverage * 0.08),
        gesture,
        posture: postureFor(this.semantic.affect),
        gaze: this.semantic.affect === 'thoughtful' ? 'thinking_side' : 'user',
      }, 'local', gesture === 'none' ? 'transcript affect refinement' : 'semantic phrase gesture');

      if (gesture !== 'none') {
        this.lastGesture = gesture;
        this.majorGestureCooldown = 4.8;
      }
      this.semanticCueCooldown = 1.8;
    }

    void dynamics;
  }

  private emitListeningPresence() {
    const userSemantic = classifySemantic(this.inputText.slice(-220));
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
