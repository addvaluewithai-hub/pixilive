import type { FlightCommand, FlightState } from './flight.ts';
export const expressions = ['neutral', 'happy', 'sad', 'crying', 'surprised', 'thinking', 'angry', 'sleepy', 'laughing', 'excited'] as const;
export type Expression = typeof expressions[number];
export const gestures = ['none', 'wave', 'blink', 'jump', 'explain', 'think', 'celebrate'] as const;
export type Gesture = typeof gestures[number];
export type Mode = 'idle' | 'listening' | 'thinking' | 'speaking';
export type Viseme = 'REST' | 'MBP' | 'AA' | 'EE' | 'IH' | 'OH' | 'OO' | 'FV' | 'L' | 'S' | 'CH' | 'WQ';
export interface MouthFrame { viseme: Viseme; energy: number; open: number; width?: number; round?: number }
export interface Cue { expression: Expression; intensity: number; gesture: Gesture; duration: number; timing?: 'immediate' | 'with_speech' | 'next_audio' }
export interface TimedCue extends Cue { id: string; turn: number; at: number }
export interface CharacterPort {
  expression(value: Expression, intensity: number): void;
  gesture(value: Gesture, duration?: number): void;
  mouth(value: MouthFrame | null): void;
  mode(value: Mode): void;
  fly?(command: FlightCommand): boolean;
  stopFlight?(): void;
  flightState?(): FlightState | null;
  cancel(): void;
  destroy(): void;
}
export const restMouth: MouthFrame = { viseme: 'REST', energy: 0, open: 0 };
export const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
export function parseCue(value: unknown): Cue | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if (!expressions.includes(p.expression as Expression) || !gestures.includes((p.gesture ?? 'none') as Gesture)) return null;
  if (p.intensity !== undefined && (typeof p.intensity !== 'number' || !Number.isFinite(p.intensity))) return null;
  if (p.duration !== undefined && (typeof p.duration !== 'number' || !Number.isFinite(p.duration))) return null;
  if (p.timing !== undefined && p.timing !== 'immediate' && p.timing !== 'with_speech' && p.timing !== 'next_audio') return null;
  return { ...(p.timing ? { timing: p.timing as 'immediate' | 'with_speech' | 'next_audio' } : {}), expression: p.expression as Expression, gesture: (p.gesture ?? 'none') as Gesture,
    intensity: clamp((p.intensity as number | undefined) ?? 0.65), duration: clamp((p.duration as number | undefined) ?? 2, 0.6, 6) };
}
