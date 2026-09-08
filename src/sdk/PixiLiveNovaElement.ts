import type { PerformanceCue } from '../character/performance';
import { NovaLiveController } from './NovaLiveController';
import type { FlyToOptions } from './NovaFlightController';

const style = `
:host{display:block;position:relative;min-width:280px;min-height:340px;contain:layout paint style}
.stage{position:absolute;inset:0;overflow:hidden;border-radius:inherit}
.stage canvas{display:block;width:100%;height:100%}
`;

export class PixiLiveNovaElement extends HTMLElement {
  private controller: NovaLiveController | null = null;
  private stage!: HTMLDivElement;
  private prompt = '';

  connectedCallback() {
    if (this.controller) return;
    const root = this.attachShadow({ mode: 'open' });
    const sheet = document.createElement('style');
    sheet.textContent = style;
    this.stage = document.createElement('div');
    this.stage.className = 'stage';
    root.append(sheet, this.stage);

    this.controller = new NovaLiveController({
      container: this.stage,
      systemPrompt: this.prompt || this.getAttribute('system-prompt') || undefined,
      transparent: this.hasAttribute('transparent'),
      onReady: () => this.emit('pixilive-ready'),
      onStatus: (status) => this.emit('pixilive-status', { status }),
      onInputTranscript: (text) => this.emit('pixilive-input-transcript', { text }),
      onOutputTranscript: (text) => this.emit('pixilive-output-transcript', { text }),
      onError: (message) => this.emit('pixilive-error', { message }),
      onPerformance: (cue, source) => this.emit('pixilive-performance', { cue, source }),
    });
    void this.controller.init();
  }

  disconnectedCallback() { void this.controller?.destroy(); this.controller = null; }

  set systemPrompt(value: string) { this.prompt = value; this.controller?.setSystemPrompt(value); }
  get systemPrompt() { return this.prompt; }

  connect() { return this.requireController().connect(); }
  disconnect() { return this.requireController().disconnect(); }
  sendText(text: string) { this.requireController().sendText(text); }
  flyTo(options: FlyToOptions) { this.requireController().flyTo(options); }
  flyHome(speed = 1) { this.requireController().flyHome(speed); }
  lookAt(x: number, y: number) { this.requireController().lookAt(x, y); }
  perform(cue: PerformanceCue) { this.requireController().perform(cue); }
  setEmotion(emotion: 'calm' | 'happy' | 'curious' | 'excited') { this.requireController().setEmotion(emotion); }

  private requireController() {
    if (!this.controller) throw new Error('PixiLive Nova is not mounted yet');
    return this.controller;
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
}

export function definePixiLiveNovaElement(tagName = 'pixilive-nova') {
  if (!customElements.get(tagName)) customElements.define(tagName, PixiLiveNovaElement);
  return tagName;
}
