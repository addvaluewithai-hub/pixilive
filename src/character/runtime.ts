import type { Container, Ticker } from 'pixi.js';
import type { Vec2 } from '../rig2d';
import type { CharacterMode, PerformanceCue, PerformanceState } from './performance';
import type { Emotion, MouthPose } from './types';

export interface CharacterInteractionCapabilities {
  effectors: readonly string[];
  attachments: readonly string[];
  locomotion: readonly string[];
  actions: readonly string[];
}

export interface ReachOptions {
  weight?: number;
  bend?: -1 | 1;
  hold?: boolean;
}

/**
 * High-level, renderer-independent physical interaction API.
 * The performance brain asks for intent (reach, point, attach); each character
 * maps that intent into its own skeleton/constraints. Consumers never touch
 * Pixi transforms or a vendor-specific rig directly.
 */
export interface CharacterInteractionController {
  readonly capabilities: CharacterInteractionCapabilities;
  reach(effector: string, target: Vec2, options?: ReachOptions): void;
  clearReach(effector?: string): void;
  pointAt(target: Vec2, effector?: string): void;
  attach(effector: string, target: Vec2): void;
  detach(effector?: string): void;
  action(name: string, intensity?: number): void;
  setLocomotion(name: string): void;
}

/**
 * Required contract for an articulated character. Morphology is deliberately
 * unspecified: Milo can use two-bone humanoid IK while Nova uses one-bone aim
 * constraints, but both consume the exact same semantic PerformanceState.
 */
export interface CharacterPhysicalRig extends CharacterInteractionController {
  update(state: PerformanceState, dt: number): void;
}

export interface CharacterRuntime {
  readonly view: Container;
  readonly interaction?: CharacterInteractionController;
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
