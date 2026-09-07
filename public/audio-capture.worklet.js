class PixiLiveAudioCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.samples = 0;
    this.chunkSamples = Math.max(128, Math.round(sampleRate * 0.04));
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    this.buffer.push(new Float32Array(channel));
    this.samples += channel.length;
    if (this.samples < this.chunkSamples) return true;

    const merged = new Float32Array(this.samples);
    let offset = 0;
    for (const piece of this.buffer) {
      merged.set(piece, offset);
      offset += piece.length;
    }
    this.port.postMessage(merged, [merged.buffer]);
    this.buffer = [];
    this.samples = 0;
    return true;
  }
}

registerProcessor('pixilive-audio-capture', PixiLiveAudioCapture);
