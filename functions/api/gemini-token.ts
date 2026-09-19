interface Env {
  GEMINI_API_KEY: string;
}

const MODEL = 'gemini-3.8-live';
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

interface TokenAttempt {
  response: Response;
  bodyText: string;
}

async function requestToken(env: Env, body: Record<string, unknown>): Promise<TokenAttempt> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });
  return { response, bodyText: await response.text() };
}

function parseToken(bodyText: string): { name?: string } {
  try {
    return JSON.parse(bodyText) as { name?: string };
  } catch {
    return {};
  }
}

async function issueGeminiToken(env: Env) {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }

  const now = Date.now();
  const expireTime = new Date(now + 30 * 60_000).toISOString();
  const newSessionExpireTime = new Date(now + 60_000).toISOString();

  // Preferred path: lock the ephemeral token to the exact Gemini 3.8 Live audio setup.
  // This follows Google's documented constrained-token shape. Some projects can still
  // return INVALID_ARGUMENT while the constraint capability rolls out, so we fall back
  // to a basic short-lived token rather than breaking the voice experience.
  const constrained = await requestToken(env, {
    uses: 1,
    expireTime,
    newSessionExpireTime,
    liveConnectConstraints: {
      model: `models/${MODEL}`,
      config: {
        sessionResumption: {},
        responseModalities: ['AUDIO'],
      },
    },
  });

  if (constrained.response.ok) {
    const token = parseToken(constrained.bodyText);
    if (!token.name) {
      return json({ error: 'Gemini returned an invalid constrained token response' }, { status: 502 });
    }
    return json({ token: token.name, model: MODEL, expiresAt: expireTime, tokenMode: 'constrained' });
  }

  console.warn(
    'Gemini constrained token provisioning failed; retrying with basic ephemeral token',
    constrained.response.status,
    constrained.bodyText,
  );

  // Fallback path: basic ephemeral tokens are also officially supported for Live API.
  // The browser still connects only to the v1beta Live endpoint and requests MODEL in
  // BidiGenerateContentSetup; this merely avoids provisioning-time constraint rejection.
  const basic = await requestToken(env, {
    uses: 1,
    expireTime,
    newSessionExpireTime,
  });

  if (!basic.response.ok) {
    console.error('Gemini basic token issuance failed', basic.response.status, basic.bodyText);
    return json(
      {
        error: 'Could not create a Gemini ephemeral token',
        status: basic.response.status,
        constrainedStatus: constrained.response.status,
        constrainedDetails: constrained.bodyText.slice(0, 1200),
        details: basic.bodyText.slice(0, 1200),
      },
      { status: 502 },
    );
  }

  const token = parseToken(basic.bodyText);
  if (!token.name) {
    return json({ error: 'Gemini returned an invalid basic token response' }, { status: 502 });
  }

  return json({
    token: token.name,
    model: MODEL,
    expiresAt: expireTime,
    tokenMode: 'basic-fallback',
  });
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