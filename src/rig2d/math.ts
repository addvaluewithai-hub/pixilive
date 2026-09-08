import type { Vec2 } from './types';

export const EPSILON = 1e-6;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const length = (v: Vec2) => Math.hypot(v.x, v.y);
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v: Vec2, amount: number): Vec2 => ({ x: v.x * amount, y: v.y * amount });
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;
export const normalize = (v: Vec2): Vec2 => {
  const l = length(v);
  return l < EPSILON ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
};
export const rotate = (v: Vec2, radians: number): Vec2 => {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};
export const angleOf = (v: Vec2) => Math.atan2(v.y, v.x);
export const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
export const lerpAngle = (from: number, to: number, t: number) => from + normalizeAngle(to - from) * t;

export const damp = (from: number, to: number, speed: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-Math.max(0, speed) * Math.max(0, dt)));

export const dampAngle = (from: number, to: number, speed: number, dt: number) =>
  from + normalizeAngle(to - from) * (1 - Math.exp(-Math.max(0, speed) * Math.max(0, dt)));

export const dampVec = (from: Vec2, to: Vec2, speed: number, dt: number): Vec2 => ({
  x: damp(from.x, to.x, speed, dt),
  y: damp(from.y, to.y, speed, dt),
});
