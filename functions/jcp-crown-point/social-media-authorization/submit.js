import {
  AUTH_ACTION,
  checkAuthorizationOrigin,
  normalizeAuthorization,
} from '../../_lib/crown-point-authorization.mjs';
import {
  createClientRateKey,
  enabled,
  InputError,
  json,
  readJSON,
  verifyTurnstile,
} from '../../_lib/crown-point.mjs';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Use the authorization form to submit.' }, 405, { Allow: 'POST' });
  try {
    const hostname = checkAuthorizationOrigin(request);
    if (!enabled(env) || !env.TURNSTILE_SECRET_KEY || !env.CROWN_POINT_MAILER) {
      return json({ ok: false, error: 'Authorizations are not available yet. Nothing has been sent.' }, 503);
    }
    const payload = await readJSON(request);
    const submission = normalizeAuthorization(payload);
    await verifyTurnstile(payload.turnstileToken, hostname, env.TURNSTILE_SECRET_KEY, fetch, AUTH_ACTION);
    const clientRateKey = await createClientRateKey(request, env.TURNSTILE_SECRET_KEY);
    const response = await env.CROWN_POINT_MAILER.fetch(new Request('https://crown-point-mailer.internal/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Crown-Point-Client-Key': clientRateKey },
      body: JSON.stringify(submission),
    }));
    const result = await response.json();
    if (response.status === 429 && result.rateLimited === true) {
      return json({ ok: false, error: 'Please wait a minute before sending another authorization. Your entries are still here.' }, 429);
    }
    if (!response.ok || result.ok !== true || typeof result.receipt !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(result.receipt)) throw new Error('Delivery not confirmed');
    return json({ ok: true, receipt: result.receipt });
  } catch (error) {
    if (error instanceof InputError) return json({ ok: false, error: error.message }, error.status);
    return json({
      ok: false,
      uncertain: true,
      error: 'We could not confirm email acceptance. Your entries are still here. Please contact Kevin before retrying to avoid a duplicate.',
    }, 502);
  }
}
