import { Application, type Ticker } from 'pixi.js';
import { MicrophonePcmStream } from '../audio/MicrophonePcmStream';
import { PcmPlaybackQueue } from '../audio/PcmPlaybackQueue';
import { LocalPerformanceEngine } from '../character/LocalPerformanceEngine';
import { DirectedNovaCharacter } from '../character/DirectedNovaCharacter';
import type { CharacterMode, PerformanceCue } from '../character/performance';
import type { Emotion } from '../character/types';
import { GeminiLiveClient } from '../live/GeminiLiveClient';
import type { LiveStatus } from '../live/types';
import { NovaFlightController, type FlyToOptions, type Point2D } from './NovaFlightController';

export interface NovaLiveControllerEvents {
  onReady?: () => void;
  onStatus?: (status: LiveStatus) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onError?: (message: string) => void;
  onPerformance?: (cue: PerformanceCue, source: 'local' | 'tool' | 'manual') => void;
}

export interface NovaLiveControllerOptions extends NovaLiveControllerEvents {
  container: HTMLElement;
  systemPrompt?: string;
  width?: number;
  height?: number;
  background?: number;
  transparent?: boolean;
}

const defaultPrompt = `You are Nova, a warm, playful AI companion. Keep spoken responses clear, concise and expressive.`;

/** Headless/browser controller used by the web component and future npm package. */
export class NovaLiveController {
  readonly character = new DirectedNovaCharacter();
  readonly microphone = new MicrophonePcmStream();
  readonly performance: LocalPerformanceEngine;
  readonly playback: PcmPlaybackQueue;
  readonly live: GeminiLiveClient;
  readonly flight: NovaFlightController;

  private app: Application | null = null;
  private status: LiveStatus = 'idle';
  private mode: CharacterMode = 'idle';
  private systemPrompt: string;
  private playbackActive = false;
  private userActive = false;
  private textTurnPending = false;
  private silenceStarted: number | null = null;
  private pendingToolCue: PerformanceCue | null = null;
  private destroyed = false;
  private readonly events: NovaLiveControllerEvents;

  constructor(private readonly options: NovaLiveControllerOptions) {
    this.events = options;
    this.systemPrompt = options.systemPrompt?.trim() || defaultPrompt;
    this.flight = new NovaFlightController(this.character.view);

    this.performance = new LocalPerformanceEngine({
      onCue: (cue, source) => {
        this.character.perform(cue);
        this.events.onPerformance?.(cue, source);
      },
    });

    this.playback = new PcmPlaybackQueue(
      (pose) => this.character.setMouth(pose, true),
      () => this.character.settleMouth(),
      {
        onSpeechStart: () => {
          this.playbackActive = true;
          this.userActive = false;
          this.textTurnPending = false;
          this.setMode('speaking');
          const cue = this.pendingToolCue;
          this.pendingToolCue = null;
          this.performance.beginSpeech(cue);
        },
        onSpeechDynamics: (dynamics) => {
          this.performance.updateSpeech(dynamics);
          this.character.setSpeechEnergy(dynamics.energy);
        },
        onSpeechEnd: () => {
          this.playbackActive = false;
          this.character.setSpeechEnergy(0);
          this.performance.endSpeech();
          this.setMode(this.status === 'listening' ? 'listening' : 'thinking');
        },
      },
    );

    this.live = new GeminiLiveClient({
      onStatus: (status) => this.setStatus(status),
      onAudio: (audio) => void this.playback.enqueue(audio),
      onInputTranscript: (text) => {
        this.performance.pushInputTranscript(text);
        this.events.onInputTranscript?.(text);
      },
      onOutputTranscript: (text) => {
        this.playback.pushTranscript(text);
        this.performance.pushOutputTranscript(text);
        this.events.onOutputTranscript?.(text);
      },
      onPerformanceCue: (cue) => {
        if (this.playbackActive) this.performance.applyToolCue(cue);
        else {
          this.pendingToolCue = { ...cue };
          this.character.perform({ ...cue, gesture: 'none', intensity: Math.min(0.24, cue.intensity * 0.32) });
          this.setMode('thinking');
        }
      },
      onPerformanceCancelled: () => {
        this.pendingToolCue = null;
        this.character.interruptPerformance();
      },
      onInterrupted: () => {
        this.pendingToolCue = null;
        this.textTurnPending = false;
        this.playback.interrupt();
        this.character.interruptPerformance();
        this.setMode('listening');
      },
      onError: (message) => this.events.onError?.(message),
    });
  }

  async init() {
    if (this.app) return;
    const width = this.options.width ?? Math.max(320, this.options.container.clientWidth || 640);
    const height = this.options.height ?? Math.max(360, this.options.container.clientHeight || 640);
    const app = new Application();
    await app.init({
      width,
      height,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      background: this.options.background ?? 0x090b22,
      backgroundAlpha: this.options.transparent ? 0 : 1,
      resizeTo: this.options.container,
    });
    this.app = app;
    this.options.container.appendChild(app.canvas);
    app.stage.addChild(this.character.view);
    const center = { x: width / 2, y: height * 0.52 };
    this.flight.setHome(center, true);
    this.character.view.scale.set(Math.min(width, height) / 520);
    app.ticker.add(this.tick);
    this.events.onReady?.();
  }

  setSystemPrompt(prompt: string) { this.systemPrompt = prompt.trim() || defaultPrompt; }
  setEmotion(emotion: Emotion) { this.character.setEmotion(emotion); }
  lookAt(x: number, y: number) { this.character.lookAt(x, y); }
  perform(cue: PerformanceCue) {
    this.character.perform(cue);
    this.events.onPerformance?.(cue, 'manual');
  }
  flyTo(options: FlyToOptions) { this.flight.flyTo(options); }
  flyHome(speed = 1) { this.flight.flyHome(speed); }
  snapTo(point: Point2D) { this.flight.snapTo(point); }

  async connect() {
    if (this.live.connected) return;
    await this.live.connect(this.systemPrompt);
    await this.microphone.start(
      (chunk) => this.live.sendAudio(chunk),
      (level) => this.handleMicLevel(level),
    );
    this.setMode('listening');
  }

  sendText(text: string) {
    if (!text.trim()) return;
    this.textTurnPending = true;
    this.userActive = false;
    this.live.sendText(text);
    this.performance.pushInputTranscript(text);
    this.setMode('thinking');
  }

  async disconnect() {
    this.pendingToolCue = null;
    this.userActive = false;
    this.textTurnPending = false;
    this.live.endAudioStream();
    this.live.close();
    await this.microphone.stop();
    this.playback.interrupt();
    this.performance.endSpeech();
    this.setStatus('idle');
    this.setMode('idle');
  }

  async destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    await this.disconnect();
    await this.playback.close();
    if (this.app) {
      this.app.ticker.remove(this.tick);
      this.app.destroy(true, { children: true });
      this.app = null;
    }
  }

  private readonly tick = (ticker: Ticker) => {
    const dt = Math.min(0.033, ticker.deltaMS / 1000);
    this.flight.update(dt);
    this.character.update(ticker);
  };

  private setStatus(next: LiveStatus) {
    const previous = this.status;
    this.status = next;
    this.events.onStatus?.(next);
    if (previous === 'speaking' && next === 'listening') this.playback.markTurnComplete();
    if (next === 'idle' || next === 'error') this.setMode('idle');
    else if (next === 'connecting') this.setMode('thinking');
    else if (next === 'listening' && !this.playbackActive) this.setMode(this.userActive ? 'listening' : this.mode === 'thinking' ? 'thinking' : 'listening');
    else if (next === 'speaking' && !this.playbackActive) this.setMode('thinking');
  }

  private setMode(mode: CharacterMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.performance.setMode(mode);
    this.character.setMode(mode);
  }

  private handleMicLevel(level: number) {
    if (this.playbackActive || this.textTurnPending) {
      this.userActive = false;
      this.silenceStarted = null;
      return;
    }
    const now = performance.now();
    if (level >= 0.065) {
      this.userActive = true;
      this.silenceStarted = null;
      this.setMode('listening');
      return;
    }
    if (!this.userActive) return;
    if (level > 0.028) {
      this.silenceStarted = null;
      return;
    }
    if (this.silenceStarted === null) {
      this.silenceStarted = now;
      return;
    }
    if (now - this.silenceStarted < 560) return;
    this.userActive = false;
    this.silenceStarted = null;
    this.live.endAudioStream();
    this.setMode('thinking');
  }
}
