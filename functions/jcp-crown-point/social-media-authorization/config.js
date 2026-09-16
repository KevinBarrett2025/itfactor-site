import { enabled, json } from '../../_lib/crown-point.mjs';

export function onRequestGet({ env }) {
  const available = enabled(env) && typeof env.TURNSTILE_SITE_KEY === 'string' &&
    env.TURNSTILE_SITE_KEY.length > 0 && Boolean(env.TURNSTILE_SECRET_KEY) && Boolean(env.CROWN_POINT_MAILER);
  return json(available ? { enabled: true, sitekey: env.TURNSTILE_SITE_KEY } : { enabled: false });
}

export function onRequest({ request, env }) {
  if (request.method !== 'GET') return json({ enabled: false }, 405, { Allow: 'GET' });
  return onRequestGet({ env });
}
