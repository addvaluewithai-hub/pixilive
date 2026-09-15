import { MiloVisemeCharacter } from './MiloVisemeCharacter';
import { NovaCharacter } from './NovaCharacter';
import type { CharacterDefinition } from './runtime';

const commonEmotions = ['calm', 'happy', 'curious', 'excited'] as const;
const kiroAssetUrl = `/rive/kiro.riv?v=${Date.now()}`;

export const characterRegistry = [
  {
    id: 'kiro',
    name: 'Kiro',
    tagline: 'Built to move, listen and speak.',
    description: 'A from-scratch Rive-native AI character with bound gaze, layered idle motion and continuous viseme-driven facial controls.',
    theme: 'cosmic',
    defaultEmotion: 'calm',
    emotions: commonEmotions,
    systemPrompt:
      'You are Kiro, a warm, quick-witted and expressive AI companion embodied as a responsive animated character. Keep spoken responses natural, concise and conversational. React naturally, allow interruptions, and avoid sounding like a formal assistant.',
    framing: {
      x: 0.5,
      y: 0.5,
      widthReference: 800,
      heightReference: 800,
      minScale: 0.55,
      maxScale: 1.2,
    },
    ambient: {
      color: 0x8b7cff,
      count: 0,
      radiusMin: 0,
      radiusMax: 0,
      alphaMin: 0,
      alphaMax: 0,
    },
    rive: {
      // This is a fast-moving authored asset during the character lab phase.
      // Give each page load a fresh URL so an old cached .riv can never pair
      // with newer React controls/ViewModel bindings.
      src: kiroAssetUrl,
      artboard: 'Kiro',
      stateMachine: 'KiroMachine',
    },
  },
  {
    id: 'milo',
    name: 'Milo',
    tagline: 'A little ink, a lot of personality.',
    description: 'A monochrome editorial-style human mascot with expressive eyes, asymmetrical hair and subtle hand-drawn motion.',
    theme: 'mono',
    defaultEmotion: 'calm',
    emotions: commonEmotions,
    systemPrompt:
      'You are Milo, a warm, quick-witted and expressive AI companion living inside a hand-drawn monochrome character. Keep spoken responses natural, concise and conversational. You can be playful without becoming childish. React naturally, allow interruptions, and avoid sounding like a formal assistant.',
    framing: {
      x: 0.51,
      y: 0.49,
      widthReference: 650,
      heightReference: 690,
      minScale: 0.6,
      maxScale: 1.22,
    },
    ambient: {
      color: 0xf7f5ef,
      count: 18,
      radiusMin: 0.45,
      radiusMax: 1.9,
      alphaMin: 0.025,
      alphaMax: 0.125,
    },
    create: () => new MiloVisemeCharacter(),
  },
  {
    id: 'nova',
    name: 'Nova',
    tagline: 'Bright, curious, slightly cosmic.',
    description: 'The original PixiLive creature: a soft sci-fi mascot with ears, tail, antenna glow and energetic secondary motion.',
    theme: 'cosmic',
    defaultEmotion: 'calm',
    emotions: commonEmotions,
    systemPrompt:
      'You are Nova, a warm, clever and expressive AI companion living inside a playful cosmic creature. Keep spoken responses natural and concise. Be curious, friendly and lightly playful, react conversationally, allow interruptions, and avoid sounding like a formal assistant.',
    framing: {
      x: 0.5,
      y: 0.48,
      widthReference: 620,
      heightReference: 650,
      minScale: 0.62,
      maxScale: 1.2,
    },
    ambient: {
      color: 0x9c8cff,
      count: 28,
      radiusMin: 0.7,
      radiusMax: 2.7,
      alphaMin: 0.05,
      alphaMax: 0.28,
    },
    create: () => new NovaCharacter(),
  },
] as const satisfies readonly CharacterDefinition[];

export const DEFAULT_CHARACTER_ID = 'kiro';

export function getCharacterDefinition(id: string): CharacterDefinition {
  return characterRegistry.find((character) => character.id === id) ?? characterRegistry[0];
}
