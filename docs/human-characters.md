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

## Proportion and silhouette revision

Each preset now owns `anatomy`: head width/height, eye scale/spacing, shoulder width/height, sleeve width, palm scale, mouth placement and an asymmetric relaxed pose. The rig reads the same metrics as the artwork. Shorter legs, curved hems, grounded shoes and differently cut cardigan/blazers balance the smaller eyes and head. Reem has a longer, softer face and flowing hair; Amal has a shorter face, compact bob and cropped jacket. Hakim has swept gray locks and a fuller beard; Marwan has an irregular curly silhouette, broader shoulders and a shorter beard.

The beard follows the jaw below a continuous cheek/lip area. A neutral REST viseme preserves a closed smile even when expression intensity is zero; MBP remains fully closed and speech visemes retain their own shape. The mouth and chin do not move as separate patches.

Sleeves share a lighting field with the torso. A fixed-length upper arm and forearm drive one tapered SVG sleeve with rounded joins. Poses specify joint rotations; interpolation preserves velocity and moves the wrist along an arc instead of shortening or stretching the limb. Wrist flex stays within 25 degrees of the forearm, cuffs overlap the wrist, and relaxed palms interpolate into open palms with the same contour topology. Waving and speech accents blend in and out through rig state, so cancellation cannot remove a positional offset in a single frame.

The human SVG uses an explicit 450 × 550 viewBox with animation margins and `xMidYMid meet`. Its absolutely positioned viewport is bounded by the stage; it no longer contributes an intrinsic grid height or paints across the caption and controls. Human-only containment leaves the other character families' layout unchanged.

Validation includes offline full-body renders, representative speech/gesture poses and intermediate thinking-transition frames, plus regression coverage for neutral silence, MBP closure and return to each preset's resting pose. This is not a browser layout or live microphone verification.

Arm regression checks cover fixed segment lengths, bounded elbow/wrist angles, velocity-preserving interruption, secondary-wave fade and finger clearance during wide transitions. Offline contact sheets include rest → wave, wave → think, think → rest and celebrate → explain, including the intermediate frames.
