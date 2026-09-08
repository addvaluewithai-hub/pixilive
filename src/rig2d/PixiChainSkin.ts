import { Graphics } from 'pixi.js';
import { add, clamp, dot, length, normalize, scale, sub } from './math';
import type { Vec2 } from './types';

export interface ChainSkinStyle {
  widths: readonly [number, number, number];
  fill: number;
  stroke: number;
  strokeWidth: number;
  alpha?: number;
  miterLimit?: number;
}

export interface TubeStyle {
  startWidth: number;
  endWidth: number;
  fill: number;
  stroke?: number;
  strokeWidth?: number;
  alpha?: number;
}

const perpendicular = (direction: Vec2): Vec2 => ({ x: -direction.y, y: direction.x });
const offset = (point: Vec2, normal: Vec2, amount: number) => add(point, scale(normal, amount));

const safeDirection = (from: Vec2, to: Vec2, fallback: Vec2): Vec2 => {
  const direction = normalize(sub(to, from));
  return length(direction) > 0.0001 ? direction : fallback;
};

/**
 * Draw one continuous organic silhouette over a three-joint chain.
 *
 * The skeleton remains invisible. The renderer computes a smooth mitered elbow
 * normal and cubic outer contours from shoulder -> elbow -> wrist, so an IK bend
 * reads as one limb rather than two capsules connected at a visible hinge.
 */
export function drawChainSkin(
  graphics: Graphics,
  shoulder: Vec2,
  elbow: Vec2,
  wrist: Vec2,
  style: ChainSkinStyle,
) {
  graphics.clear();

  const first = safeDirection(shoulder, elbow, { x: 1, y: 0 });
  const second = safeDirection(elbow, wrist, first);
  const firstNormal = perpendicular(first);
  const secondNormal = perpendicular(second);
  const tangentCandidate = normalize(add(first, second));
  const elbowTangent = length(tangentCandidate) > 0.0001 ? tangentCandidate : first;
  const elbowNormalCandidate = normalize(add(firstNormal, secondNormal));
  const elbowNormal = length(elbowNormalCandidate) > 0.0001 ? elbowNormalCandidate : firstNormal;

  const [shoulderWidth, elbowWidth, wristWidth] = style.widths;
  const miterDenominator = Math.max(0.34, Math.abs(dot(elbowNormal, firstNormal)));
  const miterLimit = Math.max(1, style.miterLimit ?? 1.42);
  const elbowOffset = clamp(elbowWidth / miterDenominator, elbowWidth * 0.82, elbowWidth * miterLimit);

  const outerShoulder = offset(shoulder, firstNormal, shoulderWidth);
  const outerElbow = offset(elbow, elbowNormal, elbowOffset);
  const outerWrist = offset(wrist, secondNormal, wristWidth);
  const innerWrist = offset(wrist, secondNormal, -wristWidth);
  const innerElbow = offset(elbow, elbowNormal, -elbowOffset);
  const innerShoulder = offset(shoulder, firstNormal, -shoulderWidth);

  const upperLength = Math.max(1, length(sub(elbow, shoulder)));
  const lowerLength = Math.max(1, length(sub(wrist, elbow)));

  const upperControl = upperLength * 0.34;
  const elbowControlUpper = upperLength * 0.22;
  const elbowControlLower = lowerLength * 0.22;
  const lowerControl = lowerLength * 0.34;

  graphics
    .moveTo(outerShoulder.x, outerShoulder.y)
    .bezierCurveTo(
      outerShoulder.x + first.x * upperControl,
      outerShoulder.y + first.y * upperControl,
      outerElbow.x - elbowTangent.x * elbowControlUpper,
      outerElbow.y - elbowTangent.y * elbowControlUpper,
      outerElbow.x,
      outerElbow.y,
    )
    .bezierCurveTo(
      outerElbow.x + elbowTangent.x * elbowControlLower,
      outerElbow.y + elbowTangent.y * elbowControlLower,
      outerWrist.x - second.x * lowerControl,
      outerWrist.y - second.y * lowerControl,
      outerWrist.x,
      outerWrist.y,
    )
    // Soft wrist cap; the authored hand sits over this join.
    .bezierCurveTo(
      wrist.x + second.x * wristWidth * 0.22 + secondNormal.x * wristWidth,
      wrist.y + second.y * wristWidth * 0.22 + secondNormal.y * wristWidth,
      wrist.x + second.x * wristWidth * 0.22 - secondNormal.x * wristWidth,
      wrist.y + second.y * wristWidth * 0.22 - secondNormal.y * wristWidth,
      innerWrist.x,
      innerWrist.y,
    )
    .bezierCurveTo(
      innerWrist.x - second.x * lowerControl,
      innerWrist.y - second.y * lowerControl,
      innerElbow.x + elbowTangent.x * elbowControlLower,
      innerElbow.y + elbowTangent.y * elbowControlLower,
      innerElbow.x,
      innerElbow.y,
    )
    .bezierCurveTo(
      innerElbow.x - elbowTangent.x * elbowControlUpper,
      innerElbow.y - elbowTangent.y * elbowControlUpper,
      innerShoulder.x + first.x * upperControl,
      innerShoulder.y + first.y * upperControl,
      innerShoulder.x,
      innerShoulder.y,
    )
    // Rounded shoulder cap. In humanoids this is normally partially hidden by
    // torso/sleeve artwork, but keeping it smooth also supports creature limbs.
    .bezierCurveTo(
      shoulder.x - first.x * shoulderWidth * 0.16 - firstNormal.x * shoulderWidth,
      shoulder.y - first.y * shoulderWidth * 0.16 - firstNormal.y * shoulderWidth,
      shoulder.x - first.x * shoulderWidth * 0.16 + firstNormal.x * shoulderWidth,
      shoulder.y - first.y * shoulderWidth * 0.16 + firstNormal.y * shoulderWidth,
      outerShoulder.x,
      outerShoulder.y,
    )
    .closePath()
    .fill({ color: style.fill, alpha: style.alpha ?? 1 })
    .stroke({ width: style.strokeWidth, color: style.stroke, alpha: style.alpha ?? 1, join: 'round' });
}

/** Draw a tapered overlay used for sleeves, gloves, cuffs, tails, etc. */
export function drawTaperedTube(
  graphics: Graphics,
  start: Vec2,
  end: Vec2,
  style: TubeStyle,
) {
  graphics.clear();
  const direction = safeDirection(start, end, { x: 1, y: 0 });
  const normal = perpendicular(direction);
  const a1 = offset(start, normal, style.startWidth);
  const a2 = offset(start, normal, -style.startWidth);
  const b1 = offset(end, normal, style.endWidth);
  const b2 = offset(end, normal, -style.endWidth);
  const segmentLength = Math.max(1, length(sub(end, start)));
  const control = segmentLength * 0.34;

  graphics
    .moveTo(a1.x, a1.y)
    .bezierCurveTo(a1.x + direction.x * control, a1.y + direction.y * control, b1.x - direction.x * control, b1.y - direction.y * control, b1.x, b1.y)
    .bezierCurveTo(
      end.x + direction.x * style.endWidth * 0.14 + normal.x * style.endWidth,
      end.y + direction.y * style.endWidth * 0.14 + normal.y * style.endWidth,
      end.x + direction.x * style.endWidth * 0.14 - normal.x * style.endWidth,
      end.y + direction.y * style.endWidth * 0.14 - normal.y * style.endWidth,
      b2.x,
      b2.y,
    )
    .bezierCurveTo(b2.x - direction.x * control, b2.y - direction.y * control, a2.x + direction.x * control, a2.y + direction.y * control, a2.x, a2.y)
    .closePath()
    .fill({ color: style.fill, alpha: style.alpha ?? 1 });

  if (style.stroke !== undefined && (style.strokeWidth ?? 0) > 0) {
    graphics.stroke({ width: style.strokeWidth, color: style.stroke, alpha: style.alpha ?? 1, join: 'round' });
  }
}
