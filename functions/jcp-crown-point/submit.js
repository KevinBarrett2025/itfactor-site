import { checkOrigin, enabled, InputError, json, normalizeSubmission, readJSON, verifyTurnstile } from '../_lib/crown-point.mjs';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Use the size-card form to submit.' }, 405, { Allow: 'POST' });
  try {
    const hostname = checkOrigin(request);
    if (!enabled(env) || !env.TURNSTILE_SECRET_KEY || !env.CROWN_POINT_MAILER) {
      return json({ ok: false, error: 'Submissions are not available yet. Your card has not been sent.' }, 503);
    }
    const payload = await readJSON(request);
    const submission = normalizeSubmission(payload);
    await verifyTurnstile(payload.turnstileToken, hostname, env.TURNSTILE_SECRET_KEY);
    // Call the private service only after every field and the single-use token pass.
    // Never pass the browser's requested destination, headers, or token to the mailer.
    const response = await env.CROWN_POINT_MAILER.fetch(new Request('https://crown-point-mailer.internal/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
    }));
    const result = await response.json();
    if (!response.ok || result.ok !== true || typeof result.receipt !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(result.receipt)) throw new Error('Delivery not confirmed');
    return json({ ok: true, receipt: result.receipt });
  } catch (error) {
    if (error instanceof InputError) return json({ ok: false, error: error.message }, error.status);
    // An interrupted provider request may already have been accepted: no automatic retry.
    return json({ ok: false, uncertain: true, error: 'We could not confirm email acceptance. Your entries are still here. Please contact Kevin before retrying to avoid a duplicate.' }, 502);
  }
}
