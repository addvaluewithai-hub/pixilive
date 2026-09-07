# PixiLive

A real-time AI character experiment built with **PixiJS**, **React**, **Gemini Live API**, and **Cloudflare Pages Functions**.

**Milo is drawn procedurally at runtime.** There is no Rive file, Live2D model, 3D model, SVG character asset, or pre-rendered character image.

## Architecture

```text
microphone ──16 kHz PCM──▶ Gemini Live WebSocket ──24 kHz PCM──▶ audio playback
                              ▲                              │
                              │                              └──▶ mouth analysis ──▶ Milo rig
                              │
Browser ──POST /api/gemini-token──▶ Cloudflare Pages Function ──▶ Gemini Auth Token API
                                         │
                                         └── GEMINI_API_KEY (secret; never shipped to browser)
```

The Pages Function only mints a one-use ephemeral token. The browser then talks directly to Gemini Live for lower latency.

## Stack

- React 19 + TypeScript
- Vite 8
- PixiJS 8
- Cloudflare Pages + Pages Functions
- Gemini Live `gemini-3.1-flash-live-preview`
- AudioWorklet microphone capture (PCM16 / 16 kHz)
- native Gemini audio playback (PCM16 / 24 kHz)
- session resumption + context-window compression

## Repository layout

```text
src/
├── audio/                 # microphone capture + PCM playback
├── character/
│   ├── MiloCharacter.ts   # all character artwork + animation logic
│   └── types.ts           # emotion and mouth-control contracts
├── components/
│   └── CharacterStage.tsx # Pixi application/stage lifecycle
├── live/                  # Gemini Live WebSocket transport
└── App.tsx

functions/
└── api/
    └── gemini-token.ts    # server-side ephemeral-token endpoint
```

## Local development

The Vite-only command is useful for character/UI work:

```bash
npm install
npm run dev
```

For the full app including the Pages Function:

```bash
npm install
npm run build
npm run preview
```

Configure `GEMINI_API_KEY` as a Cloudflare secret/environment variable. Do **not** put it in a `VITE_` variable because Vite exposes those values to browser code.

## Cloudflare Pages deployment

Use these build settings:

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
Root directory: (empty)
```

Then add `GEMINI_API_KEY` under the Pages project's Variables and Secrets settings for the environments you want to use.

## Milo character engine

`src/character/MiloCharacter.ts` contains the entire visual character and rig as PixiJS vector code.

The rig includes:

- custom face, hair, clothing, folded arms, hands and line work
- autonomous breathing and subtle idle drift
- cursor-driven gaze
- natural blinking
- head and fringe follow-through
- asymmetric eyebrow expressions
- calm / happy / curious / excited poses
- parametric mouth controls (`open`, `width`, `round`, `energy`)
- speech-driven head motion
- interruption-safe lip-sync playback

The audio layer stays independent from the character. The current audio-to-mouth estimator can later be replaced by phoneme/viseme timings without rewriting the renderer or Gemini transport.

## Gemini key note (September 2026)

Gemini is migrating from legacy Standard API keys to authorization (auth) keys. Use a current auth key created in Google AI Studio.

### Preview-model note

`gemini-3.1-flash-live-preview` is still a preview model. Voice selection is intentionally not exposed because current model behavior can ignore `voiceName` even when the configuration is accepted.
