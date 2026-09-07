# PixiLive

A real-time AI character playground built with **PixiJS**, **React**, **Gemini Live API**, and **Cloudflare Pages Functions**.

PixiLive is intentionally a **multi-character runtime**. Characters are procedural code, not pre-rendered avatar assets, and they share one audio, Gemini Live, lip-sync and UI infrastructure.

## Included characters

- **Milo** — monochrome editorial-style human mascot with hand-drawn motion.
- **Nova** — the original colorful cosmic creature with ears, tail, antenna glow and energetic secondary motion.

Neither character uses PNG/SVG character artwork, Rive, Live2D, Spine or a 3D model.

## Architecture

```text
                         character registry
                    ┌──────────┴──────────┐
                    │                     │
                  Milo                  Nova          ...future characters
                    │                     │
                    └──────────┬──────────┘
                               ▼
                       CharacterRuntime
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
         Pixi stage         lip sync          emotion/gaze

microphone ──16 kHz PCM──▶ Gemini Live WebSocket ──24 kHz PCM──▶ playback
                              ▲                              │
                              │                              └──▶ mouth pose ──▶ active character
Browser ──POST /api/gemini-token──▶ Cloudflare Pages Function
                                         │
                                         └── GEMINI_API_KEY (server-side only)
```

## Repository layout

```text
src/
├── audio/                         # microphone capture + PCM playback
├── character/
│   ├── runtime.ts                 # shared CharacterRuntime / CharacterDefinition contracts
│   ├── registry.ts                # all available characters + persona/theme/framing metadata
│   ├── types.ts                   # shared emotion + mouth controls
│   ├── MiloCharacter.ts           # Milo vector artwork and animation
│   └── NovaCharacter.ts           # Nova vector artwork and animation
├── components/
│   └── CharacterStage.tsx         # generic Pixi lifecycle; renders any registered character
├── live/
│   └── GeminiLiveClient.ts        # character-agnostic Gemini Live transport
└── App.tsx                        # character picker + shared product UI

functions/
└── api/
    └── gemini-token.ts            # server-side ephemeral-token endpoint
```

## Character contract

Every character implements the same runtime interface:

```ts
interface CharacterRuntime {
  view: Container;
  setEmotion(emotion: Emotion): void;
  setMouth(pose: MouthPose, speaking?: boolean): void;
  settleMouth(): void;
  lookAt(x: number, y: number): void;
  react(): void;
  update(ticker: Ticker): void;
}
```

A registry entry provides product metadata around that runtime:

```ts
{
  id: 'new-character',
  name: 'New Character',
  tagline: 'Short UI tagline',
  description: 'What this character feels like.',
  theme: 'mono',
  defaultEmotion: 'calm',
  emotions: ['calm', 'happy', 'curious', 'excited'],
  systemPrompt: 'Gemini persona instructions...',
  framing: { ... },
  ambient: { ... },
  create: () => new NewCharacter(),
}
```

### Adding a character

1. Add a class such as `src/character/NewCharacter.ts` implementing `CharacterRuntime`.
2. Add one entry to `src/character/registry.ts`.
3. Done: the selector, stage framing, emotion UI and Gemini persona all pick it up automatically.

Do not import a concrete character class from `App.tsx` or `CharacterStage.tsx`. Those layers should remain registry/runtime-driven.

## Gemini Live

The browser captures mono PCM16 at 16 kHz and connects directly to Gemini Live using a one-use ephemeral token. Gemini returns native PCM audio at 24 kHz. Playback analysis drives normalized mouth controls (`open`, `width`, `round`, `energy`) shared by every character.

The selected registry entry supplies Gemini's system instruction. Character switching is disabled during an active Live session so the visual character and model persona cannot drift apart.

Session resumption, context-window compression, interruption handling and transcription stay in the shared transport layer.

## Local development

```bash
npm install
npm run dev
```

For the full Pages app including the token function:

```bash
npm install
npm run build
npm run preview
```

Configure `GEMINI_API_KEY` as a Cloudflare secret/environment variable. Never put it in a `VITE_` variable because Vite exposes those values to browser code.

## Cloudflare Pages

Build settings:

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
Root directory: (empty)
```

Add `GEMINI_API_KEY` in the Pages project's Variables and Secrets settings.

## CI

`.github/workflows/ci.yml` runs a clean dependency install and `npm run build` for pull requests, pushes to `main`, and manual workflow dispatches.

## Gemini key note (September 2026)

Use a current Gemini authorization/auth key created in Google AI Studio rather than a legacy unrestricted Standard key.

`gemini-3.1-flash-live-preview` remains a preview model, so upstream Live behavior can still change.
