import { enabled, HOSTS, json } from '../_lib/crown-point.mjs';

export function onRequest({ request, env }) {
  if (request.method !== 'GET') return json({ ok: false }, 405, { Allow: 'GET' });
  const host = new URL(request.url).hostname;
  const ready = HOSTS.has(host) && enabled(env) && Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY && env.CROWN_POINT_MAILER);
  return json({ enabled: ready, ...(ready ? { sitekey: env.TURNSTILE_SITE_KEY } : {}) });
}
