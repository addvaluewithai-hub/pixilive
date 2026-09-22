/** Stateful resampling preserves fractional position across capture chunks. */
export class PcmResampler {
  private pending: number[] = [];
  private position = 0;
  convert(input: Float32Array, sourceRate: number): string {
    this.pending.push(...input);
    const ratio = sourceRate / 16000;
    const output: number[] = [];
    while (this.position + ratio <= this.pending.length) {
      const end = this.position + ratio;
      let sum = 0;
      for (let i = Math.floor(this.position); i < Math.ceil(end); i++) sum += this.pending[i] * (Math.min(end, i + 1) - Math.max(this.position, i));
      output.push(sum / ratio); this.position = end;
    }
    const consumed = Math.floor(this.position); this.pending.splice(0, consumed); this.position -= consumed;
    const bytes = new Uint8Array(output.length * 2), view = new DataView(bytes.buffer);
    output.forEach((v, i) => { const s = Math.max(-1, Math.min(1, v)); view.setInt16(i * 2, s * (s < 0 ? 32768 : 32767), true); });
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
}

/**
 * Tiny client-side boundary detector used only as a turn-finalization hint.
 * Gemini's server VAD remains authoritative; this closes the audio stream after
 * a clearly detected user utterance followed by sustained silence. It prevents
 * the common "waits until I say hello again" failure mode without replacing VAD.
 */
export class SpeechBoundaryDetector {
  private speaking = false;
  private hotMs = 0;
  private quietMs = 0;
  private noiseFloor = 0.0035;

  observe(input: Float32Array, sampleRate: number) {
    if (!input.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return false;
    let energy = 0;
    for (const sample of input) energy += sample * sample;
    const rms = Math.sqrt(energy / input.length);
    const chunkMs = input.length / sampleRate * 1000;
    const startThreshold = Math.max(0.012, this.noiseFloor * 3.2);
    const endThreshold = Math.max(0.007, startThreshold * 0.58);

    if (!this.speaking) {
      if (rms < 0.03) this.noiseFloor = this.noiseFloor * 0.985 + rms * 0.015;
      this.hotMs = rms >= startThreshold ? this.hotMs + chunkMs : 0;
      if (this.hotMs >= 80) {
        this.speaking = true;
        this.hotMs = 0;
        this.quietMs = 0;
      }
      return false;
    }

    this.quietMs = rms <= endThreshold ? this.quietMs + chunkMs : 0;
    if (this.quietMs < 720) return false;
    this.speaking = false;
    this.quietMs = 0;
    this.hotMs = 0;
    return true;
  }

  reset() {
    this.speaking = false;
    this.hotMs = 0;
    this.quietMs = 0;
  }
}

export class Microphone {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private generation = 0;
  async start(onAudio: (audio: string) => void, onSpeechEnd?: () => void) {
    const generation = ++this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
    this.stream = stream;
    const context = new AudioContext({ latencyHint: 'interactive' }); this.context = context;
    try {
      await context.resume(); await context.audioWorklet.addModule('/audio-capture.worklet.js');
      if (generation !== this.generation) return;
      const source = context.createMediaStreamSource(stream), capture = new AudioWorkletNode(context, 'pixilive-audio-capture');
      const resampler = new PcmResampler();
      const boundary = new SpeechBoundaryDetector();
      capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (generation !== this.generation) return;
        const ended = boundary.observe(event.data, context.sampleRate);
        const data = resampler.convert(event.data, context.sampleRate); if (data) onAudio(data);
        if (ended) onSpeechEnd?.();
      };
      source.connect(capture); capture.connect(context.destination);
    } catch (error) { if (generation === this.generation) await this.stop(); throw error; }
  }
  async stop() { ++this.generation; this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    const context = this.context; this.context = null; if (context && context.state !== 'closed') await context.close(); }
}
