import type { FlightCommand, FlightState } from './flight.ts';
import type { CharacterDefinition } from './registry.ts';
import type { CharacterPort, Expression, Gesture, Mode, MouthFrame } from './types.ts';
interface Rig {
  setEmotion(name: string): void; setIntensity(value: number): void; setEnergy(value: number): void;
  setMouthPose(pose: MouthFrame | null): void; setGesture(name: string, duration?: number): void;
  setFlight(command: FlightCommand): boolean; stopFlight(): void; flightState(): FlightState | null;
  cancelActions(): void; destroy(): void;
}
interface Recipe { species: string; [key: string]: unknown }
interface Engine {
  normalize(input: Recipe): Recipe; render(input: Recipe, options?: { prefix?: string; portrait?: boolean }): string;
  metrics(input: Recipe): Record<string, unknown>;
}
declare global {
  interface Window {
    MascotArt: { render(id: string, options?: { prefix?: string; portrait?: boolean }): string };
    MascotMotion: { createRig(root: Element, options: Record<string, unknown>): Rig };
    HumanArt: { render(id: string, options?: { prefix?: string; portrait?: boolean }): string };
    HumanMotion: { createRig(root: Element, options: Record<string, unknown>): Rig };
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
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(character.species === 'mascot' ? window.MascotArt.render(character.id, {prefix:`portrait-${character.id}-`,portrait:true}) : character.species === 'human' ? window.HumanArt.render(character.id, {prefix:`portrait-${character.id}-`,portrait:true}) : engine.render({ ...character.recipe, species: character.species, name: character.name }, { prefix: `portrait-${character.id}-`, portrait: true }));
}
export class SvgCharacter implements CharacterPort {
  private rig: Rig;
  private definition: CharacterDefinition;
  constructor(host: HTMLElement, engine: Engine, definition: CharacterDefinition) {
    this.definition = definition;
    if(definition.species === 'mascot'){
      host.innerHTML = window.MascotArt.render(definition.id);
      this.rig = window.MascotMotion.createRig(host, {preset:definition.id,speechMotionScale:definition.motionScale});
      return;
    }
    if(definition.species === 'human'){
      host.innerHTML = window.HumanArt.render(definition.id);
      this.rig = window.HumanMotion.createRig(host, {preset:definition.id,speechMotionScale:definition.motionScale});
      return;
    }
    const recipe = engine.normalize({ ...definition.recipe, species: definition.species, name: definition.name });
    // Only the bundled master and validated recipes enter this renderer.
    host.innerHTML = engine.render(recipe);
    host.querySelector('svg')?.setAttribute('aria-label', definition.name);
    this.rig = window.CharacterMotion.createRig(host, { keyboard: false, externalControl: true, speechMotionScale: definition.motionScale, appearance: () => engine.metrics(recipe) });
  }
  expression(value: Expression, intensity: number) { this.rig.setIntensity(value === 'neutral' ? 0 : intensity); this.rig.setEmotion(value === 'neutral' && !['human','mascot'].includes(this.definition.species) ? 'happy' : value); }
  gesture(value: Gesture, duration?: number) { if (this.definition.gestures.includes(value)) this.rig.setGesture(value, duration); }
  mouth(value: MouthFrame | null) { this.rig.setMouthPose(value); }
  mode(value: Mode) { this.rig.setEnergy((value === 'speaking' ? .55 : value === 'listening' ? .18 : .12) * this.definition.motionScale); }
  fly(command: FlightCommand) { return !!this.definition.canFly && this.rig.setFlight(command); }
  stopFlight() { this.rig.stopFlight(); }
  flightState() { return this.rig.flightState(); }
  cancel() { this.rig.cancelActions(); }
  destroy() { this.rig.destroy(); }
}
