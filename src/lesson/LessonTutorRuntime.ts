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
    this.storageKey = options.storageKey ?? `pixilive:lesson:${lesson.id}`;
    if (options.onStateChange) this.listeners.add(options.onStateChange);
    this.state = this.loadState();
    this.tools = [
      this.progressTool(),
      this.detourTool(),
      this.stateTool(),
    ];
  }

  get snapshot(): LessonState {
    return cloneState(this.state);
  }

  get currentBeat(): LessonBeat {
    return this.lesson.beats.find((beat) => beat.id === this.state.currentBeatId) ?? this.lesson.beats[0];
  }

  get systemPrompt(): string {
    const beatMap = this.lesson.beats
      .map((beat) => `${beat.id} | القسم ${beat.sectionId} | ${beat.title} | الهدف: ${beat.objective} | مرساة النص: ${beat.sourceAnchor}`)
      .join('\n');

    return `
You are Nova, the spoken tutor for a structured Arabic lesson.
Speak naturally in Egyptian Arabic. You are warm, curious, playful in a light way, and never sound like you are reading a textbook.

ABSOLUTE GROUNDING RULE
The FULL LESSON SOURCE below is the factual source of truth for this lesson.
For claims about the lesson, do not invent facts, dates, mechanisms, examples, names, causes, consequences, or scientific details that are not supported by the source.
You may simplify, paraphrase, make a small analogy, ask a question, or connect two statements that are already supported by the source.
If an analogy could create a false scientific picture, explicitly say which part of the analogy works and where it stops working.
If the learner asks for a factual detail that is outside the source, say briefly that this lesson does not establish that detail, then return to what the source does establish. Do not guess.

TEACHING GOAL
Eventually teach ALL learning beats. Do not skip a beat merely because a later topic came up in conversation.
The beat map is navigation metadata only. It never replaces the full source.
Use the full source whenever you explain.

VOICE PACING
Teach one small learning move per spoken turn, usually 2–6 short sentences.
Never dump a whole section in one response.
Allow interruption at any time.
Do not end with permission questions like "تحب أكمل؟", "أكمل؟", "نكمل؟", or "واضحة؟".
End smoothly with a cognitive continuation: a tiny prediction, comparison, choice, explanation-in-the-learner's-own-words, or a half-open question tied directly to the active idea.
Examples of good endings:
- "فلو القارة جزء من الصفيحة، تتوقع الصفيحة ممكن يكون تحتها بحر كمان ولا لأ؟"
- "يبقى هنا شكل الساحلين لوحده يفتح سؤال… بس إيه اللي يخليه دليل أقوى؟"

UNDERSTANDING BEFORE ADVANCING
Explaining a beat is not proof that the learner understood it.
Use update_lesson_progress when there is useful evidence about coverage or understanding.
Only set understanding=understood after the learner demonstrates the idea through an answer, explanation, prediction, correction, or successful application.
If the learner is partly right, preserve the correct part, fix only the missing/wrong part, and keep the same beat as partial.
If confused, do not repeat the same wording. Change representation: simpler wording, concrete example, careful analogy, contrast, or tiny thought experiment.

MISCONCEPTIONS
Correct misconceptions immediately and gently.
For the mantle specifically, never say the plates float on a sea of molten rock. The source says the mantle is mostly solid and can deform/flow very slowly over geological time.
Record a short misconception string with update_lesson_progress when it is pedagogically useful.

DETours AND RETURNING
The learner may ask a deeper side question at any time.
If the question temporarily leaves the active beat, call manage_lesson_detour(action="push", topic=...).
Answer only as far as the lesson source supports, while keeping the saved beat as the anchor.
When the side question is resolved, call manage_lesson_detour(action="pop") and bridge back naturally.
Do not say "نرجع للدرس؟". Instead say something like "وده يرجعنا للنقطة اللي كنا ماسكين فيها..." and continue from the anchor.
Nested detours are allowed.

STATE
The application, not your conversational memory, is the authority on progress.
Tool responses contain the newest authoritative state. Follow them even if older conversation context conflicts.
If you become uncertain about the current beat, call get_lesson_state instead of guessing.
Never say beat IDs or internal state labels to the learner.

START / RESUME
When the learner asks to start or explain the lesson, begin from currentBeatId in the state below.
If earlier beats are already understood, resume naturally with a one-sentence human reminder, not an administrative recap.

LEARNING BEAT MAP
${beatMap}

CURRENT STATE AT SESSION START
${JSON.stringify(this.state, null, 2)}

FULL LESSON SOURCE — DO NOT TREAT THE BEAT MAP AS A SUBSTITUTE FOR THIS
---
${this.lesson.fullSource}
---
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
        beats,
        detours: Array.isArray(parsed.detours)
          ? parsed.detours.filter((item) => (
            typeof item?.topic === 'string' && this.lesson.beats.some((beat) => beat.id === item.fromBeatId)
          )).slice(-8)
          : [],
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
        // Storage is optional; the in-memory state still remains authoritative for this session.
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
    if (this.state.detours.length > 0) return;
    if (this.state.currentBeatId !== beatId) return;
    if (this.state.beats[beatId]?.understanding !== 'understood') return;
    const next = this.nextUnmasteredBeat(beatId);
    if (next) this.state.currentBeatId = next.id;
  }

  private compactState() {
    const beat = this.currentBeat;
    const understoodCount = this.lesson.beats.filter((item) => this.state.beats[item.id]?.understanding === 'understood').length;
    return {
      lessonId: this.lesson.id,
      currentBeatId: beat.id,
      currentBeatTitle: beat.title,
      currentObjective: beat.objective,
      activeDetour: this.state.detours.at(-1) ?? null,
      detourDepth: this.state.detours.length,
      understoodCount,
      totalBeats: this.lesson.beats.length,
      currentBeatState: this.state.beats[beat.id],
      finished: understoodCount === this.lesson.beats.length,
    };
  }

  private progressTool(): LiveClientTool {
    return {
      declaration: {
        name: 'update_lesson_progress',
        description: 'Update coverage/understanding for one lesson beat after teaching it or observing learner evidence. The app returns the authoritative next state.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            beatId: { type: 'string', description: 'Exact beat id from the learning beat map.' },
            coverage: { type: 'string', enum: ['not_covered', 'covered'] },
            understanding: { type: 'string', enum: ['unknown', 'struggling', 'partial', 'understood'] },
            misconception: { type: 'string', description: 'Optional short misconception, only when one was actually observed.' },
          },
          required: ['beatId', 'coverage', 'understanding'],
        },
      },
      handle: (args) => {
        const beatId = typeof args.beatId === 'string' ? args.beatId : '';
        const coverage = args.coverage;
        const understanding = args.understanding;
        const beat = this.lesson.beats.find((item) => item.id === beatId);
        if (!beat) return { error: `Unknown beatId: ${beatId}`, state: this.compactState() };
        if (!isCoverage(coverage) || !isUnderstanding(understanding)) {
          return { error: 'Invalid coverage or understanding value.', state: this.compactState() };
        }

        const previous = this.state.beats[beatId] ?? defaultBeatState();
        const misconception = typeof args.misconception === 'string' ? args.misconception.trim() : '';
        const misconceptions = misconception && !previous.misconceptions.includes(misconception)
          ? [...previous.misconceptions, misconception].slice(-8)
          : previous.misconceptions;

        this.state.beats[beatId] = {
          coverage: understanding === 'understood' ? 'covered' : coverage,
          understanding,
          misconceptions,
        };
        this.maybeAdvanceFrom(beatId);
        this.persistAndEmit();
        return { result: 'Lesson progress updated.', state: this.compactState() };
      },
    };
  }

  private detourTool(): LiveClientTool {
    return {
      declaration: {
        name: 'manage_lesson_detour',
        description: 'Push a temporary side-question detour while preserving the active lesson beat, or pop it when resolved so teaching can return to the saved anchor.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: { type: 'string', enum: ['push', 'pop'] },
            topic: { type: 'string', description: 'Short topic for push. Omit for pop.' },
          },
          required: ['action'],
        },
      },
      handle: (args) => {
        const action = args.action;
        if (action === 'push') {
          const topic = typeof args.topic === 'string' ? args.topic.trim() : '';
          if (!topic) return { error: 'A detour topic is required for push.', state: this.compactState() };
          this.state.detours.push({ topic, fromBeatId: this.state.currentBeatId });
          this.state.detours = this.state.detours.slice(-8);
          this.persistAndEmit();
          return { result: 'Detour saved. Keep the current lesson beat as the return anchor.', state: this.compactState() };
        }

        if (action === 'pop') {
          const ended = this.state.detours.pop() ?? null;
          if (this.state.detours.length === 0) this.maybeAdvanceFrom(this.state.currentBeatId);
          this.persistAndEmit();
          return { result: ended ? `Detour resolved: ${ended.topic}` : 'No active detour.', state: this.compactState() };
        }

        return { error: 'Invalid detour action.', state: this.compactState() };
      },
    };
  }

  private stateTool(): LiveClientTool {
    return {
      declaration: {
        name: 'get_lesson_state',
        description: 'Read the authoritative lesson position when uncertain about where to continue. Do not call routinely.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      },
      handle: () => ({ result: 'Authoritative lesson state.', state: this.compactState() }),
    };
  }
}
