# Kiro — native Rive character

Kiro is a from-scratch Rive-native character for PixiLive. It intentionally does **not** reuse the current Pixi character artwork or procedural motion.

## Goals

- Native Rive vector scene and State Machine.
- Character motion authored inside Rive rather than redrawn every frame from Pixi.
- Runtime contract driven by the existing Gemini Live/audio stack.
- Smooth lip sync using the existing `VisemeAnalyzer` output as the signal source.
- Independent ambient, gaze, emotion, speech and reaction motion layers.

## Runtime contract

The first production View Model should expose these properties:

| Property | Type | Range / values | Purpose |
| --- | --- | --- | --- |
| `speaking` | Boolean | — | Enables speech performance layer |
| `gazeX` | Number | -1..1 | Horizontal eye/head target |
| `gazeY` | Number | -1..1 | Vertical eye/head target |
| `emotion` | Enum | calm, happy, curious, excited | Expression/performance mode |
| `mouthOpen` | Number | 0..1 | Jaw/open amount |
| `mouthWidth` | Number | 0..1 | Mouth width |
| `mouthRound` | Number | 0..1 | Lip rounding |
| `speechEnergy` | Number | 0..1 | Speech intensity / secondary motion |
| `lipPress` | Number | 0..1 | MBP closure |
| `lowerLipBite` | Number | 0..1 | FV lower-lip shape |
| `teeth` | Number | 0..1 | Teeth reveal |
| `tongue` | Number | 0..1 | Tongue reveal / L articulation |
| `cornerPull` | Number | 0..1 | Smile / spread contribution |
| `viseme` | Enum | REST, MBP, FV, EE, AA, OH, OO, L, CONS | Base mouth family |
| `react` | Trigger | — | One-shot interruption/click reaction |

This mirrors the useful signals already produced by `src/audio/VisemeAnalyzer.ts`, so the audio intelligence remains reusable while the visual renderer moves to Rive.

## Motion layers

1. **Ambient** — breathing, tiny body drift, antenna/secondary follow-through.
2. **Face** — blink cadence, eye darts, brows and gaze.
3. **Speech** — viseme base pose plus continuous `mouthOpen`, `mouthWidth`, `mouthRound`, energy, teeth and tongue controls.
4. **Emotion** — calm/happy/curious/excited pose offsets blended over the other layers.
5. **Reaction** — short squash/anticipation/recover gesture fired by `react`.

## Lip-sync strategy

Do not treat the nine visemes as nine sprite swaps. Each viseme is a base deformable mouth pose. Continuous analyzer values then refine that pose every frame. This keeps transitions smooth and lets the same `AA`, for example, look different at low and high speech energy.

Existing analyzer families:

`REST · MBP · FV · EE · AA · OH · OO · L · CONS`

## CLI checks

From the repository root:

```bash
rive rive/kiro --verify
rive inspect rive/kiro --json
rive rive/kiro --once
rive rive/kiro --screenshot=rive/kiro/build/kiro.png --advance=2s
```

The GitHub Actions workflow runs the same checks and uploads the generated `.riv`, screenshot, compiler logs and inspect output as artifacts.
