import type { PerformanceCue } from '../character/performance';

export type LiveStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export interface LiveCallbacks {
  onStatus: (status: LiveStatus) => void;
  onAudio: (base64Pcm16: string) => void;
  onInputTranscript: (text: string) => void;
  onOutputTranscript: (text: string) => void;
  onPerformanceCue: (cue: PerformanceCue) => void;
  onPerformanceCancelled: () => void;
  onInterrupted: () => void;
  onError: (message: string) => void;
}

export interface LiveClientToolDeclaration {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
}

export interface LiveClientTool {
  declaration: LiveClientToolDeclaration;
  handle: (args: Record<string, unknown>) => Record<string, unknown>;
}
