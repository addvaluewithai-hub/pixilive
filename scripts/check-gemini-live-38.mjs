import { readFile } from 'node:fs/promises';

const client = await readFile(new URL('../src/live/GeminiLiveClient.ts', import.meta.url), 'utf8');
const token = await readFile(new URL('../functions/api/gemini-token.ts', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const scriptPerformance = await readFile(new URL('../src/live/scriptPerformance.ts', import.meta.url), 'utf8');
const playback = await readFile(new URL('../src/audio/PcmPlaybackQueue.ts', import.meta.url), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(client.includes("const MODEL = 'gemini-3.8-live'"), 'Live client is not using gemini-3.8-live');
assert(token.includes("const MODEL = 'gemini-3.8-live'"), 'Ephemeral token issuer is not scoped to gemini-3.8-live');
assert(!client.includes('gemini-3.1-flash-live-preview'), 'Legacy Gemini 3.1 model remains in the Live client');
assert(!token.includes('gemini-3.1-flash-live-preview'), 'Legacy Gemini 3.1 model remains in the token issuer');
assert(client.includes('v1beta.GenerativeService.BidiGenerateContentConstrained'), 'Ephemeral-token WebSocket is not using the required v1beta constrained endpoint');
assert(token.includes('liveConnectConstraints'), 'Preferred ephemeral token path no longer attempts liveConnectConstraints');

const nonBlockingCount = (client.match(/behavior:\s*'NON_BLOCKING'/g) ?? []).length;
assert(nonBlockingCount >= 3, `Expected at least 3 NON_BLOCKING character tools, found ${nonBlockingCount}`);
assert(client.includes("scheduling: 'SILENT'"), 'Character tool responses are not SILENT');

assert(scriptPerformance.includes('parsePerformanceScript'), 'Tagged performance script parser is missing');
assert(scriptPerformance.includes('buildScriptBeatPrompt'), 'Direct story-beat prompt builder is missing');
assert(scriptPerformance.includes('VOICE_DIRECTIONS'), 'Tagged expressions no longer define matching voice acting');
assert(!scriptPerformance.includes('ScriptPerformanceDirector'), 'Timeline director came back; tagged mode should stay simple');
assert(!scriptPerformance.includes('WORDS_PER_SECOND'), 'Estimated timing model came back; tagged mode should stay direct');
assert(!scriptPerformance.includes('getPlaybackClock'), 'Playback-clock choreography came back; tagged mode should stay direct');

assert(playback.includes('hasPendingAudio()'), 'Playback queue cannot tell when a spoken beat has drained');
assert(!playback.includes('scheduleAt(audioTimeSeconds'), 'Playback cue scheduler came back; direct beat mode should not need one');
assert(!playback.includes('turnStartSeconds'), 'Turn timeline clock came back; direct beat mode should not need one');

assert(app.includes('scriptSession'), 'App no longer owns the simple tagged-script beat queue');
assert(app.includes('advanceScriptBeat'), 'App no longer advances tagged story one beat at a time');
assert(app.includes('buildScriptBeatPrompt(beat.text, session.expression)'), 'Tagged beat is not sent with its current voice expression');
assert(app.includes('if (!scriptSession.current) live.current?.sendAudio(chunk)'), 'Microphone is not gated during deterministic tagged playback');
assert(app.includes('TAGGED SCRIPT · DIRECT BEATS'), 'Demo no longer exposes direct-beat tagged mode');
assert(app.includes('[surprised]'), 'Tagged demo no longer covers surprised');
assert(app.includes('[crying]'), 'Tagged demo no longer covers crying');
assert(app.includes('[pace:run]'), 'Tagged demo no longer covers locomotion changes');
assert(app.includes('Run tagged story — direct beats'), 'Tagged story control is missing from the demo UI');
assert(app.includes('Cue timeline:'), 'Demo no longer exposes the performance cue timeline');

console.log('Gemini 3.8 Live performance contract is locked: freeform async tools plus simple tag -> expression -> spoken beat choreography.');
