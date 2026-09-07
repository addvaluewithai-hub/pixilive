import type { LiveCallbacks } from './types';

const MODEL = 'gemini-3.1-flash-live-preview';
const TOKEN_ENDPOINT = '/api/gemini-token';
const LIVE_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

interface TokenResponse {
  token: string;
  model: string;
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
  sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
  goAway?: { timeLeft?: string };
}

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
    const response = await fetch(TOKEN_ENDPOINT, { method: 'POST', headers: { accept: 'application/json' } });
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
      this.socket = socket;

      socket.addEventListener('open', () => {
        this.send({
          setup: {
            model: `models/${MODEL}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
            },
            systemInstruction: {
              parts: [
                {
                  text: this.systemInstruction || 'You are a warm, expressive conversational AI companion. Keep spoken responses natural and concise.',
                },
              ],
            },
            realtimeInputConfig: {
              activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
              automaticActivityDetection: {
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
                prefixPaddingMs: 120,
                silenceDurationMs: 420,
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            contextWindowCompression: { slidingWindow: {} },
            sessionResumption: this.resumptionHandle ? { handle: this.resumptionHandle } : {},
          },
        });
      });

      socket.addEventListener('message', (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        if (message.setupComplete) {
          this.setupComplete = true;
          this.callbacks.onStatus('listening');
          resolve();
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
        if (!this.setupComplete) reject(error);
      });

      socket.addEventListener('close', (event) => {
        const wasReady = this.setupComplete;
        this.setupComplete = false;
        if (!event.wasClean && wasReady && this.resumptionHandle && !this.reconnecting) void this.resumeSession();
        else if (!this.reconnecting) this.callbacks.onStatus('idle');
      });
    });
  }

  private async resumeSession() {
    if (this.reconnecting || !this.resumptionHandle) return;
    this.reconnecting = true;
    try {
      this.socket?.close(1000, 'session resume');
      const response = await fetch(TOKEN_ENDPOINT, { method: 'POST', headers: { accept: 'application/json' } });
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
