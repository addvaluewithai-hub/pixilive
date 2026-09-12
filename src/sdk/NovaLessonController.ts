import { emitSessionLog } from '../debug/sessionLog';
import { LessonTutorRuntime } from '../lesson/LessonTutorRuntime';
import type { LessonDefinition, LessonState, LessonTutorRuntimeOptions } from '../lesson/types';
import { NovaLiveController, type NovaLiveControllerOptions } from './NovaLiveController';

export interface NovaLessonControllerOptions extends Omit<NovaLiveControllerOptions, 'systemPrompt' | 'tools'> {
  lesson: LessonDefinition;
  lessonRuntime?: LessonTutorRuntimeOptions;
}

/**
 * Nova + Gemini Live + structured lesson state.
 * The full lesson source stays in the system instruction while local tools keep
 * progress and detour state authoritative outside the model's sliding context.
 */
export class NovaLessonController {
  readonly tutor: LessonTutorRuntime;
  readonly nova: NovaLiveController;

  constructor(options: NovaLessonControllerOptions) {
    const { lesson, lessonRuntime, ...novaOptions } = options;
    this.tutor = new LessonTutorRuntime(lesson, lessonRuntime);
    const diagnosticTools = this.tutor.tools.map((tool) => ({
      declaration: tool.declaration,
      handle: (args: Record<string, unknown>) => {
        const response = tool.handle(args);
        emitSessionLog('tool', 'lesson_tool_response', {
          name: tool.declaration.name,
          response,
        });
        return response;
      },
    }));

    const externalInputTranscript = novaOptions.onInputTranscript;
    this.nova = new NovaLiveController({
      ...novaOptions,
      onInputTranscript: (text) => {
        this.tutor.observeLearnerTurn(text);
        externalInputTranscript?.(text);
      },
      systemPrompt: this.tutor.systemPrompt,
      tools: diagnosticTools,
    });
  }

  get state(): LessonState {
    return this.tutor.snapshot;
  }

  async init() {
    await this.nova.init();
  }

  async connect() {
    // Rebuild the prompt at every fresh connection so persisted progress is the
    // starting authority even after a page reload or a previous session ended.
    this.nova.setSystemPrompt(this.tutor.systemPrompt);
    await this.nova.connect();
  }

  sendText(text: string) {
    this.tutor.observeLearnerTurn(text);
    this.nova.sendText(text);
  }

  async disconnect() {
    await this.nova.disconnect();
  }

  async destroy() {
    await this.nova.destroy();
  }

  resetLesson() {
    this.tutor.reset();
    this.nova.setSystemPrompt(this.tutor.systemPrompt);
  }

  subscribeLessonState(listener: (state: LessonState) => void) {
    return this.tutor.subscribe(listener);
  }
}
