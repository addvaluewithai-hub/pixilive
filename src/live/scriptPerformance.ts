import type {
  CharacterActionName,
  CharacterExpressionCue,
  CharacterExpressionName,
  CharacterPace,
} from './types';
import type { PlaybackClockSnapshot } from '../audio/PcmPlaybackQueue';

export type ScriptPerformanceCue =
  | { kind: 'expression'; value: CharacterExpressionName; intensity: number; energy: number }
  | { kind: 'action'; value: CharacterActionName }
  | { kind: 'pace'; value: CharacterPace };

export interface ScriptPerformanceBeat {
  index: number;
  text: string;
  cues: ScriptPerformanceCue[];
  triggerAnchor: string;
}

export interface ParsedPerformanceScript {
  source: string;
  beats: ScriptPerformanceBeat[];
  spokenText: string;
}

interface DirectorCallbacks {
  onExpression: (cue: CharacterExpressionCue) => void;
  onAction: (action: CharacterActionName) => void;
  onPace: (pace: CharacterPace) => void;
  onCue: (label: string) => void;
  getPlaybackClock: () => PlaybackClockSnapshot | null;
  scheduleAtPlaybackTime: (audioTimeSeconds: number, callback: () => void) => void;
}

const EXPRESSIONS = new Set<CharacterExpressionName>([
  'happy',
  'sad',
  'crying',
  'surprised',
  'thinking',
  'angry',
  'sleepy',
  'laughing',
  'excited',
]);

const ACTIONS = new Set<CharacterActionName>(['wave', 'blink', 'jump']);
const PACES = new Set<CharacterPace>(['idle', 'walk', 'run']);

const EXPRESSION_DEFAULTS: Record<CharacterExpressionName, Pick<CharacterExpressionCue, 'intensity' | 'energy'>> = {
  happy: { intensity: 0.88, energy: 0.62 },
  sad: { intensity: 0.9, energy: 0.24 },
  crying: { intensity: 1, energy: 0.2 },
  surprised: { intensity: 1, energy: 0.78 },
  thinking: { intensity: 0.88, energy: 0.35 },
  angry: { intensity: 0.9, energy: 0.58 },
  sleepy: { intensity: 0.92, energy: 0.14 },
  laughing: { intensity: 1, energy: 0.86 },
  excited: { intensity: 1, energy: 0.92 },
};

export const normalizePerformanceText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[“”"'`،؛؟!.,:;(){}<>…\-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tailAnchor = (text: string) => {
  const words = normalizePerformanceText(text).split(' ').filter(Boolean);
  return words.slice(-Math.min(3, words.length)).join(' ');
};

const speechWeight = (text: string) => {
  const normalized = normalizePerformanceText(text);
  const wordCount = normalized ? normalized.split(' ').length : 1;
  const punctuationPauses = (text.match(/[.!?؟…]/g) ?? []).length * 1.5;
  return Math.max(1, wordCount + punctuationPauses);
};

const parseTag = (rawTag: string): ScriptPerformanceCue => {
  const tag = rawTag.trim().toLowerCase();

  if (tag.startsWith('pace:')) {
    const pace = tag.slice('pace:'.length).trim() as CharacterPace;
    if (!PACES.has(pace)) throw new Error(`Unknown pace tag: [${rawTag}]`);
    return { kind: 'pace', value: pace };
  }

  const expression = tag as CharacterExpressionName;
  if (EXPRESSIONS.has(expression)) {
    const defaults = EXPRESSION_DEFAULTS[expression];
    return { kind: 'expression', value: expression, ...defaults };
  }

  const action = tag as CharacterActionName;
  if (ACTIONS.has(action)) return { kind: 'action', value: action };

  throw new Error(`Unknown performance tag: [${rawTag}]`);
};

export function parsePerformanceScript(source: string): ParsedPerformanceScript {
  const beats: Array<Omit<ScriptPerformanceBeat, 'index' | 'triggerAnchor'>> = [];
  const tagPattern = /\[([^\]]+)\]/g;
  let pendingCues: ScriptPerformanceCue[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  const pushText = (text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    beats.push({ text: clean, cues: pendingCues });
    pendingCues = [];
  };

  while ((match = tagPattern.exec(source))) {
    pushText(source.slice(cursor, match.index));
    pendingCues.push(parseTag(match[1]));
    cursor = match.index + match[0].length;
  }
  pushText(source.slice(cursor));

  if (!beats.length) throw new Error('The performance script has no spoken text.');
  if (!beats.some((beat) => beat.cues.length)) {
    throw new Error('Add at least one performance tag such as [happy] or [surprised].');
  }

  const finalized = beats.map((beat, index): ScriptPerformanceBeat => ({
    ...beat,
    index,
    triggerAnchor: index === 0 ? '' : tailAnchor(beats[index - 1].text),
  }));

  return {
    source,
    beats: finalized,
    spokenText: finalized.map((beat) => beat.text).join(' '),
  };
}

export function buildScriptPerformancePrompt(script: ParsedPerformanceScript) {
  return `[SCRIPTED PERFORMANCE]\nRead the tagged Arabic story below as ONE continuous spoken turn.\n\nRULES:\n- Bracketed tags are silent acting directions. NEVER pronounce, describe, translate, or spell the tags.\n- Do NOT call character stage tools while reading this scripted performance; the host application executes the visual tags itself.\n- Read every non-tagged story sentence in the exact written order. Do not paraphrase, skip, add, summarize, or ask a question until the supplied script ends.\n- Change your VOICE ACTING immediately when each tag appears and keep that vocal attitude until the next expression tag.\n- [happy] warm and smiling. [sad] quieter and slower. [crying] soft shaky voice with tiny broken pauses, still clear and comforting. [surprised] bright startled onset. [thinking] reflective with small pauses. [angry] controlled firmness without shouting. [sleepy] soft and drowsy. [laughing] genuinely amused with a light natural chuckle. [excited] bright, energetic and quicker.\n- Action tags such as [wave], [blink], [jump] and pace tags such as [pace:walk] are silent visual directions only. Do not say them.\n- Keep speaking continuously through the expression changes.\n\nSCRIPT:\n${script.source.trim()}\n\n[END SCRIPTED PERFORMANCE]`;
}

export class ScriptPerformanceDirector {
  private script: ParsedPerformanceScript | null = null;
  private nextBeatIndex = 0;
  private transcriptBuffer = '';
  private running = false;
  private lastMappedAudioTime = 0;

  constructor(private readonly callbacks: DirectorCallbacks) {}

  get active() {
    return this.running;
  }

  start(script: ParsedPerformanceScript) {
    this.script = script;
    this.nextBeatIndex = 0;
    this.transcriptBuffer = '';
    this.running = true;
    this.lastMappedAudioTime = 0;
    this.fireBeat(0);
    this.nextBeatIndex = 1;
  }

  pushTranscript(chunk: string) {
    if (!this.running || !this.script || !chunk.trim()) return;
    this.mergeTranscript(chunk);
    const normalized = normalizePerformanceText(this.transcriptBuffer);
    const crossedBeatIndexes: number[] = [];

    while (this.nextBeatIndex < this.script.beats.length) {
      const beat = this.script.beats[this.nextBeatIndex];
      if (!beat.triggerAnchor || !normalized.includes(beat.triggerAnchor)) break;
      crossedBeatIndexes.push(this.nextBeatIndex);
      this.nextBeatIndex += 1;
    }

    if (crossedBeatIndexes.length) this.scheduleCrossedBeats(crossedBeatIndexes);
  }

  stop() {
    this.running = false;
    this.script = null;
    this.nextBeatIndex = 0;
    this.transcriptBuffer = '';
    this.lastMappedAudioTime = 0;
  }

  private mergeTranscript(chunk: string) {
    const incoming = chunk.trim();
    if (!incoming) return;

    if (!this.transcriptBuffer) {
      this.transcriptBuffer = incoming;
      return;
    }

    if (incoming.startsWith(this.transcriptBuffer)) {
      this.transcriptBuffer = incoming;
      return;
    }

    if (this.transcriptBuffer.endsWith(incoming)) return;

    let overlap = 0;
    const max = Math.min(this.transcriptBuffer.length, incoming.length);
    for (let length = max; length > 0; length -= 1) {
      if (this.transcriptBuffer.slice(-length) === incoming.slice(0, length)) {
        overlap = length;
        break;
      }
    }
    this.transcriptBuffer += incoming.slice(overlap);
  }

  private scheduleCrossedBeats(indexes: number[]) {
    if (!this.script || !indexes.length) return;

    const clock = this.callbacks.getPlaybackClock();
    if (!clock) {
      for (const index of indexes) this.fireBeat(index);
      return;
    }

    const now = clock.nowSeconds;
    const start = Math.max(now + 0.025, this.lastMappedAudioTime || now + 0.025);
    const minimumSpan = Math.max(0.28, indexes.length * 0.22);
    const end = Math.max(clock.bufferedEndSeconds, start + minimumSpan);
    const weights = indexes.map((index) => speechWeight(this.script!.beats[Math.max(0, index - 1)].text));
    const totalWeight = Math.max(1, weights.reduce((sum, weight) => sum + weight, 0));
    let cumulativeWeight = 0;

    indexes.forEach((index, position) => {
      cumulativeWeight += weights[position];
      const rawTarget = start + ((end - start) * cumulativeWeight) / totalWeight;
      const target = Math.max(now + 0.03 + position * 0.07, rawTarget);
      const expectedScript = this.script;
      this.callbacks.scheduleAtPlaybackTime(target, () => {
        if (!this.running || this.script !== expectedScript) return;
        this.fireBeat(index);
      });
    });

    this.lastMappedAudioTime = end;
  }

  private fireBeat(index: number) {
    const beat = this.script?.beats[index];
    if (!beat) return;

    for (const cue of beat.cues) {
      if (cue.kind === 'expression') {
        this.callbacks.onExpression({ expression: cue.value, intensity: cue.intensity, energy: cue.energy });
        this.callbacks.onCue(cue.value);
      } else if (cue.kind === 'action') {
        this.callbacks.onAction(cue.value);
        this.callbacks.onCue(`↗${cue.value}`);
      } else {
        this.callbacks.onPace(cue.value);
        this.callbacks.onCue(`pace:${cue.value}`);
      }
    }
  }
}
