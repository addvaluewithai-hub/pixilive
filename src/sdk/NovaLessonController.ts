import { emitSessionLog } from '../debug/sessionLog';
import { LessonTutorRuntime } from '../lesson/LessonTutorRuntime';
import type { LessonDefinition, LessonState, LessonTutorRuntimeOptions } from '../lesson/types';
import { NovaLiveController, type NovaLiveControllerOptions } from './NovaLiveController';

export interface NovaLessonControllerOptions extends Omit<NovaLiveControllerOptions, 'systemPrompt' | 'tools'> {
  lesson: LessonDefinition;
  lessonRuntime?: LessonTutorRuntimeOptions;
}

/** Nova + Gemini Live + authoritative lesson sequence/progress. */
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

    this.nova = new NovaLiveController({
      ...novaOptions,
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
    // Rebuild the small role prompt on every fresh connection. Lesson content itself
    // still arrives beat-by-beat from the runtime tools.
    this.nova.setSystemPrompt(this.tutor.systemPrompt);
    await this.nova.connect();
  }

  sendText(text: string) {
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
