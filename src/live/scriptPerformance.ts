import type {
  CharacterActionName,
  CharacterExpressionCue,
  CharacterExpressionName,
  CharacterPace,
} from './types';

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

const VOICE_DIRECTIONS: Record<CharacterExpressionName, string> = {
  happy: 'Warm, smiling and buoyant. Keep the rhythm easy and friendly.',
  sad: 'Gentle, quieter and slightly slower, with sincere soft pauses.',
  crying: 'Soft shaky voice with a light tremble and tiny broken pauses, as if holding back tears. Stay clear and comforting for a child.',
  surprised: 'Bright startled onset, slightly higher pitch, then continue naturally.',
  thinking: 'Reflective and curious, with small thoughtful pauses.',
  angry: 'Controlled firmness and tension without shouting or sounding frightening.',
  sleepy: 'Soft, slow, drowsy and relaxed.',
  laughing: 'Genuinely amused with a smiling voice and a light natural chuckle if it fits.',
  excited: 'Bright, energetic and quicker while staying clear.',
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

  return {
    source,
    beats: beats.map((beat, index) => ({ ...beat, index })),
  };
}

export function buildScriptBeatPrompt(text: string, expression: CharacterExpressionName) {
  return `[STORY PERFORMANCE BEAT]\nSpeak ONLY the Arabic story line below. Do not add, explain, summarize, greet, or ask a question. This line continues directly from the previous story line.\n\nVOICE ACTING: ${VOICE_DIRECTIONS[expression]}\n\nLINE:\n${text}\n\nRead that line now and stop.`;
}
