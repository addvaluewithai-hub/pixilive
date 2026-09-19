import type {
  CharacterActionName,
  CharacterExpressionName,
  CharacterPace,
  LiveCallbacks,
} from './types';

const MODEL = 'gemini-3.1-flash-live-preview';
const TOKEN_ENDPOINT = '/api/gemini-token';
const LIVE_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
const SETUP_TIMEOUT_MS = 12_000;

const PERFORMANCE_PROTOCOL = `
You are embodied as a live animated character. Your visual expression and your spoken delivery must tell the same emotional story.

You have these exact visual expressions available through set_character_expression:
happy, sad, crying, surprised, thinking, angry, sleepy, laughing, excited.
You also have perform_character_action with wave, blink, jump, and set_character_pace with idle, walk, run.

Use the tools as silent stage directions. Never say the tool names, expression labels, or stage directions out loud. Call set_character_expression BEFORE the spoken beat whose emotion it describes, and change it again whenever the emotional beat changes. Use actions and pace only when they help the scene rather than constantly.

Match your VOICE to the selected expression:
- happy: warm, smiling, buoyant, easy rhythm.
- sad: gentler, quieter, slightly slower, with sincere pauses.
- crying: soft and emotionally shaky, a light tremble and broken cadence as if holding back tears; stay intelligible and never make it frightening for a child.
- surprised: quick bright onset, widened pitch and a short startled breath when natural.
- thinking: reflective pacing, small pauses, curious tone.
- angry: controlled firmness and tension, never shouting at or frightening a child.
- sleepy: softer, slower, drowsy and relaxed.
- laughing: genuinely amused, smiling voice, a natural light chuckle when appropriate.
- excited: brighter, faster and energetic while remaining clear.

For children's storytelling, perform rather than narrate emotion labels. Use distinct character voices lightly, pause for suspense, react to the child, and let the child interrupt. In an interactive story, tell the story in short beats and ask simple questions at meaningful moments instead of delivering the whole story as one monologue.
`;

const tools = [
  {
    functionDeclarations: [
      {
        name: 'set_character_expression',
        description: 'Set the animated character expression before the matching spoken emotional beat. Also match the voice delivery to this expression.',
        parameters: {
          type: 'OBJECT',
          properties: {
            expression: {
              type: 'STRING',
              enum: ['happy', 'sad', 'crying', 'surprised', 'thinking', 'angry', 'sleepy', 'laughing', 'excited'],
              description: 'The exact visual expression to show.',
            },
            intensity: {
              type: 'NUMBER',
              description: 'Expression strength from 0 to 1. Usually 0.65 to 1 for clear storytelling.',
            },
            energy: {
              type: 'NUMBER',
              description: 'Body animation energy from 0 to 1. Use lower values for sad/sleepy and higher values for excited/laughing.',
            },
          },
          required: ['expression'],
        },
      },
      {
        name: 'perform_character_action',
        description: 'Perform a short physical action when it naturally supports the spoken moment.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['wave', 'blink', 'jump'],
              description: 'Short physical action to perform.',
            },
          },
          required: ['action'],
        },
      },
      {
        name: 'set_character_pace',
        description: 'Set body locomotion for a story beat. Return to idle when movement is no longer useful.',
        parameters: {
          type: 'OBJECT',
          properties: {
            pace: {
              type: 'STRING',
              enum: ['idle', 'walk', 'run'],
              description: 'Idle, walking in place, or running in place.',
            },
          },
          required: ['pace'],
        },
      },
    ],
  },
];

interface TokenResponse {
  token: string;
  model: string;
}

interface FunctionCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

interface ServerMessage {
  setupComplete?: Record<string, never>;
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> };
  };
  toolCall?: { functionCalls?: FunctionCall[] };
  sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
  goAway?: { timeLeft?: string };
}

async function decodeSocketMessage(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }
  throw new Error(`Unsupported Gemini Live WebSocket message type: ${Object.prototype.toString.call(data)}`);
}

const clamp01 = (value: unknown, fallback: number) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
};

export class GeminiLiveClient {
  private socket: WebSocket | null = null;
  private setupComplete = false;
  private resumptionHandle: string | null = null;
  private reconnecting = false;
  private systemInstruction = '';

  constructor(private readonly callbacks: LiveCallbacks) {}

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN && this.setupComplete;
  }

  async connect(systemInstruction: string) {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.systemInstruction = systemInstruction.trim();
    this.callbacks.onStatus('connecting');

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error((await response.text()) || `Token request failed (${response.status})`);

    const { token, model }: TokenResponse = await response.json();
    if (model !== MODEL) throw new Error(`Unexpected Live model: ${model}`);
    await this.openSocket(token);
  }

  sendAudio(base64Pcm16: string) {
    if (!this.connected) return;
    this.send({ realtimeInput: { audio: { data: base64Pcm16, mimeType: 'audio/pcm;rate=16000' } } });
  }

  endAudioStream() {
    if (this.connected) this.send({ realtimeInput: { audioStreamEnd: true } });
  }

  sendText(text: string) {
    if (!this.connected || !text.trim()) return;
    this.send({ realtimeInput: { text: text.trim() } });
  }

  close() {
    this.reconnecting = false;
    this.setupComplete = false;
    this.socket?.close(1000, 'client close');
    this.socket = null;
    this.callbacks.onStatus('idle');
  }

  private async openSocket(token: string) {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`${LIVE_ENDPOINT}?access_token=${encodeURIComponent(token)}`);
      socket.binaryType = 'arraybuffer';
      this.socket = socket;

      let settled = false;
      let setupTimer: number | null = null;

      const clearSetupTimer = () => {
        if (setupTimer !== null) {
          window.clearTimeout(setupTimer);
          setupTimer = null;
        }
      };

      const resolveSetup = () => {
        if (settled) return;
        settled = true;
        clearSetupTimer();
        resolve();
      };

      const rejectSetup = (error: Error) => {
        if (settled) return;
        settled = true;
        clearSetupTimer();
        reject(error);
      };

      socket.addEventListener('open', () => {
        setupTimer = window.setTimeout(() => {
          const error = new Error('Gemini Live opened the socket but did not complete setup in time');
          this.callbacks.onError(error.message);
          this.callbacks.onStatus('error');
          rejectSetup(error);
          socket.close(1000, 'setup timeout');
        }, SETUP_TIMEOUT_MS);

        this.send({
          setup: {
            model: `models/${MODEL}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
            },
            systemInstruction: {
              parts: [
                {
                  text: `${this.systemInstruction || 'You are a warm, expressive conversational AI companion. Keep spoken responses natural and concise.'}\n\n${PERFORMANCE_PROTOCOL}`,
                },
              ],
            },
            tools,
            realtimeInputConfig: {
              activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
                prefixPaddingMs: 120,
                silenceDurationMs: 420,
              },
              turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            contextWindowCompression: { slidingWindow: {} },
            sessionResumption: this.resumptionHandle ? { handle: this.resumptionHandle } : {},
          },
        });
      });

      socket.addEventListener('message', async (event) => {
        let message: ServerMessage;
        try {
          const json = await decodeSocketMessage(event.data);
          message = JSON.parse(json) as ServerMessage;
        } catch (reason) {
          const error = reason instanceof Error ? reason : new Error('Could not decode Gemini Live message');
          console.error('Gemini Live message decode failed', error);
          if (!this.setupComplete) {
            this.callbacks.onError(error.message);
            this.callbacks.onStatus('error');
            rejectSetup(error);
          }
          return;
        }

        if (message.setupComplete !== undefined) {
          this.setupComplete = true;
          this.callbacks.onStatus('listening');
          resolveSetup();
        }

        if (message.toolCall?.functionCalls?.length) {
          const functionResponses = message.toolCall.functionCalls.map((call) => this.handleFunctionCall(call));
          this.send({ toolResponse: { functionResponses } });
        }

        const content = message.serverContent;
        if (content?.interrupted) {
          this.callbacks.onInterrupted();
          this.callbacks.onStatus('listening');
        }

        const input = content?.inputTranscription?.text?.trim();
        if (input) this.callbacks.onInputTranscript(input);

        const output = content?.outputTranscription?.text?.trim();
        if (output) this.callbacks.onOutputTranscript(output);

        for (const part of content?.modelTurn?.parts ?? []) {
          if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm')) {
            this.callbacks.onStatus('speaking');
            this.callbacks.onAudio(part.inlineData.data);
          }
        }

        if (content?.turnComplete) this.callbacks.onStatus('listening');

        if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
          this.resumptionHandle = message.sessionResumptionUpdate.newHandle;
        }

        if (message.goAway && !this.reconnecting) void this.resumeSession();
      });

      socket.addEventListener('error', () => {
        const error = new Error('Gemini Live WebSocket error');
        this.callbacks.onError(error.message);
        if (!this.setupComplete) {
          this.callbacks.onStatus('error');
          rejectSetup(error);
        }
      });

      socket.addEventListener('close', (event) => {
        const wasReady = this.setupComplete;
        this.setupComplete = false;
        clearSetupTimer();

        if (!wasReady) {
          const detail = event.reason ? `: ${event.reason}` : '';
          rejectSetup(new Error(`Gemini Live closed before setup completed (code ${event.code})${detail}`));
        }

        if (!event.wasClean && wasReady && this.resumptionHandle && !this.reconnecting) {
          void this.resumeSession();
        } else if (!this.reconnecting && wasReady) {
          this.callbacks.onStatus('idle');
        }
      });
    });
  }

  private handleFunctionCall(call: FunctionCall) {
    const name = call.name ?? 'unknown';
    const args = call.args ?? {};
    try {
      if (name === 'set_character_expression') {
        const expression = String(args.expression ?? '') as CharacterExpressionName;
        const allowed: CharacterExpressionName[] = ['happy', 'sad', 'crying', 'surprised', 'thinking', 'angry', 'sleepy', 'laughing', 'excited'];
        if (!allowed.includes(expression)) throw new Error(`Unsupported expression: ${expression}`);
        this.callbacks.onCharacterExpression({
          expression,
          intensity: clamp01(args.intensity, 1),
          energy: clamp01(args.energy, expression === 'sleepy' || expression === 'sad' ? 0.25 : expression === 'excited' || expression === 'laughing' ? 0.85 : 0.5),
        });
      } else if (name === 'perform_character_action') {
        const action = String(args.action ?? '') as CharacterActionName;
        if (!['wave', 'blink', 'jump'].includes(action)) throw new Error(`Unsupported action: ${action}`);
        this.callbacks.onCharacterAction(action);
      } else if (name === 'set_character_pace') {
        const pace = String(args.pace ?? '') as CharacterPace;
        if (!['idle', 'walk', 'run'].includes(pace)) throw new Error(`Unsupported pace: ${pace}`);
        this.callbacks.onCharacterPace(pace);
      } else {
        throw new Error(`Unknown character tool: ${name}`);
      }
      return { id: call.id, name, response: { result: 'ok' } };
    } catch (error) {
      return {
        id: call.id,
        name,
        response: { result: 'error', message: error instanceof Error ? error.message : 'Character tool failed' },
      };
    }
  }

  private async resumeSession() {
    if (this.reconnecting || !this.resumptionHandle) return;
    this.reconnecting = true;
    try {
      this.socket?.close(1000, 'session resume');
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Token refresh failed (${response.status})`);
      const { token } = (await response.json()) as TokenResponse;
      await this.openSocket(token);
    } catch (error) {
      this.callbacks.onError(error instanceof Error ? error.message : 'Could not resume Live session');
      this.callbacks.onStatus('error');
    } finally {
      this.reconnecting = false;
    }
  }

  private send(payload: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }
}
