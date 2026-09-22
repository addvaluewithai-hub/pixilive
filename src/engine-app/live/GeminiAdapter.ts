import { expressions, gestures, parseCue } from '../core/types.ts';
import type { Cue } from '../core/types.ts';
export interface LiveEvents {
  status(value: 'connecting' | 'connected' | 'offline'): void;
  turn(id: number): void; audio(data: string, rate: number): void;
  cue(id: string, value: Cue): void; cancel(ids: string[]): void;
  transcript(role: 'user' | 'assistant', text: string): void;
  interrupted(): void; complete(): void; error(message: string): void;
}
interface ServerMessage {
  setupComplete?: object; error?: { message?: string };
  serverContent?: { interrupted?: boolean; turnComplete?: boolean;
    inputTranscription?: { text?: string }; outputTranscription?: { text?: string };
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } };
  toolCall?: { functionCalls?: { id?: string; name: string; args?: unknown }[] };
  toolCallCancellation?: { ids?: string[] };
  sessionResumptionUpdate?: { resumable?: boolean; newHandle?: string };
  goAway?: object;
}
export const performanceTool = {
  name: 'perform', description: 'Choose a restrained facial expression and optional gesture for the next spoken beat. Never describe this tool aloud.', behavior: 'NON_BLOCKING',
  parameters: { type: 'OBJECT', properties: {
    expression: { type: 'STRING', enum: [...expressions] }, gesture: { type: 'STRING', enum: [...gestures] },
    intensity: { type: 'NUMBER', description: '0 to 1. Prefer 0.3 to 0.7.' },
    duration: { type: 'NUMBER', description: 'Hold in seconds, 0.6 to 6.' },
  }, required: ['expression'] },
};
const direction = `You are a warm conversational companion. Speak Egyptian Arabic unless the user prefers another language. Keep replies natural and concise. Your visual avatar can change while your identity and conversation stay the same. Match your vocal expression to the meaning. Use perform shortly BEFORE the next phrase when an expression or gesture adds meaning. Prefer one or two restrained cues per reply. Never call a tool for every word. Tools are silent stage directions. Continue speaking after the tool result; never announce its execution. Do not jump or celebrate during serious or sad conversation. Allow interruption naturally.`;
export class GeminiAdapter {
  private events: LiveEvents;
  private socket: WebSocket | null = null;
  private generation = 0;
  private controller: AbortController | null = null;
  private handle: string | null = null;
  private ready = false;
  private receiving = false;
  private turnId = 0;
  private resuming = false;
  private cancelSetup: (() => void) | null = null;
  constructor(events: LiveEvents) { this.events = events; }
  async connect() {
    this.close(); const generation = ++this.generation;
    this.events.status('connecting');
    try { await this.open(generation); } catch (error) {
      if (generation === this.generation) { this.close(); throw error; }
    }
  }
  private async open(generation: number) {
    this.controller?.abort(); this.controller = new AbortController();
    const response = await fetch('/api/gemini-token', { method: 'POST', signal: this.controller.signal });
    const token = await response.json().catch(() => ({})) as { token?: string; model?: string; error?: string };
    if (!response.ok || !token.token || !token.model) throw new Error(token.error ?? 'تعذّر بدء Gemini. شغّل التطبيق بخادم الصوت واضبط المفتاح.');
    if (generation !== this.generation) return;
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token.token!)}`);
      socket.binaryType = 'arraybuffer'; this.socket = socket; this.ready = false;
      let settled = false;
      const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); this.cancelSetup = null; error ? reject(error) : resolve(); };
      const timer = window.setTimeout(() => { finish(new Error('Gemini لم يكمل الاتصال. جرّب مرة تانية.')); socket.close(); }, 12000);
      this.cancelSetup = () => finish(new Error('Connection cancelled'));
      const current = () => generation === this.generation && this.socket === socket;
      socket.onopen = () => {
        if (!current()) return;
        this.send({ setup: { model: `models/${token.model}`, generationConfig: { responseModalities: ['AUDIO'] },
          systemInstruction: { parts: [{ text: direction }] }, tools: [{ functionDeclarations: [performanceTool] }],
          realtimeInputConfig: { activityHandling: 'START_OF_ACTIVITY_INTERRUPTS', automaticActivityDetection: { disabled: false, prefixPaddingMs: 120, silenceDurationMs: 420 } },
          inputAudioTranscription: {}, outputAudioTranscription: {}, contextWindowCompression: { slidingWindow: {} },
          sessionResumption: this.handle ? { handle: this.handle } : {} } });
      };
      // Ordered decoding also handles Blob frames without racing later frames.
      let messages = Promise.resolve();
      socket.onmessage = event => { messages = messages.then(async () => {
        if (!current()) return;
        const raw = typeof event.data === 'string' ? event.data : event.data instanceof Blob ? await event.data.text() : new TextDecoder().decode(event.data);
        if (!current()) return;
        const message = JSON.parse(raw) as ServerMessage;
        if (message.error) throw new Error(message.error.message ?? 'Gemini error');
        if (message.setupComplete !== undefined) { this.ready = true; this.events.status('connected'); finish(); }
        this.receive(message);
      }).catch(error => { if (current()) { finish(error instanceof Error ? error : new Error(String(error))); this.events.error('حصل خطأ في اتصال Gemini. ابدأ الجلسة مرة تانية.'); this.close(); } }); };
      socket.onerror = () => { if (!current()) return; finish(new Error('تعذّر فتح اتصال Gemini.')); this.events.error('اتصال Gemini اتقطع.'); this.close(); };
      socket.onclose = () => {
        if (!current()) return;
        const wasReady = this.ready; this.ready = false;
        finish(new Error('Gemini أغلق الاتصال قبل اكتماله.'));
        if (wasReady && this.handle && !this.resuming) void this.resume(generation);
        else if (!this.resuming) { this.events.status('offline'); this.events.interrupted(); }
      };
    });
  }
  private begin() { if (!this.receiving) { this.receiving = true; this.events.turn(++this.turnId); } }
  private receive(message: ServerMessage) {
    const content = message.serverContent;
    if (content?.interrupted) { this.receiving = false; this.events.interrupted(); }
    if (message.toolCallCancellation?.ids) this.events.cancel(message.toolCallCancellation.ids);
    if (content?.inputTranscription?.text) this.events.transcript('user', content.inputTranscription.text);
    if (content?.outputTranscription?.text) { this.begin(); this.events.transcript('assistant', content.outputTranscription.text); }
    for (const call of message.toolCall?.functionCalls ?? []) {
      this.begin(); const cue = call.name === 'perform' ? parseCue(call.args) : null;
      if (cue) this.events.cue(call.id ?? `cue-${this.turnId}`, cue);
      this.send({ toolResponse: { functionResponses: [{ id: call.id, name: call.name,
        response: { result: cue ? 'queued' : 'invalid stage direction', scheduling: 'SILENT' } }] } });
    }
    if (!content?.interrupted) for (const part of content?.modelTurn?.parts ?? []) {
      const data = part.inlineData;
      if (data?.data && data.mimeType?.startsWith('audio/pcm')) {
        this.begin(); const rate = Number(/rate=(\d+)/.exec(data.mimeType)?.[1] ?? 24000); this.events.audio(data.data, rate);
      }
    }
    if (content?.turnComplete) { this.receiving = false; this.events.complete(); }
    if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) this.handle = message.sessionResumptionUpdate.newHandle;
    if (message.goAway) void this.resume(this.generation);
  }
  private async resume(generation: number) {
    if (this.resuming || !this.handle || generation !== this.generation) return;
    this.resuming = true; const old = this.socket; this.socket = null; old?.close(); this.events.status('connecting');
    try { await this.open(generation); } catch { if (generation === this.generation) { this.events.error('تعذّر استكمال الجلسة. ابدأ جلسة جديدة.'); this.close(); } }
    finally { this.resuming = false; }
  }
  audio(data: string) { if (this.ready) this.send({ realtimeInput: { audio: { data, mimeType: 'audio/pcm;rate=16000' } } }); }
  text(text: string) { if (this.ready && text.trim()) this.send({ realtimeInput: { text: text.trim() } }); }
  close() {
    ++this.generation; this.controller?.abort(); this.cancelSetup?.(); this.cancelSetup = null;
    const socket = this.socket; this.socket = null; socket?.close();
    this.ready = false; this.receiving = false; this.handle = null; this.resuming = false; this.events.status('offline');
  }
  private send(data: unknown) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(data)); }
}
