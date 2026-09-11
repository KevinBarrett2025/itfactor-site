import { buildConfirmationEmail, buildEmail, createRecipientRateKey, enabled, InputError, json, normalizeSubmission, readJSON } from '../../functions/_lib/crown-point.mjs';

const RATE_KEY = /^[a-f0-9]{64}$/;
async function permitted(binding, key) {
  const result = await binding.limit({ key });
  return result?.success === true;
}

export default {
  async fetch(request, env) {
    // This Worker has neither a public route nor workers.dev/preview URLs.
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/send') return json({ ok: false }, 404);
    if (!enabled(env) || !env.KEVIN_EMAIL || !env.TALENT_EMAIL ||
        !env.SUBMISSION_RATE_LIMITER || !env.RECIPIENT_RATE_LIMITER) return json({ ok: false }, 503);
    try {
      const submission = normalizeSubmission(await readJSON(request), false);
      const clientRateKey = request.headers.get('X-Crown-Point-Client-Key') || '';
      if (!RATE_KEY.test(clientRateKey)) throw new InputError('The submission source could not be verified.', 403);
      const recipientRateKey = await createRecipientRateKey(submission.fields.email);
      if (!await permitted(env.SUBMISSION_RATE_LIMITER, clientRateKey) ||
          !await permitted(env.RECIPIENT_RATE_LIMITER, recipientRateKey)) {
        return json({ ok: false, rateLimited: true }, 429);
      }
      const receipt = crypto.randomUUID();
      const result = await env.KEVIN_EMAIL.send(buildEmail(submission, receipt, new Date().toISOString()));
      if (!result || typeof result.messageId !== 'string' || !result.messageId) throw new Error('No provider acknowledgement');
      try {
        const confirmation = await env.TALENT_EMAIL.send(buildConfirmationEmail(submission));
        if (!confirmation || typeof confirmation.messageId !== 'string' || !confirmation.messageId) {
          throw new Error('No confirmation acknowledgement');
        }
      } catch {
        // Intentionally contains no recipient, message ID, provider details, or form data.
        console.warn('talent_confirmation_send_failed');
      }
      return json({ ok: true, receipt });
    } catch (error) {
      if (error instanceof InputError) return json({ ok: false, error: error.message }, error.status);
      return json({ ok: false, uncertain: true }, 502);
    }
  },
};
