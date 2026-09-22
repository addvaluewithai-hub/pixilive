import type { Gesture } from './types.ts';
export type Species = 'fox' | 'cat' | 'rabbit' | 'bear' | 'sprite';
export interface CharacterDefinition {
  canFly?: boolean;
  id: string; species: Species; name: string; description: string; accent: string;
  gestures: readonly Gesture[]; motionScale: number;
  recipe?: { fur?: string; cream?: string; accent?: string; eyes?: string; head?: number; body?: number; ears?: number; eyeSize?: number; accessory?: 'scarf' | 'bow' | 'none' };
}
const common = ['none', 'wave', 'blink', 'jump', 'explain', 'think', 'celebrate'] as const;
export const characters: readonly CharacterDefinition[] = [
  { id: 'ember', species: 'fox', name: 'إمبر', description: 'فضولي وخفيف الظل', accent: '#e87e37', gestures: common, motionScale: .65 },
  { id: 'louz', species: 'cat', name: 'لوز', description: 'هادي وبيحب يسمعك', accent: '#8eabc1', gestures: common, motionScale: .4 },
  { id: 'sugar', species: 'rabbit', name: 'سكّر', description: 'لطيف ومليان حماس', accent: '#bc99bd', gestures: common, motionScale: .6 },
  { id: 'bondoq', species: 'bear', name: 'بندق', description: 'دافي وبيطمنك', accent: '#af8057', gestures: common, motionScale: .35 },
  { id: 'lumi', species: 'sprite', name: 'لومي', description: 'صاحبة النجوم، بتحب تطير', accent: '#9d7cd5', gestures: common, motionScale: .4, canFly: true },
  { id: 'naseem', species: 'sprite', name: 'نسمة', description: 'خفة وهدوء وأجنحة نعناع', accent: '#75b9ac', gestures: common, motionScale: .35, canFly: true, recipe: { fur: '#E4F3EB', cream: '#FFFBEB', accent: '#6FBBAC', eyes: '#418E8B' } },
];
export function getCharacter(id: string) { return characters.find(c => c.id === id) ?? characters[0]; }
