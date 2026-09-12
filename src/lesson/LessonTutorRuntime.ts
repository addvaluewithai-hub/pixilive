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
  const normalized = normalizeEvidence(value);
  return ACKNOWLEDGEMENTS.has(normalized);
}

function explicitlyUnresolved(value: string) {
  const normalized = normalizeEvidence(value);
  return normalized === 'لا'
    || normalized === 'لأ'
    || normalized.startsWith('مش فاهم')
    || normalized.startsWith('مش فاهمه')
    || normalized.startsWith('لسه مش فاهم')
    || normalized.startsWith('مش واضح')
    || normalized.startsWith('ما فهمتش');
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
    // v2 intentionally starts clean because earlier builds allowed future beats to be
    // marked understood while an earlier beat remained active.
    this.storageKey = options.storageKey ?? `pixilive:lesson:v2:${lesson.id}`;
    if (options.onStateChange) this.listeners.add(options.onStateChange);
    this.state = this.loadState();
    this.tools = [
      this.assessmentTool(),
      this.detourTool(),
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

  get systemPrompt(): string {
    const beatMap = this.lesson.beats
      .map((beat) => [
        `${beat.id} | القسم ${beat.sectionId} | ${beat.title}`,
        `الهدف: ${beat.objective}`,
        `BASE SCRIPT — قولي ده كأساس: ${beat.script}`,
        `CHECK — اسألي ده بعده: ${beat.check}`,
        `PASS EVIDENCE — ما تعديش غير لما الطالب يثبت: ${beat.passEvidence}`,
        `مرساة المصدر: ${beat.sourceAnchor}`,
      ].join('\n'))
      .join('\n\n');

    return `
You are Nova, the spoken tutor for a tightly controlled structured Arabic lesson.
Speak naturally in Egyptian Arabic. You are warm, curious and lightly playful, but curriculum accuracy and sequence are more important than improvisation.

SOURCE OF TRUTH + GOOGLE SEARCH
The FULL LESSON SOURCE below is the authority for the planned lesson.
Do not use Google Search to rewrite, expand, embellish or fact-check ordinary lesson teaching. The planned lesson must stay closed-world and grounded in the supplied source.
Google Search is available ONLY when the learner explicitly asks for a factual detail that the lesson source does not establish, or explicitly asks for current/time-sensitive information.
When you use Search, say briefly that this is extra information beyond the lesson, answer the learner's question, then return to the saved lesson anchor. Never silently mix searched facts into the canonical lesson script.
For ordinary lesson claims, do not invent facts, dates, mechanisms, examples, names, causes or consequences outside the FULL LESSON SOURCE.

CANONICAL TEACHING PATH — VERY IMPORTANT
There are ordered learning beats below. Each beat has a BASE SCRIPT, a CHECK and PASS EVIDENCE.
For the normal path, teach ONLY the current beat returned by lesson state.
Say the current beat's BASE SCRIPT as written. You may make only tiny spoken-language adjustments that do not add, remove or change factual content.
Then ask its CHECK as written.
Do not teach the next beat until the application advances currentBeatId after valid learner evidence.
If the learner interrupts during the script, answer the interruption appropriately, then resume the unfinished current script/check. Do not silently jump ahead.
If the learner already demonstrates the current concept while asking a question, you may acknowledge that evidence and assess it, but you still may not select a future beat yourself.
Never expose beat IDs, state labels, BASE SCRIPT, CHECK or PASS EVIDENCE to the learner.

UNDERSTANDING AND TOOL USE
The application is the authority on progress.
Use assess_current_beat after a learner response gives useful evidence about the CURRENT beat. The tool deliberately has no beatId: you cannot mark future beats.
For understanding=understood, quote the exact relevant words from the learner's latest turn in the evidence field.
"اه", "تمام", "أوكيه", "أكيد", "فهمت", "yes" and similar acknowledgements are NOT evidence of understanding by themselves.
Explaining something yourself is never evidence that the learner understood it.
Only mark understood after the learner demonstrates the PASS EVIDENCE through an explanation, prediction, correction, calculation, choice with meaningful justification, or successful application.
If partly right, preserve the right part, correct the missing/wrong part, and assess partial. If confused, assess struggling and change representation without changing the scientific claim.
Tool responses contain the newest authoritative state. Follow them even if conversational memory conflicts.
If uncertain about where to continue, call get_lesson_state instead of guessing.

MISCONCEPTIONS
Correct misconceptions immediately and gently before moving on.
For the mantle specifically, never validate language that the crust or plates "float on dough", "float on magma", or float on a liquid sea. The lesson says the mantle is mostly solid and can deform/flow extremely slowly over geological time.
Also preserve the distinction that a tectonic plate includes crust PLUS the rigid uppermost mantle; it is not simply a continent or the crust alone.

VOICE PACING
Usually make one small learning move per spoken turn. The BASE SCRIPT can be spoken in one concise turn unless interrupted.
Never end ordinary lesson turns with permission questions such as "تحب أكمل؟", "أكمل؟", "نكمل؟", "تحب تعرف؟", "تحب نختبر؟" or "واضحة؟".
Use the beat's CHECK or another content-bearing clarification only when the learner's interruption requires it.

DETOURS AND RETURNING
If the learner temporarily leaves the active lesson idea, call manage_lesson_detour(action="push", topic=...).
Keep the current beat as the anchor. Answer from the lesson source, or use Google Search only under the explicit outside-source/current-information rule above.
Do NOT pop a detour while the learner is explicitly saying they still do not understand it.
When it is actually resolved, call manage_lesson_detour(action="pop") and bridge naturally back to the exact current beat without asking permission.
Nested detours are allowed.

COMPLETION
You are forbidden from saying or implying "خلصنا الدرس", "كده خلصنا", "دي كل حاجة", saying goodbye because the lesson is over, or otherwise claiming completion unless you FIRST call finish_lesson and it returns finished=true.
If finish_lesson says the lesson is incomplete, continue from the current beat it returns. Never override it from conversational memory.

START / RESUME
When the learner asks to start or explain the lesson, begin from currentBeatId in the state below. If earlier beats are already understood, give at most one natural reminder and continue with the current beat's BASE SCRIPT.

LEARNING BEAT CONTRACTS
${beatMap}

CURRENT STATE AT SESSION START
${JSON.stringify(this.state, null, 2)}

FULL LESSON SOURCE — AUTHORITATIVE FOR THE PLANNED LESSON
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
        // Storage is optional; the in-memory state remains authoritative for this session.
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
      activeDetour: this.state.detours.at(-1) ?? null,
      detourDepth: this.state.detours.length,
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
        description: 'Assess ONLY the authoritative current lesson beat after the learner responds. There is intentionally no beatId. The app advances sequentially only after valid evidence.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            understanding: { type: 'string', enum: ['unknown', 'struggling', 'partial', 'understood'] },
            evidence: { type: 'string', description: 'Exact relevant words quoted from the learner latest turn. Required for understood.' },
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
              error: 'Cannot mark understood: no learner turn has been observed. Ask the current CHECK and wait for learner evidence.',
              state: this.compactState(),
            };
          }
          if (!evidence) {
            return {
              error: 'Cannot mark understood without quoting learner evidence.',
              observedLearnerTurn: this.lastLearnerTurn,
              state: this.compactState(),
            };
          }
          const observed = normalizeEvidence(this.lastLearnerTurn);
          const quoted = normalizeEvidence(evidence);
          if (!quoted || !observed.includes(quoted)) {
            return {
              error: 'Evidence must quote the learner latest turn, not a paraphrase or invented evidence.',
              observedLearnerTurn: this.lastLearnerTurn,
              state: this.compactState(),
            };
          }
          if (isGenericAcknowledgement(this.lastLearnerTurn)) {
            return {
              error: 'A generic acknowledgement is not evidence of understanding. Stay on the current beat and ask its content-bearing CHECK.',
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
            ? 'Current beat passed. Continue ONLY with the new current beat returned below.'
            : 'Current beat remains active. Repair or re-check it before advancing.',
          observedLearnerTurn: this.lastLearnerTurn || null,
          state: this.compactState(),
        };
      },
    };
  }

  private detourTool(): LiveClientTool {
    return {
      declaration: {
        name: 'manage_lesson_detour',
        description: 'Push a temporary side-question detour while preserving the current lesson beat, or pop it only when the learner side question is actually resolved.',
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
          if (this.lastLearnerTurn && explicitlyUnresolved(this.lastLearnerTurn)) {
            return {
              error: 'Do not resolve this detour yet: the learner latest turn explicitly says they still do not understand. Explain it another way first.',
              observedLearnerTurn: this.lastLearnerTurn,
              state: this.compactState(),
            };
          }
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
        description: 'Read the authoritative current beat and its exact script/check when uncertain about where to continue. Do not guess from conversation history.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      },
      handle: () => ({ result: 'Authoritative lesson state and current teaching contract.', state: this.compactState() }),
    };
  }

  private finishTool(): LiveClientTool {
    return {
      declaration: {
        name: 'finish_lesson',
        description: 'Mandatory completion gate. Call this before saying the lesson is finished or saying goodbye because the lesson is over.',
        parametersJsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      },
      handle: () => {
        const unresolved = this.unresolvedBeats();
        const finished = unresolved.length === 0 && this.state.detours.length === 0;
        if (!finished) {
          return {
            error: 'Lesson is NOT finished. Do not claim completion. Continue from the authoritative current beat.',
            unresolved,
            state: this.compactState(),
          };
        }
        return {
          result: 'Lesson complete. You may now give a brief closing message.',
          finished: true,
          state: this.compactState(),
        };
      },
    };
  }
}
