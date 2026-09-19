import type {
  CharacterActionName,
  CharacterExpressionName,
  CharacterPace,
  LiveCallbacks,
} from './types';

const MODEL = 'gemini-3.8-live';
const TOKEN_ENDPOINT = '/api/gemini-token';
const LIVE_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
const SETUP_TIMEOUT_MS = 12_000;

const EXPRESSIONS: CharacterExpressionName[] = [
  'happy',
  'sad',
  'crying',
  'surprised',
  'thinking',
  'angry',
  'sleepy',
  'laughing',
  'excited',
];

const PERFORMANCE_PROTOCOL = `
You are embodied as a live animated character. Your face, body, and spoken delivery are one synchronized performance.

AVAILABLE SILENT STAGE TOOLS
- set_character_expression: happy, sad, crying, surprised, thinking, angry, sleepy, laughing, excited
- perform_character_action: wave, blink, jump
- set_character_pace: idle, walk, run

IMPORTANT: these tools are NON-BLOCKING stage directions. They do not end your spoken turn and their responses are SILENT. Continue speaking naturally while using them.

PERFORMANCE TIMING
- Do NOT choose one expression for an entire answer.
- Change expression whenever the emotional beat changes, including multiple times inside the SAME spoken turn.
- Call set_character_expression immediately BEFORE the words that should carry that emotion.
- For a substantial story turn, normally use 3-7 meaningful expression changes when the scene genuinely supports them.
- Keep an expression long enough to read. Do not flicker or spam tools for every word.
- Actions are accents: wave for greeting/goodbye, blink naturally, jump for a strong joyful or startled beat.
- Pace is scene movement: use walk/run only while the story is physically moving, then return to idle.
- Never speak tool names, expression labels, stage directions, or implementation details aloud.

VOICE ACTING MUST MATCH THE CURRENT VISUAL EXPRESSION
- happy: warm, smiling, buoyant, easy rhythm.
- sad: gentler, quieter, slightly slower, with sincere pauses.
- crying: soft and emotionally shaky, with a light tremble and broken cadence as if holding back tears; remain intelligible and comforting for a child.
- surprised: quick bright onset, widened pitch, and a short startled breath when natural.
- thinking: reflective pacing, small pauses, curious tone.
- angry: controlled firmness and tension, never shouting at or frightening a child.
- sleepy: softer, slower, drowsy and relaxed.
- laughing: genuinely amused, smiling voice, with a natural light chuckle when appropriate.
- excited: brighter, faster, energetic, and clear.

CHILDREN'S STORYTELLING
Perform the scene instead of announcing emotions. Tell stories in short interactive beats, use character voices lightly, pause for suspense, let the child interrupt, and ask a simple question at meaningful moments. Within a single spoken response, let the performance evolve naturally as the story beat evolves: for example happy -> surprised -> thinking -> worried/sad -> excited, rather than staying visually frozen until the next user turn.
`;

const tools = [
  {
    functionDeclarations: [
      {
        name: 'set_character_expression',
        behavior: 'NON_BLOCKING',
        description: 'Non-blocking silent stage direction. Change the animated expression immediately before the matching spoken emotional beat, including several times during one spoken turn.',
        parameters: {
          type: 'OBJECT',
          properties: {
            expression: {
              type: 'STRING',
              enum: EXPRESSIONS,
              description: 'The exact visual expression to show now.',
            },
            intensity: {
              type: 'NUMBER',
              description: 'Expression strength from 0 to 1. Usually 0.65 to 1 for readable storytelling.',
            },
            energy: {
              type: 'NUMBER',
              description: 'Body animation energy from 0 to 1. Keep sad/sleepy lower and excited/laughing higher.',
            },
          },
          required: ['expression'],
        },
      },
      {
        name: 'perform_character_action',
        behavior: 'NON_BLOCKING',
        description: 'Non-blocking silent physical accent that may happen while speech continues.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['wave', 'blink', 'jump'],
              description: 'Short physical action to perform now.',
            },
          },
          required: ['action'],
        },
      },
      {
        name: 'set_character_pace',
        behavior: 'NON_BLOCKING',
        description: 'Non-blocking silent locomotion direction for the current story beat. Return to idle when movement ends.',
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

const silentResponse = (call: FunctionCall, name: string, response: Record<string, unknown>) => ({
  id: call.id,
  name,
  response: {
    ...response,
    scheduling: 'SILENT',
  },
});

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
          // Gemini 3.8 can keep generating audio while these NON_BLOCKING stage
          // directions execute. SILENT responses acknowledge the cue without
          // turning the tool result into a new spoken interruption.
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
        if (!EXPRESSIONS.includes(expression)) throw new Error(`Unsupported expression: ${expression}`);
        this.callbacks.onCharacterExpression({
          expression,
          intensity: clamp01(args.intensity, 1),
          energy: clamp01(
            args.energy,
            expression === 'sleepy' || expression === 'sad' || expression === 'crying'
              ? 0.25
              : expression === 'excited' || expression === 'laughing'
                ? 0.85
                : 0.5,
          ),
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

      return silentResponse(call, name, { result: 'ok' });
    } catch (error) {
      return silentResponse(call, name, {
        result: 'error',
        message: error instanceof Error ? error.message : 'Character tool failed',
      });
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
