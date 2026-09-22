# PixiLive — Character Engine

A new SVG character application on `feat/character-engine`, based on `main` at `d85f0d5`. The previous Pixi/Rive applications remain in Git history. This branch uses our Character Lab artwork and a separate performance, speech, and Gemini architecture.

## Run

Use Node 22.18+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

This starts the character switcher and silent motion preview. Vite alone does **not** serve the Gemini token endpoint.

For real voice conversations, create a local `.dev.vars` file with `GEMINI_API_KEY=...`, then:

```sh
npm run preview
```

This builds the app and starts Cloudflare Pages locally, including `/api/gemini-token`. Open the URL printed by Wrangler and click **ابدأ الكلام**. Microphone access needs localhost or HTTPS. Never use a `VITE_` variable for the API key. The server defaults to `gemini-3.8-live`; model access must be available to the key's project.

## Cloudflare Preview troubleshooting

Secrets are configured separately for Production and Preview. For this branch, select **Preview** in the Pages project settings, confirm `GEMINI_API_KEY` is set, then deploy again if you changed it. Open the latest deployment for the branch; a hash-prefixed URL refers to a specific deployment and will not acquire later fixes.

The token endpoint uses the raw REST `AuthToken` schema (`bidiGenerateContentSetup` plus an explicit `fieldMask`), not the JavaScript SDK's `liveConnectConstraints` input. It preserves the client's tools and system instructions while locking the model and audio output.

Failures return a safe diagnostic code: `GEMINI_KEY_MISSING`, `GEMINI_KEY_INVALID`, `GEMINI_ACCESS_DENIED`, `GEMINI_RATE_LIMITED`, or `GEMINI_TOKEN_REQUEST_INVALID`. Upstream response bodies and API keys are never returned or logged. A successful token response does not by itself validate the subsequent Live WebSocket handshake.

References: [Google REST AuthToken](https://ai.google.dev/api/live#AuthToken), [Cloudflare environment bindings](https://developers.cloudflare.com/pages/functions/bindings/).

## Included

- Four configurable SVG characters: fox, cat, rabbit, bear.
- Switch appearance during a conversation without reconnecting or losing its context.
- Independent expression, gesture, and speech channels; a face change no longer moves both hands.
- One playback clock for PCM audio and visual sampling. No per-viseme JavaScript timers.
- Validated, non-blocking Gemini stage directions, silently acknowledged.
- Cancellation for interruption, cancelled tool calls, character changes, and stale socket messages.
- A clearly labeled **silent** motion demonstration; it does not fake a Gemini conversation.
- Deterministic tests for scheduling, cancellation, resampling, protocol handling, and the actual SVG rig.

## Structure

| Path | Responsibility |
|---|---|
| `src/engine-app/core/registry.ts` | Character recipes, supported gestures, motion intensity |
| `src/engine-app/core/SvgCharacter.ts` | Direct adapter to the SVG rig |
| `src/engine-app/core/PerformanceDirector.ts` | Timed cues, gesture limits, cancellation |
| `src/engine-app/core/SessionController.ts` | Conversation, audio, and character coordination |
| `src/engine-app/audio/PlaybackClock.ts` | PCM scheduling and mouth sampling |
| `src/engine-app/audio/Microphone.ts` | Capture lifecycle and continuous resampling |
| `src/engine-app/live/GeminiAdapter.ts` | Live protocol, tools, session resumption |
| `public/character-engine/` | Character Lab artwork, geometry, recipe engine, motion |
| `functions/api/gemini-token.ts` | Server-only ephemeral token issuance |

## Add a character

Add a definition to `characters` in `registry.ts`. Give it a unique `id`, choose a supported `species`, and optionally supply a `recipe` with colors, proportions, and an accessory. The switcher discovers definitions automatically.

```ts
{
  id: 'night-fox', species: 'fox', name: 'ليل',
  description: 'ثعلب بألوان ليلية', accent: '#8A839B',
  gestures: common, motionScale: 0.4,
  recipe: { fur: '#8A839B', cream: '#E8E1E9', accent: '#D49B64', accessory: 'scarf' }
}
```

A new anatomy requires geometry/rig work. The shared engine does not claim to generate arbitrary species from four presets. Current switching changes appearance and motion style, not the agent's identity or voice.

## Verification

```sh
npm run check
```

Tests use fake audio/network devices and a deterministic DOM fixture running the actual rig scripts. They do not prove browser layout, audible lip-sync quality, or a real Gemini handshake. Browser inspection was omitted at the user's request. No real Gemini session was run in the development environment.

See [architecture and remaining validation](docs/architecture.md).
