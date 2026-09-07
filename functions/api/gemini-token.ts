interface Env {
  GEMINI_API_KEY: string;
}

const MODEL = 'gemini-3.1-flash-live-preview';
const TOKEN_URL = 'https://generativelanguage.googleapis.com/v1beta/auth_tokens';

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...init.headers,
    },
  });
}

async function issueGeminiToken(env: Env) {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }

  const now = Date.now();
  const expireTime = new Date(now + 30 * 60_000).toISOString();
  const newSessionExpireTime = new Date(now + 60_000).toISOString();

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      uses: 1,
      expireTime,
      newSessionExpireTime,
      fieldMask: 'model',
      bidiGenerateContentSetup: {
        model: `models/${MODEL}`,
      },
    }),
  });

  if (!response.ok) {
    const upstream = await response.text();
    console.error('Gemini token issuance failed', response.status, upstream);
    return json(
      { error: 'Could not create a Gemini ephemeral token', status: response.status },
      { status: 502 },
    );
  }

  const token = (await response.json()) as { name?: string };
  if (!token.name) {
    return json({ error: 'Gemini returned an invalid token response' }, { status: 502 });
  }

  return json({ token: token.name, model: MODEL, expiresAt: expireTime });
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { allow: 'POST' },
    });
  }

  return issueGeminiToken(env);
};
