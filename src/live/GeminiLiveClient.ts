import { normalizePerformanceCue, type PerformanceCue } from '../character/performance';
import type { LiveCallbacks } from './types';

const MODEL = 'gemini-3.1-flash-live-preview';
const TOKEN_ENDPOINT = '/api/gemini-token';
const LIVE_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
const SETUP_TIMEOUT_MS = 12_000;
const PERFORMANCE_TOOL = 'direct_character';

const PERFORMANCE_GUIDANCE = `
You can direct the on-screen character with the direct_character tool before speaking.
Use it for semantic acting intent, never low-level animation. Prefer one call before a substantive response when body language helps.
Keep many casual turns subtle: gesture="none" is valid and desirable. Avoid repeating the same gesture on consecutive turns.
Choose affect, posture and gaze based on the meaning you are about to communicate. The local character engine handles exact timing, motion and interruption.
`;

const performanceTool = {
  functionDeclarations: [
    {
      name: PERFORMANCE_TOOL,
      description: 'Set the semantic acting intention for the on-screen character immediately before the spoken response. Use meaning-level cues only; local animation code chooses exact timing and motion.',
      parametersJsonSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          affect: {
            type: 'string',
            enum: ['neutral', 'warm', 'curious', 'enthusiastic', 'reassuring', 'concerned', 'surprised', 'thoughtful', 'playful'],
          },
          intensity: { type: 'number', minimum: 0, maximum: 1 },
          gesture: {
            type: 'string',
            enum: ['none', 'explain', 'emphasize', 'reassure', 'agree', 'disagree', 'think', 'celebrate', 'shrug', 'greet', 'goodbye'],
          },
          posture: { type: 'string', enum: ['neutral', 'engaged', 'lean_in', 'lean_back', 'open'] },
          gaze: { type: 'string', enum: ['user', 'thinking_up', 'thinking_side', 'away', 'auto'] },
        },
        required: ['affect', 'intensity', 'gesture', 'posture', 'gaze'],
      },
    },
  ],
};

interface TokenResponse {
  token: string;
  model: string;
}

interface FunctionCall {
  id?: string;
  name: string;
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
  toolCallCancellation?: { ids?: string[] };
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

export class GeminiLiveClient {
  private socket: WebSocket | null = null;
  private setupComplete = false;
  private resumptionHandle: string | null = null;
  private reconnecting = false;
  private systemInstruction = '';
  private activePerformanceCallIds = new Set<string>();

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
    this.activePerformanceCallIds.clear();
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
                  text: `${this.systemInstruction || 'You are a warm, expressive conversational AI companion. Keep spoken responses natural and concise.'}\n\n${PERFORMANCE_GUIDANCE}`,
                },
              ],
            },
            tools: [performanceTool],
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
          this.handleToolCalls(message.toolCall.functionCalls);
        }

        if (message.toolCallCancellation?.ids?.length) {
          const cancelledPerformance = message.toolCallCancellation.ids.some((id) => this.activePerformanceCallIds.has(id));
          for (const id of message.toolCallCancellation.ids) this.activePerformanceCallIds.delete(id);
          if (cancelledPerformance) this.callbacks.onPerformanceCancelled();
        }

        const content = message.serverContent;
        if (content?.interrupted) {
          this.callbacks.onInterrupted();
          this.callbacks.onPerformanceCancelled();
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

  private handleToolCalls(functionCalls: FunctionCall[]) {
    const functionResponses = functionCalls.map((call) => {
      if (call.name === PERFORMANCE_TOOL) {
        const cue = normalizePerformanceCue((call.args ?? {}) as Partial<PerformanceCue>);
        this.callbacks.onPerformanceCue(cue);
        if (call.id) this.activePerformanceCallIds.add(call.id);
        return {
          id: call.id,
          name: call.name,
          response: { result: 'Character direction accepted. Local animation timing is active.' },
        };
      }

      return {
        id: call.id,
        name: call.name,
        response: { error: `Unknown client tool: ${call.name}` },
      };
    });

    this.send({ toolResponse: { functionResponses } });
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
