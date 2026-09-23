# Human character family

Hakim (حكيم), Reem (ريم), Marwan (مروان), and Amal (أمل) are stylized vector adaptations of the supplied references. They share human anatomy and motion rather than stretching the animal rig. The source images are design references, not runtime textures or a claim of matching 3D materials.

## Separation of responsibilities

- `human-art.js`: pure SVG assembly and preset data. Shared skin, clothes, hands, eyes and mouth structure; interchangeable hair, beard, glasses, headset and wardrobe details. No network calls or raster dependencies.
- `human-motion.js`: persistent SVG rig, continuous sleeve outlines, spring-smoothed hand coordinates and facial parameters. Retargeting preserves velocity; cancellation returns toward the resting pose. Back hair follows the head but renders behind the torso. Hands render in front; the thinking target leaves the speaking mouth visible.
- `geometry.js`: existing shared viseme definitions and clipped mouth topology, also used by the animals and flyers.
- `SvgCharacter.ts`: renderer adapter selects the human or existing animal family. Both implement the same CharacterPort, so playback-clock mouth samples, `perform`, interruption, logs and character switching stay shared.
- `registry.ts`: selector names, descriptions and movement scale. The human preset key matches the registry id.

To add another human, define a preset in HumanArt, then add its registry entry with species `human`. Change wardrobe/hair/accessory fields independently. Anatomy changes belong in shared art/motion components, not SessionController or GeminiAdapter. Existing recipe controls for animal proportions do not apply to humans.

Human capabilities: all ten face states, all six active gestures, and audio-driven visemes. Humans reject `fly`. Reduced motion suppresses idle bob, head accents and jumping while retaining speech and essential gestures. Rig destruction removes animation callbacks and listeners.

## Review

The four identities and representative poses were rendered offline for visual inspection. `tests/human.test.cjs` covers preset rendering and unique prefixed IDs, expressions/gestures, interrupted hand transitions, mouth closure, thinking placement and lifecycle cleanup. Existing session tests cover shared clock, tool and avatar-switch behavior. Browser checks and a real Gemini microphone session were not run.
