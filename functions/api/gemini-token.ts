interface Env { GEMINI_API_KEY: string }
const MODEL = 'gemini-3.8-live';
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
interface GoogleFailure { error?: { status?: string; message?: string; details?: { reason?: string }[] } }
function classifyFailure(status: number, failure: GoogleFailure) {
  const reasons = failure.error?.details?.map(detail => detail.reason ?? '') ?? [];
  const message = failure.error?.message ?? '';
  // Only fixed diagnostic codes/messages leave this endpoint. Upstream payloads
  // may contain credentials or project information and must never be forwarded.
  if (reasons.includes('API_KEY_INVALID') || /API key not valid|API key expired/i.test(message)) {
    return { code: 'GEMINI_KEY_INVALID', error: 'Google رفض مفتاح Gemini. راجع قيمة GEMINI_API_KEY في بيئة النشر الحالية، ثم أعد النشر.' };
  }
  if (status === 401 || status === 403) {
    return { code: 'GEMINI_ACCESS_DENIED', error: 'Google رفض صلاحية الطلب. راجع قيود مفتاح Gemini وتفعيل Generative Language API للمشروع.' };
  }
  if (status === 429) {
    return { code: 'GEMINI_RATE_LIMITED', error: 'Google رفض الطلب بسبب حد الاستخدام. راجع الحصة والفوترة أو جرّب لاحقًا.' };
  }
  if (status === 400) {
    return { code: 'GEMINI_TOKEN_REQUEST_INVALID', error: 'Google رفض صيغة طلب الجلسة (400). المشكلة محتاجة مراجعة إعدادات الاتصال في التطبيق، ومش دليل لوحده إن المفتاح غلط.' };
  }
  if (status === 404) {
    return { code: 'GEMINI_TOKEN_RESOURCE_UNAVAILABLE', error: 'خدمة إصدار جلسة Gemini أو المورد المطلوب غير متاح (404).' };
  }
  return { code: 'GEMINI_TOKEN_UPSTREAM_FAILED', error: `تعذّر إصدار جلسة Gemini. خدمة Google رجّعت خطأ (${status}). جرّب مرة تانية.` };
}
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origin not allowed', code: 'ORIGIN_NOT_ALLOWED' }, 403);
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return json({ error: 'مفتاح Gemini مش مضبوط في بيئة النشر الحالية. لو الرابط Preview، أضف GEMINI_API_KEY في إعدادات Preview ثم أعد النشر.', code: 'GEMINI_KEY_MISSING' }, 503);
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
        // Raw REST AuthToken schema, not the SDK's liveConnectConstraints input.
        // The explicit mask preserves the browser's tools, system instruction,
        // transcription and session-resumption settings while locking these fields.
        fieldMask: 'model,generationConfig.responseModalities',
        bidiGenerateContentSetup: {
          model: `models/${MODEL}`,
          generationConfig: { responseModalities: ['AUDIO'] },
        },
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as GoogleFailure;
      const diagnostic = classifyFailure(response.status, failure);
      console.warn('Gemini token issuance failed', { code: diagnostic.code, upstreamStatus: response.status });
      return json({ ...diagnostic, upstreamStatus: response.status }, 502);
    }
    const token = await response.json() as { name?: string };
    if (!token.name || typeof token.name !== 'string') return json({ error: 'Google رجّعت ردًا غير صالح لإصدار الجلسة.', code: 'GEMINI_TOKEN_RESPONSE_INVALID' }, 502);
    return json({ token: token.name, model: MODEL, expiresAt });
  } catch { return json({ error: 'خادم Gemini لم يستجب. جرّب مرة تانية.', code: 'GEMINI_TOKEN_CONNECTION_FAILED' }, 502); }
};
