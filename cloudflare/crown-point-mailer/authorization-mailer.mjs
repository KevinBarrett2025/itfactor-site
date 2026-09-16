import {
  buildAuthorizationConfirmation,
  buildAuthorizationEmail,
  createAuthorizationPdf,
  normalizeAuthorization,
} from '../../functions/_lib/crown-point-authorization.mjs';
import {
  createRecipientRateKey,
  enabled,
  InputError,
  json,
  readJSON,
} from '../../functions/_lib/crown-point.mjs';

const RATE_KEY = /^[a-f0-9]{64}$/;
const permitted = async (binding, key) => (await binding.limit({ key }))?.success === true;

export async function handleAuthorization(request, env, dependencies) {
  if (!enabled(env) || !env.KEVIN_EMAIL || !env.TALENT_EMAIL ||
      !env.AUTH_SUBMISSION_RATE_LIMITER || !env.AUTH_RECIPIENT_RATE_LIMITER) {
    return json({ ok: false }, 503);
  }
  try {
    const submission = normalizeAuthorization(await readJSON(request), false);
    const clientRateKey = request.headers.get('X-Crown-Point-Client-Key') || '';
    if (!RATE_KEY.test(clientRateKey)) throw new InputError('The submission source could not be verified.', 403);
    const recipientRateKey = await createRecipientRateKey(submission.fields.signerEmail);
    if (!await permitted(env.AUTH_SUBMISSION_RATE_LIMITER, clientRateKey) ||
        !await permitted(env.AUTH_RECIPIENT_RATE_LIMITER, recipientRateKey)) {
      return json({ ok: false, rateLimited: true }, 429);
    }
    const receipt = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const pdf = await createAuthorizationPdf(
      dependencies.pdfLib,
      dependencies.upng,
      dependencies.templateBytes,
      submission,
      receipt,
      timestamp,
    );
    const result = await env.KEVIN_EMAIL.send(buildAuthorizationEmail(submission, receipt, timestamp, pdf));
    if (!result || typeof result.messageId !== 'string' || !result.messageId) {
      throw new Error('No provider acknowledgement');
    }
    try {
      const confirmation = await env.TALENT_EMAIL.send(buildAuthorizationConfirmation(submission, receipt));
      if (!confirmation || typeof confirmation.messageId !== 'string' || !confirmation.messageId) {
        throw new Error('No confirmation acknowledgement');
      }
    } catch {
      console.warn('authorization_confirmation_send_failed');
    }
    return json({ ok: true, receipt });
  } catch (error) {
    if (error instanceof InputError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, uncertain: true }, 502);
  }
}
