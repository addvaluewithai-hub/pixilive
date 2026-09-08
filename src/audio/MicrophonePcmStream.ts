export type PcmChunkHandler = (base64Pcm16: string) => void;
export type PcmLevelHandler = (level: number) => void;

const floatToPcm16Base64 = (input: Float32Array) => {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  let binary = '';
  const stride = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += stride) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + stride, bytes.length)));
  }
  return btoa(binary);
};

const downsample = (samples: Float32Array, sourceRate: number, targetRate = 16_000) => {
  if (sourceRate === targetRate) return samples;
  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(outputLength);
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const sourceStart = Math.floor(outputIndex * ratio);
    const sourceEnd = Math.min(samples.length, Math.floor((outputIndex + 1) * ratio));
    let sum = 0;
    for (let sourceIndex = sourceStart; sourceIndex < sourceEnd; sourceIndex += 1) sum += samples[sourceIndex];
    output[outputIndex] = sum / Math.max(1, sourceEnd - sourceStart);
  }
  return output;
};

const rmsLevel = (samples: Float32Array) => {
  if (!samples.length) return 0;
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  return Math.min(1, Math.sqrt(energy / samples.length) * 5.5);
};

export class MicrophonePcmStream {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;

  async start(onChunk: PcmChunkHandler, onLevel?: PcmLevelHandler) {
    if (this.context) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.context = new AudioContext({ latencyHint: 'interactive' });
    await this.context.audioWorklet.addModule('/audio-capture.worklet.js');
    this.source = this.context.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.context, 'pixilive-audio-capture');
    this.worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (!this.context) return;
      const downsampled = downsample(event.data, this.context.sampleRate);
      onLevel?.(rmsLevel(downsampled));
      onChunk(floatToPcm16Base64(downsampled));
    };
    this.source.connect(this.worklet);
    this.worklet.connect(this.context.destination);
  }

  async stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.source?.disconnect();
    this.worklet?.disconnect();
    this.worklet = null;
    this.source = null;
    this.stream = null;
    if (this.context) await this.context.close();
    this.context = null;
  }
}
