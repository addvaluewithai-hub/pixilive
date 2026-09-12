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

function normalizeEvidence(value: string) {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ACKNOWLEDGEMENTS = new Set([
  'اه', 'ايوه', 'ايوا', 'نعم', 'تمام', 'ماشي', 'اوكيه', 'اوكي', 'يس', 'yes', 'yep',
  'اكيد', 'صح', 'فهمت', 'حلو', 'كويس', 'تمام فهمت', 'اه فهمت', 'ايوه فهمت',
]);

function isGenericAcknowledgement(value: string) {
  return ACKNOWLEDGEMENTS.has(normalizeEvidence(value));
}

export class LessonTutorRuntime {
  readonly tools: readonly LiveClientTool[];

  private state: LessonState;
  private readonly storageKey: string;
  private readonly listeners = new Set<(state: LessonState) => void>();
  private lastLearnerTurn = '';

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

  observeLearnerTurn(text: string) {
    const value = text.trim();
    if (value) this.lastLearnerTurn = value;
  }

  /**
   * Keep the Live system instruction deliberately small. Nova does not receive the
   * whole lesson or future beat contracts. The runtime reveals only the current
   * beat through get_lesson_state / assess_current_beat tool responses.
   */
  get systemPrompt(): string {
    return `
You are Nova, a warm spoken tutor. Speak naturally in Egyptian Arabic.
The lesson is called "${this.lesson.title}".

The application owns the curriculum and the sequence. You do NOT have the lesson content in this prompt.

NORMAL LESSON FLOW
1. Before teaching anything at session start, call get_lesson_state. It returns the ONLY lesson beat you should teach now.
2. Say that beat's currentScript naturally, then ask its currentCheck.
3. After the learner answers that check, your FIRST action must be assess_current_beat BEFORE you introduce any new lesson content.
4. If the tool keeps the same beat active, repair or re-check that same idea.
5. If the tool advances, use ONLY the new currentScript/currentCheck returned by the tool.
Never guess, reconstruct, or teach future beats from model memory.

UNDERSTANDING
"اه", "تمام", "فهمت", "yes" and similar acknowledgements are not enough by themselves.
For understood, quote the learner's exact relevant words in evidence. Explanation, prediction, correction, calculation, or successful application count as evidence.
Your own explanation is never evidence that the learner understood.

SIDE QUESTIONS
If the learner asks a side question, answer it naturally using your general knowledge when you are reasonably confident. You may simplify or add useful background.
If you are unsure, say so instead of inventing certainty.
A side question does not advance the curriculum by itself. After answering it, return naturally to the current lesson idea/check. If you lose your place, call get_lesson_state.
Do not ask permission questions like "تحب أكمل؟" or "نكمل؟". Just continue naturally with a content-bearing question or the current check.

COMPLETION
Do not claim the lesson is finished and do not close the lesson as completed unless you first call finish_lesson and it returns finished=true.

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
    this.lastLearnerTurn = '';
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
        beats,
        // Side questions are conversational now; clear legacy detour state.
        detours: [],
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
        // Storage is optional; in-memory state remains authoritative.
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
      passEvidence: beat.passEvidence,
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
        description: 'After the learner answers the CURRENT lesson check, call this BEFORE speaking any new lesson content. It assesses only the current beat and returns either the same beat or the next beat contract. There is intentionally no beatId.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            understanding: { type: 'string', enum: ['unknown', 'struggling', 'partial', 'understood'] },
            evidence: { type: 'string', description: 'Exact relevant words from the learner latest turn. Required for understood.' },
            misconception: { type: 'string', description: 'Optional short misconception actually observed in the learner response.' },
          },
          required: ['understanding', 'evidence'],
        },
      },
      handle: (args) => {
        const beat = this.currentBeat;
        const understanding = args.understanding;
        if (!isUnderstanding(understanding)) {
          return { error: 'Invalid understanding value.', state: this.compactState() };
        }

        const evidence = typeof args.evidence === 'string' ? args.evidence.trim() : '';
        if (understanding === 'understood') {
          if (!this.lastLearnerTurn) {
            return {
              error: 'No learner turn observed. Ask the current check and wait for evidence.',
              state: this.compactState(),
            };
          }
          if (!evidence) {
            return {
              error: 'Cannot mark understood without learner evidence.',
              observedLearnerTurn: this.lastLearnerTurn,
              state: this.compactState(),
            };
          }
          const observed = normalizeEvidence(this.lastLearnerTurn);
          const quoted = normalizeEvidence(evidence);
          if (!quoted || !observed.includes(quoted)) {
            return {
              error: 'Evidence must quote the learner latest turn.',
              observedLearnerTurn: this.lastLearnerTurn,
              state: this.compactState(),
            };
          }
          if (isGenericAcknowledgement(this.lastLearnerTurn)) {
            return {
              error: 'A generic acknowledgement is not evidence. Stay on this beat and ask a content-bearing check.',
              observedLearnerTurn: this.lastLearnerTurn,
              state: this.compactState(),
            };
          }
        }

        const previous = this.state.beats[beat.id] ?? defaultBeatState();
        const misconception = typeof args.misconception === 'string' ? args.misconception.trim() : '';
        const misconceptions = misconception && !previous.misconceptions.includes(misconception)
          ? [...previous.misconceptions, misconception].slice(-8)
          : previous.misconceptions;

        this.state.beats[beat.id] = {
          coverage: 'covered',
          understanding,
          misconceptions,
        };
        this.maybeAdvanceFrom(beat.id);
        this.persistAndEmit();

        return {
          result: understanding === 'understood'
            ? 'Beat passed. Teach ONLY the current beat returned below, then ask its currentCheck.'
            : 'Beat remains active. Repair or re-check this same beat before advancing.',
          observedLearnerTurn: this.lastLearnerTurn || null,
          state: this.compactState(),
        };
      },
    };
  }

  private stateTool(): LiveClientTool {
    return {
      declaration: {
        name: 'get_lesson_state',
        description: 'Mandatory before the first teaching turn, and whenever you lose your place. Returns ONLY the authoritative current beat contract; future lesson content is not provided.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      },
      handle: () => ({
        result: 'Teach this current beat only. Say currentScript naturally, then ask currentCheck.',
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
