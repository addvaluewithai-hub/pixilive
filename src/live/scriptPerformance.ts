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

const WORDS_PER_SECOND: Record<CharacterExpressionName, number> = {
  happy: 3.25,
  sad: 2.55,
  crying: 2.2,
  surprised: 3.1,
  thinking: 2.6,
  angry: 2.85,
  sleepy: 2.35,
  laughing: 3.0,
  excited: 3.55,
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
  const beats: Array<Omit<ScriptPerformanceBeat, 'index'>> = [];
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

  const finalized = beats.map((beat, index): ScriptPerformanceBeat => ({ ...beat, index }));
  return {
    source,
    beats: finalized,
    spokenText: finalized.map((beat) => beat.text).join(' '),
  };
}

export function buildScriptPerformancePrompt(script: ParsedPerformanceScript) {
  return `[SCRIPTED PERFORMANCE]\nRead the tagged Arabic story below as ONE continuous spoken turn.\n\nRULES:\n- Bracketed tags are silent acting directions. NEVER pronounce, describe, translate, or spell the tags.\n- Do NOT call character stage tools while reading this scripted performance; the host application executes the visual tags itself.\n- Read every non-tagged story sentence in the exact written order. Do not paraphrase, skip, add, summarize, or ask a question until the supplied script ends.\n- Change your VOICE ACTING immediately when each expression tag appears and keep that vocal attitude until the next expression tag.\n- Make a tiny natural beat between tagged sections so each emotional change has room to read, but keep the whole story as one continuous turn.\n- [happy] warm and smiling. [sad] quieter and slower. [crying] soft shaky voice with tiny broken pauses, still clear and comforting. [surprised] bright startled onset. [thinking] reflective with small pauses. [angry] controlled firmness without shouting. [sleepy] soft and drowsy. [laughing] genuinely amused with a light natural chuckle. [excited] bright, energetic and quicker.\n- Action tags such as [wave], [blink], [jump] and pace tags such as [pace:walk] are silent visual directions only. Do not say them.\n- Keep speaking continuously through the expression changes.\n\nSCRIPT:\n${script.source.trim()}\n\n[END SCRIPTED PERFORMANCE]`;
}

const expressionCueInBeat = (beat: ScriptPerformanceBeat) =>
  beat.cues.find((cue): cue is Extract<ScriptPerformanceCue, { kind: 'expression' }> => cue.kind === 'expression');

const estimateBeatDurationSeconds = (text: string, expression: CharacterExpressionName) => {
  const normalized = normalizePerformanceText(text);
  const words = normalized ? normalized.split(' ').filter(Boolean).length : 1;
  const commaPause = (text.match(/[،,:;]/g) ?? []).length * 0.11;
  const sentencePause = (text.match(/[.!?؟]/g) ?? []).length * 0.24;
  const reflectivePause = (text.match(/\.\.\.|…/g) ?? []).length * 0.32;
  const speechSeconds = words / WORDS_PER_SECOND[expression];
  return Math.max(0.85, speechSeconds + commaPause + sentencePause + reflectivePause);
};

export class ScriptPerformanceDirector {
  private script: ParsedPerformanceScript | null = null;
  private running = false;
  private timelineScheduled = false;

  constructor(private readonly callbacks: DirectorCallbacks) {}

  get active() {
    return this.running;
  }

  start(script: ParsedPerformanceScript) {
    this.script = script;
    this.running = true;
    this.timelineScheduled = false;

    // Pre-pose before speech begins so the first line never starts on the stale face.
    this.fireBeat(0);
  }

  onPlaybackStart(clock: PlaybackClockSnapshot) {
    this.scheduleTimeline(clock);
  }

  // Transcription is only a wake-up signal. Its text never drives cue timing because
  // Gemini does not guarantee exact ordering between output transcription and audio.
  pushTranscript(_chunk: string) {
    if (!this.running || this.timelineScheduled) return;
    const clock = this.callbacks.getPlaybackClock();
    if (clock && clock.turnStartSeconds > 0) this.scheduleTimeline(clock);
  }

  stop() {
    this.running = false;
    this.script = null;
    this.timelineScheduled = false;
  }

  private scheduleTimeline(clock: PlaybackClockSnapshot) {
    if (!this.running || !this.script || this.timelineScheduled) return;
    this.timelineScheduled = true;

    let currentExpression: CharacterExpressionName = 'happy';
    let elapsedSeconds = 0;
    const expectedScript = this.script;

    for (let index = 0; index < expectedScript.beats.length; index += 1) {
      const beat = expectedScript.beats[index];
      const expressionCue = expressionCueInBeat(beat);
      if (expressionCue) currentExpression = expressionCue.value;

      if (index > 0) {
        const cueTime = clock.turnStartSeconds + Math.max(0.12, elapsedSeconds - 0.08);
        this.callbacks.scheduleAtPlaybackTime(cueTime, () => {
          if (!this.running || this.script !== expectedScript) return;
          this.fireBeat(index);
        });
      }

      elapsedSeconds += estimateBeatDurationSeconds(beat.text, currentExpression);
    }
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
