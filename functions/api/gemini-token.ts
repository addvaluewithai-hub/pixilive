interface Env { GEMINI_API_KEY: string }
const MODEL = 'gemini-3.8-live';
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origin not allowed' }, 403);
  if (!env.GEMINI_API_KEY) return json({ error: 'مفتاح Gemini مش مضبوط على الخادم. أضف GEMINI_API_KEY لتشغيل المحادثة.' }, 503);
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ uses: 1, expireTime: expiresAt, newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
        liveConnectConstraints: { model: `models/${MODEL}`, config: { responseModalities: ['AUDIO'] } } }),
    });
    if (!response.ok) return json({ error: 'تعذّر إصدار جلسة Gemini. راجع صلاحية المفتاح وإتاحة النموذج.', upstreamStatus: response.status }, 502);
    const token = await response.json() as { name?: string };
    if (!token.name) return json({ error: 'Invalid token response' }, 502);
    return json({ token: token.name, model: MODEL, expiresAt });
  } catch { return json({ error: 'خادم Gemini لم يستجب. جرّب مرة تانية.' }, 502); }
};
