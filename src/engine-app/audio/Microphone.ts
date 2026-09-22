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
export class Microphone {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private generation = 0;
  async start(onAudio: (audio: string) => void) {
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
      capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (generation !== this.generation) return;
        const data = resampler.convert(event.data, context.sampleRate); if (data) onAudio(data);
      };
      source.connect(capture); capture.connect(context.destination);
    } catch (error) { if (generation === this.generation) await this.stop(); throw error; }
  }
  async stop() { ++this.generation; this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    const context = this.context; this.context = null; if (context && context.state !== 'closed') await context.close(); }
}
