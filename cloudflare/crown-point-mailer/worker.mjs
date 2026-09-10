import { buildEmail, enabled, InputError, json, normalizeSubmission, readJSON } from '../../functions/_lib/crown-point.mjs';

export default {
  async fetch(request, env) {
    // This Worker has neither a public route nor workers.dev/preview URLs.
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/send') return json({ ok: false }, 404);
    if (!enabled(env) || !env.EMAIL) return json({ ok: false }, 503);
    try {
      const submission = normalizeSubmission(await readJSON(request), false);
      const receipt = crypto.randomUUID();
      const result = await env.EMAIL.send(buildEmail(submission, receipt, new Date().toISOString()));
      if (!result || typeof result.messageId !== 'string' || !result.messageId) throw new Error('No provider acknowledgement');
      return json({ ok: true, receipt });
    } catch (error) {
      if (error instanceof InputError) return json({ ok: false, error: error.message }, error.status);
      return json({ ok: false, uncertain: true }, 502);
    }
  },
};
