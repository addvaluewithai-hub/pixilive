import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/gemini-token.ts';
const url = 'https://preview.pixilive.pages.dev/api/gemini-token';
const context = (key = 'test-api-key', method = 'POST', origin = 'https://preview.pixilive.pages.dev') => ({
  request: new Request(url, { method, headers: { Origin: origin } }), env: { GEMINI_API_KEY: key },
}) as Parameters<typeof onRequest>[0];
test('token request uses REST schema and locks only model and audio modality', async t => {
  let body: Record<string, any> = {};
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    assert.equal(input, 'https://generativelanguage.googleapis.com/v1beta/auth_tokens');
    assert.equal((init.headers as Record<string,string>)['x-goog-api-key'], 'test-api-key');
    body = JSON.parse(init.body as string);
    return Response.json({ name: 'auth_tokens/test-token' });
  });
  const response = await onRequest(context(' test-api-key '));
  assert.equal(response.status, 200);
  assert.equal(body.liveConnectConstraints, undefined);
  assert.equal(body.fieldMask, 'model,generationConfig.responseModalities');
  assert.deepEqual(body.bidiGenerateContentSetup, { model: 'models/gemini-3.8-live', generationConfig: { responseModalities: ['AUDIO'] } });
  assert.equal(body.uses, 1);
  assert.ok(Date.parse(body.newSessionExpireTime) > Date.now());
  assert.ok(Date.parse(body.expireTime) > Date.parse(body.newSessionExpireTime));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).token, 'auth_tokens/test-token');
});
test('missing Preview secret fails locally without calling Google', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not call'); });
  const response = await onRequest(context('   '));
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'GEMINI_KEY_MISSING');
  assert.equal(fetch.mock.callCount(), 0);
});
test('invalid request is distinguished from invalid API key without exposing upstream data', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'Unknown name liveConnectConstraints; secret-test-key', status: 'INVALID_ARGUMENT' } }, { status: 400 }));
  const response = await onRequest(context()); const body = await response.json();
  assert.equal(response.status, 502); assert.equal(body.code, 'GEMINI_TOKEN_REQUEST_INVALID'); assert.equal(body.upstreamStatus, 400);
  assert.ok(!JSON.stringify(body).includes('secret-test-key'));
});
test('Google API_KEY_INVALID details select credential-specific guidance', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { details: [{ reason: 'API_KEY_INVALID' }] } }, { status: 400 }));
  const response = await onRequest(context()); assert.equal((await response.json()).code, 'GEMINI_KEY_INVALID');
});
test('quota, permission and non-JSON upstream errors remain distinguishable', async t => {
  for (const [status, code] of [[403, 'GEMINI_ACCESS_DENIED'], [429, 'GEMINI_RATE_LIMITED'], [503, 'GEMINI_TOKEN_UPSTREAM_FAILED']] as const) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('upstream-private-detail', { status }));
    const response = await onRequest(context()); const body = await response.json(); assert.equal(body.code, code); assert.ok(!JSON.stringify(body).includes('upstream-private-detail'));
    fetch.mock.restore();
  }
});
test('method and origin guards remain enforced', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not call'); });
  assert.equal((await onRequest(context('test', 'GET'))).status, 405);
  assert.equal((await onRequest(context('test', 'POST', 'https://other.example'))).status, 403);
  assert.equal(fetch.mock.callCount(), 0);
});
