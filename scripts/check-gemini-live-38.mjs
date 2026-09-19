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
assert(!client.includes('v1alpha.GenerativeService.BidiGenerateContentConstrained'), 'Legacy v1alpha ephemeral-token endpoint remains in the client');
assert(token.includes('liveConnectConstraints'), 'Preferred ephemeral token path no longer attempts liveConnectConstraints');
assert(token.includes("responseModalities: ['AUDIO']"), 'Preferred ephemeral token is not constrained to AUDIO output');

const nonBlockingCount = (client.match(/behavior:\s*'NON_BLOCKING'/g) ?? []).length;
assert(nonBlockingCount >= 3, `Expected at least 3 NON_BLOCKING character tools, found ${nonBlockingCount}`);
assert(client.includes("scheduling: 'SILENT'"), 'Character tool responses are not SILENT');
assert(client.includes('multiple times inside the SAME spoken turn'), 'Freeform performance protocol does not explicitly require intra-turn expression changes');

assert(scriptPerformance.includes('parsePerformanceScript'), 'Tagged performance script parser is missing');
assert(scriptPerformance.includes('buildScriptPerformancePrompt'), 'Tagged performance prompt builder is missing');
assert(scriptPerformance.includes('ScriptPerformanceDirector'), 'Transcript-synced script director is missing');
assert(scriptPerformance.includes('getPlaybackClock'), 'Tagged director is not reading the PCM playback clock');
assert(scriptPerformance.includes('scheduleAtPlaybackTime'), 'Tagged director is not scheduling cues onto playback time');
assert(scriptPerformance.includes('scheduleCrossedBeats'), 'Tagged director no longer spreads batched transcript beats across playback');
assert(scriptPerformance.includes('ONE continuous spoken turn'), 'Tagged script prompt does not require a single continuous spoken turn');
assert(scriptPerformance.includes('NEVER pronounce'), 'Tagged script prompt does not explicitly keep stage tags silent');
assert(playback.includes('getClock()'), 'PCM queue no longer exposes its playback clock');
assert(playback.includes('scheduleAt(audioTimeSeconds'), 'PCM queue no longer supports playback-timed cues');
assert(playback.includes('hasPendingAudio()'), 'PCM queue cannot guard against ending script mode before buffered audio drains');
assert(app.includes('scriptServerTurnComplete'), 'App no longer waits for both server turn completion and playback drain');
assert(app.includes('TAGGED SCRIPT · PCM SYNC'), 'Demo no longer exposes PCM-synced tagged mode');
assert(app.includes('[surprised]'), 'Tagged demo no longer covers surprised');
assert(app.includes('[crying]'), 'Tagged demo no longer covers crying');
assert(app.includes('[pace:run]'), 'Tagged demo no longer covers locomotion changes');
assert(app.includes('Run tagged story — one live turn'), 'Tagged story control is missing from the demo UI');
assert(app.includes('Cue timeline:'), 'Demo no longer exposes the performance cue timeline');

console.log('Gemini 3.8 Live performance contract is locked: async freeform tools plus PCM-clock-synchronized tagged-script choreography inside one spoken turn.');
