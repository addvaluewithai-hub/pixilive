export interface FlightCommand {
  action: 'move' | 'hover' | 'land';
  x: number; y: number; speed: number; path: 'direct' | 'arc' | 'swoop';
}
export interface FlightState { x: number; y: number; vx: number; vy: number; bank: number; lift: number; moving: boolean; landed: boolean }
/** Coordinates are screen-relative: x=0 left, y=0 top, y=1 landing level. */
export function parseFlight(value: unknown): FlightCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (!['move', 'hover', 'land'].includes(p.action as string)) return null;
  if (p.action === 'move' && (p.x === undefined || p.y === undefined)) return null;
  if (p.path !== undefined && !['direct', 'arc', 'swoop'].includes(p.path as string)) return null;
  for (const key of ['x', 'y', 'speed']) if (p[key] !== undefined && (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || (p[key] as number) < (key === 'speed' ? .1 : 0) || (p[key] as number) > 1)) return null;
  return { action: p.action as FlightCommand['action'], x: (p.x as number) ?? .5, y: p.action === 'land' ? 1 : (p.y as number) ?? .5, speed: (p.speed as number) ?? .5, path: (p.path as FlightCommand['path']) ?? 'direct' };
}
