import type { Container } from 'pixi.js';

export interface Point2D {
  x: number;
  y: number;
}

export interface FlyToOptions extends Point2D {
  /** Higher values reach the target faster. 1 is the normal conversational speed. */
  speed?: number;
  /** Keep a subtle hover once Nova settles at the target. */
  hover?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * World-space locomotion intentionally lives outside Nova's internal character rig.
 * The host application owns destinations (board, question card, reward, etc.); Nova
 * only knows how to fly toward a point with bank, anticipation, and hover follow-through.
 */
export class NovaFlightController {
  private home: Point2D = { x: 0, y: 0 };
  private target: Point2D = { x: 0, y: 0 };
  private velocity: Point2D = { x: 0, y: 0 };
  private speed = 1;
  private hover = true;
  private time = 0;
  private initialized = false;

  constructor(private readonly view: Container) {}

  setHome(point: Point2D, snap = false) {
    const targetWasHome = this.initialized && distance(this.target, this.home) < 1;
    this.home = { ...point };
    if (!this.initialized || snap) {
      this.initialized = true;
      this.target = { ...point };
      this.velocity = { x: 0, y: 0 };
      this.view.position.set(point.x, point.y);
      return;
    }
    if (targetWasHome) this.target = { ...point };
  }

  flyTo(options: FlyToOptions) {
    this.target = { x: options.x, y: options.y };
    this.speed = clamp(options.speed ?? 1, 0.25, 2.4);
    this.hover = options.hover ?? true;
  }

  flyHome(speed = 1) {
    this.flyTo({ ...this.home, speed, hover: true });
  }

  snapTo(point: Point2D) {
    this.target = { ...point };
    this.velocity = { x: 0, y: 0 };
    this.view.position.set(point.x, point.y);
  }

  update(dt: number) {
    if (!this.initialized) return;
    const step = clamp(dt, 0, 0.033);
    this.time += step;

    const dx = this.target.x - this.view.x;
    const dy = this.target.y - this.view.y;
    const distanceToTarget = Math.hypot(dx, dy);
    const omega = 5.2 * this.speed;
    const damping = 0.92;

    // Critically damped-ish spring, integrated in small substeps so host FPS does
    // not change the flight path or create a first-frame jump.
    const substeps = Math.max(1, Math.ceil(step / (1 / 180)));
    const sub = step / substeps;
    for (let index = 0; index < substeps; index += 1) {
      const liveDx = this.target.x - this.view.x;
      const liveDy = this.target.y - this.view.y;
      const ax = liveDx * omega * omega - 2 * damping * omega * this.velocity.x;
      const ay = liveDy * omega * omega - 2 * damping * omega * this.velocity.y;
      this.velocity.x += ax * sub;
      this.velocity.y += ay * sub;
      this.view.x += this.velocity.x * sub;
      this.view.y += this.velocity.y * sub;
    }

    const moving = distanceToTarget > 3 || Math.hypot(this.velocity.x, this.velocity.y) > 8;
    const bankTarget = moving ? clamp(this.velocity.x / 900, -0.13, 0.13) : 0;
    const bankGain = 1 - Math.exp(-7.5 * step);
    this.view.rotation += (bankTarget - this.view.rotation) * bankGain;

    if (!moving && this.hover) {
      const hoverY = Math.sin(this.time * 1.8) * 2.8;
      const hoverX = Math.sin(this.time * 0.83 + 1.2) * 1.25;
      this.view.x += hoverX * step * 2.2;
      this.view.y += hoverY * step * 1.9;
    }
  }
}
