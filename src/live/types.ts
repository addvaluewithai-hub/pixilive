export type LiveStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export type CharacterExpressionName =
  | 'happy'
  | 'sad'
  | 'crying'
  | 'surprised'
  | 'thinking'
  | 'angry'
  | 'sleepy'
  | 'laughing'
  | 'excited';

export type CharacterActionName = 'wave' | 'blink' | 'jump';
export type CharacterPace = 'idle' | 'walk' | 'run';

export interface CharacterExpressionCue {
  expression: CharacterExpressionName;
  intensity: number;
  energy: number;
}

export interface LiveCallbacks {
  onStatus: (status: LiveStatus) => void;
  onAudio: (base64Pcm16: string) => void;
  onInputTranscript: (text: string) => void;
  onOutputTranscript: (text: string) => void;
  onCharacterExpression: (cue: CharacterExpressionCue) => void;
  onCharacterAction: (action: CharacterActionName) => void;
  onCharacterPace: (pace: CharacterPace) => void;
  onInterrupted: () => void;
  onError: (message: string) => void;
}
