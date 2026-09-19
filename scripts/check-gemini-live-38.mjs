import { readFile } from 'node:fs/promises';

const client = await readFile(new URL('../src/live/GeminiLiveClient.ts', import.meta.url), 'utf8');
const token = await readFile(new URL('../functions/api/gemini-token.ts', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(client.includes("const MODEL = 'gemini-3.8-live'"), 'Live client is not using gemini-3.8-live');
assert(token.includes("const MODEL = 'gemini-3.8-live'"), 'Ephemeral token issuer is not scoped to gemini-3.8-live');
assert(!client.includes('gemini-3.1-flash-live-preview'), 'Legacy Gemini 3.1 model remains in the Live client');
assert(!token.includes('gemini-3.1-flash-live-preview'), 'Legacy Gemini 3.1 model remains in the token issuer');
assert(client.includes('v1beta.GenerativeService.BidiGenerateContentConstrained'), 'Ephemeral-token WebSocket is not using the required v1beta constrained endpoint');
assert(!client.includes('v1alpha.GenerativeService.BidiGenerateContentConstrained'), 'Legacy v1alpha ephemeral-token endpoint remains in the client');
assert(token.includes('liveConnectConstraints'), 'Ephemeral token is not using liveConnectConstraints');
assert(token.includes("responseModalities: ['AUDIO']"), 'Ephemeral token is not constrained to AUDIO output');

const nonBlockingCount = (client.match(/behavior:\s*'NON_BLOCKING'/g) ?? []).length;
assert(nonBlockingCount >= 3, `Expected at least 3 NON_BLOCKING character tools, found ${nonBlockingCount}`);
assert(client.includes("scheduling: 'SILENT'"), 'Character tool responses are not SILENT');
assert(client.includes('multiple times inside the SAME spoken turn'), 'Performance protocol does not explicitly require intra-turn expression changes');
assert(app.includes('5 إلى 7 تغييرات عاطفية واضحة داخل نفس الـturn'), 'Story stress test no longer requires multiple emotional beats in one turn');
assert(app.includes('Cue timeline:'), 'Demo no longer exposes the intra-turn stage-direction timeline');

console.log('Gemini 3.8 Live migration is locked: model, v1beta ephemeral transport, liveConnectConstraints, NON_BLOCKING tools, SILENT scheduling, and multi-expression story choreography.');
