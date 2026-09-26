import { parseFlight, type FlightCommand } from '../core/flight.ts';
import { performanceInstructions, type AvatarContext } from './performancePrompt.ts';
import { expressions, gestures, parseCue } from '../core/types.ts';
import type { Cue } from '../core/types.ts';
export interface LiveEvents {
  model?(value: string): void;
  rejectedCue?(id: string, tool?: string): void;
  flight?(id: string, command: FlightCommand): boolean;
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
  name: 'perform', description: 'Actually change your visible avatar face and gesture. Use proactively at emotional beats throughout speech, and for every requested expression or action. Use immediate for direct requests, with_speech during narrated sentences. Continue speaking naturally.', behavior: 'NON_BLOCKING',
  parameters: { type: 'OBJECT', properties: {
    expression: { type: 'STRING', enum: [...expressions] }, gesture: { type: 'STRING', enum: [...gestures] },
    timing: { type: 'STRING', enum: ['immediate', 'with_speech'], description: 'immediate for explicit face/gesture requests; with_speech applies during currently playing or queued speech; call while narrating, not after the reply.' },
    intensity: { type: 'NUMBER', description: '0 to 1. Prefer 0.55 to 0.9 for clearly readable acting.' },
    duration: { type: 'NUMBER', description: 'Hold in seconds, 0.6 to 6.' },
  }, required: ['expression'] },
};
export const flightTool = {
  name: 'fly', description: 'Move the currently visible winged avatar inside its stage, independently of face, hands and speech. Only sprites can fly. Starts immediately, including during speech. Continue speaking without waiting for arrival; never repeat a sentence after calling. Coordinates are screen-relative, not RTL. New move smoothly replaces the current destination; hover brakes in place; land descends to the floor.', behavior: 'NON_BLOCKING',
  parameters: { type: 'OBJECT', properties: {
    action: { type: 'STRING', enum: ['move','hover','land'] },
    x: { type: 'NUMBER', description: '0 left to 1 right inside safe stage bounds. Required for move; default center for land.' },
    y: { type: 'NUMBER', description: '0 high, 1 floor. Required for move, ignored for land/hover.' },
    speed: { type: 'NUMBER', description: '0.1 gentle to 1 brisk. Default 0.5. Smooth acceleration and braking are automatic.' },
    path: { type: 'STRING', enum: ['direct','arc','swoop'], description: 'direct travels straight; arc curves upward; swoop dips downward. Default direct.' },
  }, required: ['action'] },
};
export class GeminiAdapter {
  private events: LiveEvents;
  private avatar: AvatarContext = { name: 'إمبر', species: 'fox' };
  private cueSequence = 0;
  private acknowledged = new Set<string>();
  private avatarDirty = false;
  setAvatar(avatar: AvatarContext) { this.avatar = avatar; if(this.socket)this.avatarDirty = true; }
  private socket: WebSocket | null = null;
  private generation = 0;
  private controller: AbortController | null = null;
  private handle: string | null = null;
  private ready = false;
  private receiving = false;
  private turnId = 0;
  private resuming = false;
  private cancelSetup: (() => void) | null = null;
  private localSpeaking = false;
  private localHotMs = 0;
  private localQuietMs = 0;
  private localNoiseFloor = 0.0035;
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
    this.events.model?.(token.model);
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
        this.avatarDirty = false;
        this.send({ setup: { model: `models/${token.model}`, generationConfig: { responseModalities: ['AUDIO'] },
          systemInstruction: { parts: [{ text: performanceInstructions(this.avatar) }] }, tools: [{ functionDeclarations: [performanceTool, flightTool] }],
          realtimeInputConfig: { activityHandling: 'START_OF_ACTIVITY_INTERRUPTS', automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
            endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
            prefixPaddingMs: 180,
            silenceDurationMs: 650,
          } },
          inputAudioTranscription: { languageCodes: ['ar-EG', 'en-US'] }, outputAudioTranscription: {}, contextWindowCompression: { slidingWindow: {} },
          sessionResumption: this.handle ? { handle: this.handle } : {} } });
      };
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
    if (!content?.interrupted && content?.outputTranscription?.text) { this.begin(); this.events.transcript('assistant', content.outputTranscription.text); }
    const responses: {id?:string;name:string;scheduling:'SILENT';response:{result:string;avatar?:AvatarContext}}[] = [];
    for (const call of message.toolCall?.functionCalls ?? []) {
      if (call.id && this.acknowledged.has(call.id)) continue;
      if (call.id) this.acknowledged.add(call.id);
      if (content?.interrupted) {
        responses.push({id:call.id,name:call.name,scheduling:'SILENT',response:{result:'cancelled'}});
        continue;
      }
      this.begin();
      const cueId = call.id ?? `cue-${this.turnId}-${++this.cueSequence}`;
      let result = 'invalid stage direction';
      if (call.name === 'fly') {
        const flight = parseFlight(call.args);
        if (flight) result = this.events.flight?.(cueId, flight) ? 'accepted' : 'not applied: current avatar cannot fly or session interrupted';
        else this.events.rejectedCue?.(cueId, 'fly');
      } else {
        const cue = call.name === 'perform' ? parseCue(call.args) : null;
        if (cue) { this.events.cue(cueId, cue); result = 'accepted'; }
        else this.events.rejectedCue?.(cueId, call.name);
      }
      responses.push({ id: call.id, name: call.name, scheduling: 'SILENT',
        response: { result, ...(this.avatarDirty ? {avatar:{...this.avatar,canFly:!!this.avatar.canFly}} : {}) } });
    }
    if (responses.length) { this.send({toolResponse:{functionResponses:responses}}); if(!content?.interrupted)this.avatarDirty=false; }
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
  private observeLocalSpeechEnd(data: string) {
    try {
      const raw = atob(data);
      if (raw.length < 2) return false;
      const view = new DataView(new ArrayBuffer(raw.length));
      for (let i = 0; i < raw.length; i++) view.setUint8(i, raw.charCodeAt(i));
      let energy = 0;
      const samples = Math.floor(raw.length / 2);
      for (let i = 0; i < samples; i++) {
        const value = view.getInt16(i * 2, true) / 32768;
        energy += value * value;
      }
      const rms = Math.sqrt(energy / Math.max(1, samples));
      const chunkMs = samples / 16000 * 1000;
      const startThreshold = Math.max(0.012, this.localNoiseFloor * 3.2);
      const endThreshold = Math.max(0.007, startThreshold * 0.58);
      if (!this.localSpeaking) {
        if (rms < 0.03) this.localNoiseFloor = this.localNoiseFloor * 0.985 + rms * 0.015;
        this.localHotMs = rms >= startThreshold ? this.localHotMs + chunkMs : 0;
        if (this.localHotMs >= 80) {
          this.localSpeaking = true;
          this.localHotMs = 0;
          this.localQuietMs = 0;
        }
        return false;
      }
      this.localQuietMs = rms <= endThreshold ? this.localQuietMs + chunkMs : 0;
      if (this.localQuietMs < 720) return false;
      this.localSpeaking = false;
      this.localQuietMs = 0;
      this.localHotMs = 0;
      return true;
    } catch {
      return false;
    }
  }
  audio(data: string) {
    if (!this.ready) return;
    this.send({ realtimeInput: { audio: { data, mimeType: 'audio/pcm;rate=16000' } } });
    if (this.observeLocalSpeechEnd(data)) this.audioStreamEnd();
  }
  audioStreamEnd() { if (this.ready) this.send({ realtimeInput: { audioStreamEnd: true } }); }
  text(text: string) { if (this.ready && text.trim()) this.send({ realtimeInput: { text: text.trim() } }); }
  close() {
    ++this.generation; this.controller?.abort(); this.cancelSetup?.(); this.cancelSetup = null;
    const socket = this.socket; this.socket = null; socket?.close();
    this.ready = false; this.receiving = false; this.handle = null; this.resuming = false; this.acknowledged.clear();
    this.localSpeaking = false; this.localHotMs = 0; this.localQuietMs = 0; this.localNoiseFloor = 0.0035;
    this.events.status('offline');
  }
  private send(data: unknown) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(data)); }
}
