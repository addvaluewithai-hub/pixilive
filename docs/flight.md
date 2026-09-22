# Flying characters

Lumi and Naseem are recipes of the new `sprite` family. They reuse the persistent SVG, expression/viseme geometry and hand rig. Wings, hair tuft and chest star are semantic parts of the same master. New colors can be added in `src/engine-app/core/registry.ts` with `species: 'sprite'`, `canFly: true`, and a recipe; no new character renderer is needed.

## Control contract

The manual controls and Gemini `fly` function use the same validated command:

```json
{"action":"move","x":0.2,"y":0.15,"speed":0.5,"path":"arc"}
```

- `action`: `move`, `hover`, `land`.
- `x`: 0 = screen left, 1 = screen right, regardless of UI language.
- `y`: 0 = upper flight limit, 1 = landing level. These are safe character-center bounds within the stage, not raw viewport edges.
- `speed`: 0.1–1. Relative travel speed; acceleration, braking, turn banking and wingbeats are automatic. Lowering speed while moving decelerates rather than snapping velocity.
- `path`: `direct`, `arc` (upward curve), `swoop` (downward curve).
- `move` requires x/y. `land` uses x (default center), ignores y and settles at the floor. `hover` brakes where the character is; position fields are ignored. Defaults: speed 0.5, direct path.

The safe center rectangle maps to SVG coordinates x=190–450, y=150–350, with a 0.76 character scale. It reserves space for wings and gestures. `flight.js` owns its animation clock: switching between offline preview and live audio cannot reset the trajectory. Position/velocity survive retargeting; invisible-tab time is not replayed in a jump. Reduced motion removes banking and bobbing and reduces travel speed while preserving destination control.

## Speech and lifecycle

`fly` is NON_BLOCKING and acknowledges SILENT at the FunctionResponse envelope. It starts on receipt, including during buffered speech; it does not wait for turnComplete or a later audio packet. Precise alignment to a particular spoken word is not guaranteed by this API. `perform` remains on the playback clock and can update hands/face without resetting flight. Lip sync remains audio-driven.

A new flight replaces the old route. Barge-in, connection closure, manual override, tool cancellation and character change cancel the corresponding tool record; interruption brakes into a hover. Avatar replacement destroys its old rig. Only winged characters accept flight. The next silent tool response after a character switch carries updated avatar capabilities without injecting an extra conversational turn.

## Trying it

Choose لومي or نسمة. The flight controls work without a Gemini connection. Start a conversation and open “اختبار تفاعل Gemini” → “حكاية وطيران” for a complete ten-sentence story with five flight beats and face/hand cues. This sends a model request, not simulated tool calls. The model still chooses when to emit calls; a real session is needed to judge narration timing and visual quality.

Copy log includes one row per actual `fly` call, parameters, renderer dispatch with audio state, then arrival or cancellation. Manual flight does not inflate the Gemini counters. No per-frame motion data is logged.

`npm run check` covers flight trajectories, speed and bounds, mid-flight reversal/braking, landing/takeoff, reduced motion, shared expressions and mouths, and mocked Live packets for concurrent speech/gestures, deduplication, switch/interrupt cleanup and concise logging. No browser test is required.
