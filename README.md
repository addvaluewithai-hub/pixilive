# PixiLive

An experimental real-time AI character built with **PixiJS**, **React**, **Gemini Live API**, and **Cloudflare Workers**.

Nova is drawn procedurally at runtime — there is no Rive, Live2D, 3D model, or pre-rendered character asset.

## Architecture

```text
microphone ──16 kHz PCM──▶ Gemini Live WebSocket ──24 kHz PCM──▶ audio playback
                              ▲                              │
                              │                              └──▶ mouth analysis ──▶ PixiJS rig
                              │
Browser ──POST /api/gemini-token──▶ Cloudflare Worker ──▶ Gemini Auth Token API
                                         │
                                         └── GEMINI_API_KEY (secret; never shipped to browser)
```

The Worker only mints a one-use ephemeral token. The browser then talks directly to Gemini Live for lower latency.

## Stack

- React 19 + TypeScript
- Vite 8
- PixiJS 8
- Cloudflare Vite plugin + Workers Static Assets
- Gemini Live `gemini-3.1-flash-live-preview`
- AudioWorklet microphone capture (PCM16 / 16 kHz)
- Native Gemini audio playback (PCM16 / 24 kHz)
- session resumption + context-window compression

## Local development

```bash
npm install
cp .env.example .dev.vars
# edit .dev.vars and set GEMINI_API_KEY
npm run dev
```

Do **not** put `GEMINI_API_KEY` in a `VITE_` variable. Vite exposes those values to browser code.

## Cloudflare deployment

This repo follows Cloudflare's current React + Vite + Workers Static Assets setup.

1. Connect the GitHub repository to a Cloudflare Worker build.
2. Add `GEMINI_API_KEY` as an encrypted Worker secret.
3. Build command: `npm run build`
4. Deploy command: `npx wrangler deploy`

Or locally:

```bash
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

## Gemini key note (September 2026)

Gemini is migrating from legacy Standard API keys to authorization (auth) keys. Use a current auth key created in Google AI Studio.

## Character engine

`src/character/NovaCharacter.ts` owns the procedural rig: eyes, gaze, blinking, brows, ears, tail, antenna, breathing, emotion states, body language, and parametric mouth shapes.

The audio layer intentionally remains independent of the character. A future phoneme/viseme model can replace the current lightweight audio-to-mouth estimator without rewriting the renderer or Gemini transport.

### Preview-model note

`gemini-3.1-flash-live-preview` is still a preview model. Voice selection is intentionally not exposed in this demo because recent reports show `voiceName` may currently be ignored by the model even when the configuration is accepted.
