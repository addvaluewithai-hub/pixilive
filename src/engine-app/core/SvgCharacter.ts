import type { CharacterDefinition } from './registry.ts';
import type { CharacterPort, Expression, Gesture, Mode, MouthFrame } from './types.ts';
interface Rig {
  setEmotion(name: string): void; setIntensity(value: number): void; setEnergy(value: number): void;
  setMouthPose(pose: MouthFrame | null): void; setGesture(name: string): void;
  cancelActions(): void; destroy(): void;
}
interface Recipe { species: string; [key: string]: unknown }
interface Engine {
  normalize(input: Recipe): Recipe; render(input: Recipe, options?: { prefix?: string; portrait?: boolean }): string;
  metrics(input: Recipe): Record<string, unknown>;
}
declare global {
  interface Window {
    CharacterEngine: { createEngine(master: string): Engine };
    CharacterMotion: { createRig(root: Element, options: Record<string, unknown>): Rig };
  }
}
let masterPromise: Promise<string> | undefined;
export async function loadCharacterEngine() {
  masterPromise ??= fetch('/character-engine/master.svg').then(r => { if (!r.ok) throw new Error('تعذّر تحميل الشخصيات.'); return r.text(); }).catch(e => { masterPromise = undefined; throw e; });
  return window.CharacterEngine.createEngine(await masterPromise);
}
export function portrait(engine: Engine, character: CharacterDefinition) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(engine.render({ ...character.recipe, species: character.species, name: character.name }, { prefix: `portrait-${character.id}-`, portrait: true }));
}
export class SvgCharacter implements CharacterPort {
  private rig: Rig;
  private definition: CharacterDefinition;
  constructor(host: HTMLElement, engine: Engine, definition: CharacterDefinition) {
    this.definition = definition;
    const recipe = engine.normalize({ ...definition.recipe, species: definition.species, name: definition.name });
    // Only the bundled master and validated recipes enter this renderer.
    host.innerHTML = engine.render(recipe);
    host.querySelector('svg')?.setAttribute('aria-label', definition.name);
    this.rig = window.CharacterMotion.createRig(host, { keyboard: false, externalControl: true, appearance: () => engine.metrics(recipe) });
  }
  expression(value: Expression, intensity: number) { this.rig.setIntensity(value === 'neutral' ? 0 : intensity); this.rig.setEmotion(value === 'neutral' ? 'happy' : value); }
  gesture(value: Gesture) { if (this.definition.gestures.includes(value)) this.rig.setGesture(value); }
  mouth(value: MouthFrame | null) { this.rig.setMouthPose(value); }
  mode(value: Mode) { this.rig.setEnergy((value === 'speaking' ? .55 : value === 'listening' ? .18 : .12) * this.definition.motionScale); }
  cancel() { this.rig.cancelActions(); }
  destroy() { this.rig.destroy(); }
}
