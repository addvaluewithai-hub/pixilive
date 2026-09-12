import type { LiveClientTool } from '../live/types';
import type {
  LessonBeat,
  LessonBeatState,
  LessonCoverage,
  LessonDefinition,
  LessonState,
  LessonTutorRuntimeOptions,
  LessonUnderstanding,
} from './types';

const defaultBeatState = (): LessonBeatState => ({
  coverage: 'not_covered',
  understanding: 'unknown',
  misconceptions: [],
});

const isCoverage = (value: unknown): value is LessonCoverage => value === 'not_covered' || value === 'covered';
const isUnderstanding = (value: unknown): value is LessonUnderstanding => (
  value === 'unknown' || value === 'struggling' || value === 'partial' || value === 'understood'
);

function cloneState(state: LessonState): LessonState {
  return JSON.parse(JSON.stringify(state)) as LessonState;
}

export class LessonTutorRuntime {
  readonly tools: readonly LiveClientTool[];

  private state: LessonState;
  private readonly storageKey: string;
  private readonly listeners = new Set<(state: LessonState) => void>();

  constructor(
    readonly lesson: LessonDefinition,
    options: LessonTutorRuntimeOptions = {},
  ) {
    this.storageKey = options.storageKey ?? `pixilive:lesson:v2:${lesson.id}`;
    if (options.onStateChange) this.listeners.add(options.onStateChange);
    this.state = this.loadState();
    this.tools = [
      this.assessmentTool(),
      this.stateTool(),
      this.finishTool(),
    ];
  }

  get snapshot(): LessonState {
    return cloneState(this.state);
  }

  get currentBeat(): LessonBeat {
    return this.lesson.beats.find((beat) => beat.id === this.state.currentBeatId) ?? this.lesson.beats[0];
  }

  /**
   * The model gets a small role prompt, not the whole lesson. The runtime reveals
   * only the current beat. Nova owns conversational teaching/judgement; this class
   * owns sequence, persistence and the completion gate.
   */
  get systemPrompt(): string {
    return `
You are Nova, a warm spoken tutor. Speak naturally in Egyptian Arabic.
The lesson is called "${this.lesson.title}".

The application owns lesson sequence. You do not have the whole lesson in this prompt.

LESSON FLOW
- At session start, call get_lesson_state before teaching. It returns the only lesson beat you should teach now.
- Teach the returned currentScript naturally and use currentCheck as the main check for understanding.
- Conversation can breathe: the learner may answer over several turns, ask side questions, change wording, or need another explanation.
- Judge understanding from the conversation as a whole while this beat is active, not only from the learner's latest sentence.
- goodUnderstanding describes what solid understanding roughly looks like. It is guidance, not a phrase-matching checklist and not something the learner must repeat verbatim.
- When you judge the current beat is understood well enough, call assess_current_beat with decision="pass" BEFORE introducing the next lesson beat.
- If the idea is not understood yet, keep teaching the same beat naturally. You may call assess_current_beat with decision="stay" when useful to record that it remains unresolved; you do not need to call it after every utterance.
- Never ask the learner to repeat an idea they already demonstrated just to create fresh evidence for the tool.
- You cannot choose a beat ID or skip ahead. After a pass, teach only the new current beat returned by the tool.

TEACHING JUDGEMENT
A bare acknowledgement like "اه" or "تمام" is usually not strong evidence by itself, but use the full conversation: if the learner already demonstrated the idea earlier, a later acknowledgement does not erase that understanding.
Your goal is genuine understanding, not completing a verbal checklist. If the central idea is clear, do not over-test minor wording or force every detail into one answer.
Correct meaningful misconceptions before passing the beat.

SIDE QUESTIONS
If the learner asks a side question, answer it naturally using your general knowledge when you are reasonably confident. You may simplify or add useful background.
If you are unsure, say so instead of inventing certainty.
A side question does not change curriculum progress by itself. After answering it, continue naturally from the current lesson idea. If you lose your place, call get_lesson_state.
Do not ask permission questions like "تحب أكمل؟" or "نكمل؟". Continue with the lesson or a useful content-bearing question.

COMPLETION
Do not claim the lesson is finished and do not close it as completed unless you first call finish_lesson and it returns finished=true.

Never expose tool names, beat IDs, internal state labels, currentScript/currentCheck field names, or curriculum mechanics to the learner.
`.trim();
  }

  subscribe(listener: (state: LessonState) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  reset() {
    this.state = this.createInitialState();
    this.persistAndEmit();
  }

  private createInitialState(): LessonState {
    return {
      lessonId: this.lesson.id,
      currentBeatId: this.lesson.beats[0]?.id ?? '',
      beats: Object.fromEntries(this.lesson.beats.map((beat) => [beat.id, defaultBeatState()])),
      detours: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private loadState(): LessonState {
    const initial = this.createInitialState();
    if (typeof window === 'undefined') return initial;

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return initial;
      const parsed = JSON.parse(raw) as Partial<LessonState>;
      if (parsed.lessonId !== this.lesson.id) return initial;

      const beats = { ...initial.beats };
      for (const beat of this.lesson.beats) {
        const saved = parsed.beats?.[beat.id];
        if (!saved) continue;
        beats[beat.id] = {
          coverage: isCoverage(saved.coverage) ? saved.coverage : 'not_covered',
          understanding: isUnderstanding(saved.understanding) ? saved.understanding : 'unknown',
          misconceptions: Array.isArray(saved.misconceptions)
            ? saved.misconceptions.filter((item): item is string => typeof item === 'string').slice(-8)
            : [],
        };
      }

      const validCurrent = this.lesson.beats.some((beat) => beat.id === parsed.currentBeatId);
      return {
        lessonId: this.lesson.id,
        currentBeatId: validCurrent ? parsed.currentBeatId as string : initial.currentBeatId,
        detours: [],
        beats,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : initial.updatedAt,
      };
    } catch {
      return initial;
    }
  }

  private persistAndEmit() {
    this.state.updatedAt = new Date().toISOString();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      } catch {
        // Persistence is optional; in-memory state remains authoritative.
      }
    }
    const snapshot = this.snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  private nextUnmasteredBeat(afterBeatId: string) {
    const currentIndex = this.lesson.beats.findIndex((beat) => beat.id === afterBeatId);
    for (let index = currentIndex + 1; index < this.lesson.beats.length; index += 1) {
      const candidate = this.lesson.beats[index];
      if (this.state.beats[candidate.id]?.understanding !== 'understood') return candidate;
    }
    return this.lesson.beats.find((beat) => this.state.beats[beat.id]?.understanding !== 'understood') ?? null;
  }

  private maybeAdvanceFrom(beatId: string) {
    if (this.state.currentBeatId !== beatId) return;
    if (this.state.beats[beatId]?.understanding !== 'understood') return;
    const next = this.nextUnmasteredBeat(beatId);
    if (next) this.state.currentBeatId = next.id;
  }

  private unresolvedBeats() {
    return this.lesson.beats
      .filter((beat) => this.state.beats[beat.id]?.understanding !== 'understood')
      .map((beat) => ({ id: beat.id, title: beat.title }));
  }

  private compactState() {
    const beat = this.currentBeat;
    const understoodCount = this.lesson.beats.filter((item) => this.state.beats[item.id]?.understanding === 'understood').length;
    return {
      lessonId: this.lesson.id,
      currentBeatId: beat.id,
      currentBeatTitle: beat.title,
      currentObjective: beat.objective,
      currentScript: beat.script,
      currentCheck: beat.check,
      goodUnderstanding: beat.passEvidence,
      understoodCount,
      totalBeats: this.lesson.beats.length,
      currentBeatState: this.state.beats[beat.id],
      finished: understoodCount === this.lesson.beats.length,
    };
  }

  private assessmentTool(): LiveClientTool {
    return {
      declaration: {
        name: 'assess_current_beat',
        description: 'Decide whether the authoritative current lesson beat is understood based on the conversation so far. pass advances exactly one sequential beat; stay keeps the same beat. Do not require the learner to repeat something they already demonstrated in an earlier turn.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            decision: { type: 'string', enum: ['pass', 'stay'] },
            note: { type: 'string', description: 'Optional concise reason for the judgement, for diagnostics only.' },
            misconception: { type: 'string', description: 'Optional meaningful misconception that still needs correction.' },
          },
          required: ['decision'],
        },
      },
      handle: (args) => {
        const beat = this.currentBeat;
        const decision = args.decision;
        if (decision !== 'pass' && decision !== 'stay') {
          return { error: 'decision must be pass or stay.', state: this.compactState() };
        }

        const previous = this.state.beats[beat.id] ?? defaultBeatState();
        const misconception = typeof args.misconception === 'string' ? args.misconception.trim() : '';
        const misconceptions = misconception && !previous.misconceptions.includes(misconception)
          ? [...previous.misconceptions, misconception].slice(-8)
          : previous.misconceptions;

        this.state.beats[beat.id] = {
          coverage: 'covered',
          understanding: decision === 'pass' ? 'understood' : misconception ? 'struggling' : 'partial',
          misconceptions,
        };

        if (decision === 'pass') this.maybeAdvanceFrom(beat.id);
        this.persistAndEmit();

        return {
          result: decision === 'pass'
            ? 'Current beat passed. Continue with ONLY the new current beat returned below.'
            : 'Current beat stays active. Continue teaching it naturally; do not advance yet.',
          note: typeof args.note === 'string' && args.note.trim() ? args.note.trim() : undefined,
          state: this.compactState(),
        };
      },
    };
  }

  private stateTool(): LiveClientTool {
    return {
      declaration: {
        name: 'get_lesson_state',
        description: 'Call before the first teaching turn and whenever you lose your place. Returns only the authoritative current beat; future beats are hidden.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      },
      handle: () => ({
        result: 'Teach this current beat only. Use currentScript naturally and currentCheck as the main understanding check.',
        state: this.compactState(),
      }),
    };
  }

  private finishTool(): LiveClientTool {
    return {
      declaration: {
        name: 'finish_lesson',
        description: 'Mandatory completion gate. Call before claiming the lesson is finished or closing it as complete.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      },
      handle: () => {
        const unresolved = this.unresolvedBeats();
        const finished = unresolved.length === 0;
        if (!finished) {
          return {
            error: 'Lesson is not finished. Continue from the current beat returned below.',
            unresolved,
            state: this.compactState(),
          };
        }
        return {
          result: 'Lesson complete. You may give a brief natural closing message.',
          finished: true,
          state: this.compactState(),
        };
      },
    };
  }
}
