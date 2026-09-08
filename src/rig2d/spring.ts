import type { Vec2 } from './types';

const clampDt = (dt: number) => Math.max(0, Math.min(0.05, dt));

export class SpringScalar {
  value: number;
  velocity = 0;

  constructor(value = 0) {
    this.value = value;
  }

  snap(value: number) {
    this.value = value;
    this.velocity = 0;
  }

  update(target: number, dt: number, frequency = 6.5, damping = 0.82) {
    const step = clampDt(dt);
    if (step <= 0) return this.value;
    const omega = Math.PI * 2 * Math.max(0.1, frequency);
    const acceleration = (target - this.value) * omega * omega - 2 * damping * omega * this.velocity;
    this.velocity += acceleration * step;
    this.value += this.velocity * step;
    return this.value;
  }
}

export class SpringVec2 {
  readonly x: SpringScalar;
  readonly y: SpringScalar;

  constructor(value: Vec2 = { x: 0, y: 0 }) {
    this.x = new SpringScalar(value.x);
    this.y = new SpringScalar(value.y);
  }

  get value(): Vec2 {
    return { x: this.x.value, y: this.y.value };
  }

  snap(value: Vec2) {
    this.x.snap(value.x);
    this.y.snap(value.y);
  }

  update(target: Vec2, dt: number, frequency = 6.5, damping = 0.82): Vec2 {
    return {
      x: this.x.update(target.x, dt, frequency, damping),
      y: this.y.update(target.y, dt, frequency, damping),
    };
  }
}
