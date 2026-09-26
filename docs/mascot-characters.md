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

The pink octopus is the second mascot, adapted from the supplied reference sheets. Its independent `octopus.js` anatomy supplies its rounded silhouette, face anchors, tentacles and pose targets to the existing mascot rig. It does not reuse human arms or feet. The accessory/costume variations on the reference sheets are outside this initial character scope.

Eight tapered tentacles use pairs of tangent-continuous cubic curves. Six form the lower silhouette; two side tentacles wave, explain, curl beside the cheek and celebrate. Each underside and sucker position is computed from the same curve as its tentacle. The distal side sections overlap the back sections exactly so a thinking curl can appear in front of the body without a separate wrist, shoulder cap or changing layer order. Shared coordinates for the skin gradient prevent seams at those overlaps.

The mascot motion layer retains its critically damped pose transitions, including velocity when interrupted. The octopus supplies separate rest and gesture targets, subtle phased lower-tentacle motion, and its own shadow and face measurements. Shared visemes, silence closure, blink, expression blending, reduced-motion preference and disposal lifecycle remain in one implementation. The existing live controller, audio playback clock, tools, copy log and avatar switching are reused. The model receives Octo's visible identity and tentacle anatomy; this is a ground character, not a flyer.

Validation includes all ten expressions and six active gestures alongside speech, MBP closure, complete laughter eye closure, safe scoped portraits, frame-by-frame interruption bounds for all eight tentacles, matching foreground sucker positions, rest recovery and reduced-motion cleanup. Offline contact sheets inspect resting poses, acting poses and sampled transitions. Browser and live-microphone checks were not run.
