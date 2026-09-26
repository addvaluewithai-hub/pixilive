# Graphic mascots

Fustuq (فستق) is the first graphic mascot: an original bean-shaped vector adaptation of the supplied green character direction. This pilot covers the existing six gestures and ten expressions, not the reference sheets' walking/running/dancing catalogue. The furry design is a separate future art task.

## Reuse boundary

- `mascot-art.js`: independent silhouette, asymmetrical eyes, flat color shapes, small rounded limbs and reusable portrait. It does not reuse human anatomy or redraw the existing animals.
- `mascot-motion.js`: coordinated body lean, planted feet, facial expression and hand poses. A hop has anticipation, lift and landing. Secondary waving and pose replacements preserve state/velocity. A short distal arm overlay lets the thinking hand reach the cheek while the shoulder remains behind the body.
- `CharacterGeometry.arm` and `CharacterGeometry.mouth`: reused from the original animal engine. These are intentionally stylized rounded limbs, not the human arm solver. Mouth visemes, clipping and silence/MBP closure are shared.
- `SvgCharacter`, `CharacterPort`, `PerformanceDirector`, playback clock, Gemini connection and conversation logs: the same integration contract. No alternate live-session implementation or network calls in the renderer. The agent receives the new visible identity and ground-only capability.

Octo is first in the selector and initially selected for review; Fustuq remains available. All existing characters remain selectable. Its SVG stays inside a bounded stage with margins for the hop and raised arms. Reduced motion suppresses bouncing and idle body motion while retaining essential expressions and speech. Disposal removes animation callbacks and preference/visibility listeners.

## Review and next additions

Offline SVG renders cover neutral, greeting, thinking, laughing, sad and airborne poses. Tests cover all existing expressions/gestures with audio visemes, interruption, jump phases, closed eyes, scoped portraits, cleanup and adapter routing. Browser and live-microphone checks are not part of this review.

Another mascot should get its own silhouette, face anchors and proportions, plus authored pose targets where needed. Reuse the speech/performance contract; do not stretch a human drawing to fit a mascot. The furry proposal can use this family contract with its own outline and art layers after the pilot's direction is accepted.

## Octo / أوكتو

The pink octopus has a dedicated art module (`octopus.js`) and a dedicated motion rig (`octopus-motion.js`). `MascotMotion` delegates Octo at its entry point; Fustuq's original mechanics remain separate. The live controller, playback clock, mouth geometry, tool contract, copy log and avatar switching are reused. Costume variations remain outside this character revision.

### Continuous body and relaxed rest

The mantle and eight tentacles share one masked skin fill with one gradient in character coordinates. There is no painted bottom edge of the head to make it look attached to a skirt of limbs. Round swept cross-sections make the tentacle envelope solid even where a tightly curled centerline overlaps itself; the earlier normal-offset outline could invert at those bends. Underparts taper into the skin and suckers follow their tentacle curves.

The dome is rounder, lower tentacles are shorter, rear tentacles are tucked and the two side curls rest at slightly different heights. Resting eyes are fully open. Only the mantle flexes during quiet breathing: the face and tentacle roots share that deformation while lower tips remain nearly planted. Side curls have less than one design unit of idle drift. Gesture poses lead with small mantle shifts and delayed tentacle bends rather than rotating the entire animal.

### Independent performance

The octopus rig owns its idle, pose targets, tip/curl channels, anticipation, tuck and landing. Damped transitions retain current position and velocity on interruption. Small integration steps keep trajectories consistent at 30, 60 and 120 Hz. Wave and celebration accents fade through their own smoothed channels. Facial expressions, silent lip closure, reduced motion, hidden-tab handling and disposal are preserved. Octo cannot fly.

Validation covers all ten expressions and six active gestures with speech, closed lips and laughter eyes, scoped masks/portraits, frame-by-frame interruption bounds, rest recovery, restrained idle motion, matching mantle/face deformation, frame-rate consistency and reduced-motion cleanup. Offline renders inspect poses and sampled transitions; an alpha check verifies no holes through the mantle-to-tentacle connection in those transition frames. Browser and live-microphone checks were not run.
