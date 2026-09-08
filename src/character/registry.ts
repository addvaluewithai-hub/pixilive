import { DirectedNovaCharacter } from './DirectedNovaCharacter';
import type { CharacterDefinition } from './runtime';

const commonEmotions = ['calm', 'happy', 'curious', 'excited'] as const;

/**
 * Production character registry.
 *
 * Milo's face/viseme experiments remain in the lab source and visual QA, but his
 * old humanoid body is intentionally retired instead of shipping known arm/IK
 * problems. When Milo returns, his body will be authored again from a clean rig.
 */
export const characterRegistry = [
  {
    id: 'nova',
    name: 'Nova',
    tagline: 'Bright, curious, slightly cosmic.',
    description: 'The first production PixiLive character: a soft sci-fi mascot with ears, tail, antenna glow and expressive local acting.',
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
    create: () => new DirectedNovaCharacter(),
  },
] as const satisfies readonly CharacterDefinition[];

export const DEFAULT_CHARACTER_ID = 'nova';

export function getCharacterDefinition(id: string): CharacterDefinition {
  return characterRegistry.find((character) => character.id === id) ?? characterRegistry[0];
}
