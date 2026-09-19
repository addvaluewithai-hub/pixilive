import { bennyPerformanceAdapter } from './bennyPerformanceAdapter';
import { dinoPerformanceAdapter } from './dinoPerformanceAdapter';
import { foxyPerformanceAdapter } from './foxyPerformanceAdapter';
import { kiroPerformanceAdapter } from './kiroPerformanceAdapter';
import { MiloVisemeCharacter } from './MiloVisemeCharacter';
import { NovaCharacter } from './NovaCharacter';
import type { CharacterDefinition } from './runtime';

const commonEmotions = ['calm', 'happy', 'curious', 'excited'] as const;
const freshRive = (id: string) => `/rive/${id}.riv?v=${Date.now()}`;

export const characterRegistry = [
  {
    id: 'benny',
    name: 'Benny',
    tagline: 'Warm, steady, always on your side.',
    description: 'An original Rive-native bear buddy in a sunny hoodie, built from code for expressive conversation rather than copied from reference art.',
    theme: 'sunny',
    defaultEmotion: 'calm',
    emotions: commonEmotions,
    systemPrompt:
      'You are Benny, a warm, upbeat and reassuring AI companion. Speak naturally and concisely, celebrate wins without becoming noisy, and make difficult moments feel manageable. You are embodied as a friendly animated bear and can react with expressive body language.',
    framing: { x: 0.5, y: 0.5, widthReference: 800, heightReference: 800, minScale: 0.55, maxScale: 1.2 },
    ambient: { color: 0xf7b72d, count: 0, radiusMin: 0, radiusMax: 0, alphaMin: 0, alphaMax: 0 },
    authoring: {
      archetype: 'animal',
      capabilities: ['face', 'arms', 'legs', 'ears', 'squashStretch', 'tears', 'sparkle', 'blush', 'accessory'],
      layeredArtwork: true,
      anatomyNotes: 'Round bear proportions with short legs, movable paws and hoodie as the main accessory.',
    },
    rive: { src: freshRive('benny'), artboard: 'Benny', stateMachine: 'BennyMachine' },
    performanceAdapter: bennyPerformanceAdapter,
  },
  {
    id: 'dino',
    name: 'Dino',
    tagline: 'Curious energy with a tiny roar.',
    description: 'An original lime-green Rive-native dinosaur with a bright belly, compact arms, spikes and a playful tail silhouette.',
    theme: 'mint',
    defaultEmotion: 'calm',
    emotions: commonEmotions,
    systemPrompt:
      'You are Dino, a playful, curious and encouraging AI companion. Keep responses natural, concise and energetic without becoming hyperactive. You are embodied as a tiny animated dinosaur, so use warm curiosity and playful confidence.',
    framing: { x: 0.5, y: 0.5, widthReference: 800, heightReference: 800, minScale: 0.55, maxScale: 1.2 },
    ambient: { color: 0x71e055, count: 0, radiusMin: 0, radiusMax: 0, alphaMin: 0, alphaMax: 0 },
    authoring: {
      archetype: 'animal',
      capabilities: ['face', 'arms', 'legs', 'tail', 'squashStretch', 'tears', 'sparkle', 'blush'],
      layeredArtwork: true,
      anatomyNotes: 'Short forelimbs, heavy body expression, dorsal spikes and a tail. The same behavior pack intentionally maps to more body bounce than arm travel.',
    },
    rive: { src: freshRive('dino'), artboard: 'Dino', stateMachine: 'DinoMachine' },
    performanceAdapter: dinoPerformanceAdapter,
  },
  {
    id: 'foxy',
    name: 'Foxy',
    tagline: 'Quick, bright, and a little mischievous.',
    description: 'An original Rive-native fox with oversized ears, cream markings, a blue scarf and a light-footed motion style.',
    theme: 'peach',
    defaultEmotion: 'calm',
    emotions: commonEmotions,
    systemPrompt:
      'You are Foxy, a clever, kind and lightly mischievous AI companion. Keep spoken responses concise and conversational. You are embodied as an expressive animated fox: quick reactions are welcome, but never feel frantic or distracting.',
    framing: { x: 0.5, y: 0.5, widthReference: 800, heightReference: 800, minScale: 0.55, maxScale: 1.2 },
    ambient: { color: 0xf48332, count: 0, radiusMin: 0, radiusMax: 0, alphaMin: 0, alphaMax: 0 },
    authoring: {
      archetype: 'animal',
      capabilities: ['face', 'arms', 'legs', 'tail', 'ears', 'squashStretch', 'tears', 'sparkle', 'blush', 'accessory'],
      layeredArtwork: true,
      anatomyNotes: 'Nimble fox proportions, large expressive ears, scarf and tail silhouette. Head motion is slightly stronger than Benny or Dino.',
    },
    rive: { src: freshRive('foxy'), artboard: 'Foxy', stateMachine: 'FoxyMachine' },
    performanceAdapter: foxyPerformanceAdapter,
  },
  {
    id: 'kiro',
    name: 'Kiro',
    tagline: 'Built to move, listen and speak.',
    description: 'The original Rive-native architecture prototype with bound gaze, layered idle motion and viseme-driven facial controls.',
    theme: 'cosmic',
    defaultEmotion: 'calm',
    emotions: commonEmotions,
    systemPrompt:
      'You are Kiro, a warm, quick-witted and expressive AI companion embodied as a responsive animated character. Keep spoken responses natural, concise and conversational. React naturally, allow interruptions, and avoid sounding like a formal assistant.',
    framing: { x: 0.5, y: 0.5, widthReference: 800, heightReference: 800, minScale: 0.55, maxScale: 1.2 },
    ambient: { color: 0x8b7cff, count: 0, radiusMin: 0, radiusMax: 0, alphaMin: 0, alphaMax: 0 },
    authoring: {
      archetype: 'humanoid',
      capabilities: ['face', 'arms', 'legs', 'squashStretch', 'tears', 'sparkle', 'glow', 'blush'],
      layeredArtwork: true,
      suppliedParts: ['body', 'head', 'eyes', 'brows', 'mouth', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'tears', 'sparkles'],
      anatomyNotes: 'Two-arm humanoid baseline used to prove the universal behavior adapter.',
    },
    rive: { src: freshRive('kiro'), artboard: 'Kiro', stateMachine: 'KiroMachine' },
    performanceAdapter: kiroPerformanceAdapter,
  },
  {
    id: 'milo',
    name: 'Milo',
    tagline: 'A little ink, a lot of personality.',
    description: 'Legacy Pixi character kept as a fallback while the Rive-native library grows.',
    theme: 'mono',
    defaultEmotion: 'calm',
    emotions: commonEmotions,
    systemPrompt: 'You are Milo, a warm, quick-witted and expressive AI companion. Keep spoken responses natural, concise and conversational.',
    framing: { x: 0.51, y: 0.49, widthReference: 650, heightReference: 690, minScale: 0.6, maxScale: 1.22 },
    ambient: { color: 0xf7f5ef, count: 18, radiusMin: 0.45, radiusMax: 1.9, alphaMin: 0.025, alphaMax: 0.125 },
    create: () => new MiloVisemeCharacter(),
  },
  {
    id: 'nova',
    name: 'Nova',
    tagline: 'Bright, curious, slightly cosmic.',
    description: 'Legacy Pixi creature kept for regression comparison.',
    theme: 'cosmic',
    defaultEmotion: 'calm',
    emotions: commonEmotions,
    systemPrompt: 'You are Nova, a warm, clever and expressive AI companion. Keep spoken responses natural and concise.',
    framing: { x: 0.5, y: 0.48, widthReference: 620, heightReference: 650, minScale: 0.62, maxScale: 1.2 },
    ambient: { color: 0x9c8cff, count: 28, radiusMin: 0.7, radiusMax: 2.7, alphaMin: 0.05, alphaMax: 0.28 },
    create: () => new NovaCharacter(),
  },
] as const satisfies readonly CharacterDefinition[];

export const DEFAULT_CHARACTER_ID = 'benny';

export function getCharacterDefinition(id: string): CharacterDefinition {
  return characterRegistry.find((character) => character.id === id) ?? characterRegistry[0];
}
