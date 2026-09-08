import type { Container, Ticker } from 'pixi.js';
import type { CharacterMode, PerformanceCue } from './performance';
import type { Emotion, MouthPose } from './types';

export interface CharacterRuntime {
  readonly view: Container;
  setEmotion(emotion: Emotion): void;
  setMouth(pose: MouthPose, speaking?: boolean): void;
  settleMouth(): void;
  lookAt(normalizedX: number, normalizedY: number): void;
  react(): void;
  setMode(mode: CharacterMode): void;
  perform(cue: PerformanceCue): void;
  setSpeechEnergy(energy: number): void;
  interruptPerformance(): void;
  update(ticker: Ticker): void;
}

export interface CharacterFraming {
  x: number;
  y: number;
  widthReference: number;
  heightReference: number;
  minScale: number;
  maxScale: number;
}

export interface CharacterAmbient {
  color: number;
  count: number;
  radiusMin: number;
  radiusMax: number;
  alphaMin: number;
  alphaMax: number;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  theme: string;
  defaultEmotion: Emotion;
  emotions: readonly Emotion[];
  systemPrompt: string;
  framing: CharacterFraming;
  ambient: CharacterAmbient;
  create(): CharacterRuntime;
}
