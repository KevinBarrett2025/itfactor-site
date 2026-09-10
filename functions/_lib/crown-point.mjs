// Shared input policy for the Pages endpoint and its private email Worker.
// No storage, logging, client-selected recipients, or automatic email retries.
export const FROM = 'submissions@forms.itfactor.studio';
export const TO = 'kevin@itfactor.studio';
export const ACTION = 'crown_point_submit';
export const PHOTO_LIMIT = 1024 * 1024;
export const REQUEST_LIMIT = 1500 * 1024;
export const HOSTS = new Set([
  'itfactor.studio',
  'gm-crown-point-size-card.itfactor-site.pages.dev',
  'gm-crown-point-size-card-s77a.itfactor-site.pages.dev',
]);
export const CONSENT = 'I am 18 or older, or the participant’s parent or legal guardian, and I agree to send these details and any photo to Kevin Barrett for the Crown Point Town Takeover.';
export const FIELDS = {
  'Full name': [120, true], Pronouns: [60], Age: [3], Phone: [60, true],
  email: [254, true], City: [100, true], State: [80, true],
  'Occupation / job title': [200], 'Parent / legal guardian': [120],
  'Community connection / story': [3000, false, true],
  'Height (feet)': [1], 'Height (inches)': [2], 'Weight (lb)': [6],
  Shirt: [80], Jacket: [80], 'Pants / waist': [80], Inseam: [80],
  Dress: [80], Shoe: [80], Hat: [80], Notes: [3000, false, true],
  Availability: [3000, false, true], 'Submission consent': [300, true],
};

export class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', ...extra,
  } });
}
export function enabled(env) {
  return env.CROWN_POINT_SEND_ENABLED === 'true';
}
export function checkOrigin(request) {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.port ||
      request.headers.get('Origin') !== url.origin) {
    throw new InputError('Please submit using the original size-card page.', 403);
  }
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') throw new InputError('Cross-site submission is not allowed.', 403);
  return url.hostname;
}
export async function readJSON(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    throw new InputError('Please submit using the size-card form.', 415);
  }
  if (request.headers.get('Content-Encoding')) throw new InputError('Encoded requests are not supported.', 415);
  const length = request.headers.get('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > REQUEST_LIMIT)) {
    throw new InputError('The submission is too large. Please choose a smaller photo.', 413);
  }
  if (!request.body) throw new InputError('The submission is empty.');
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > REQUEST_LIMIT) {
        await reader.cancel();
        throw new InputError('The submission is too large. Please choose a smaller photo.', 413);
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new InputError('The submission could not be read. Please try again.'); }
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function onlyKeys(value, allowed) {
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw new InputError('The submission contains unexpected fields.');
  }
}
function numeric(fields, key, low, high, fraction = false) {
  const value = fields[key];
  if (!value) return;
  if (!(fraction ? /^\d+(?:\.\d)?$/ : /^\d+$/).test(value) || Number(value) < low || Number(value) > high) {
    throw new InputError(`Please check ${key.toLowerCase()}.`);
  }
}
export function jpegDimensions(bytes) {
  if (bytes.length < 20 || bytes[0] !== 255 || bytes[1] !== 216 ||
      bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new InputError('Please choose a valid photo.');
  let offset = 2, dimensions;
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 255) throw new InputError('Please choose a valid photo.');
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda) {
      if (!dimensions) throw new InputError('Please choose a valid photo.');
      return dimensions;
    }
    if (offset + 2 > bytes.length) break;
    const size = bytes[offset] * 256 + bytes[offset + 1];
    if (size < 2 || offset + size > bytes.length - 2) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (size < 8) break;
      dimensions = { height: bytes[offset + 3] * 256 + bytes[offset + 4], width: bytes[offset + 5] * 256 + bytes[offset + 6] };
    }
    offset += size;
  }
  throw new InputError('Please choose a valid photo.');
}
export function normalizeSubmission(payload, requireToken = true) {
  onlyKeys(payload, requireToken ? ['fields', 'photo', 'turnstileToken', 'website'] : ['fields', 'photo']);
  onlyKeys(payload.fields, Object.keys(FIELDS));
  if (requireToken && payload.website !== '') throw new InputError('The spam check failed. Please try again.', 403);
  const fields = {};
  for (const [key, [limit, required, multiline]] of Object.entries(FIELDS)) {
    const raw = payload.fields[key] ?? '';
    if (typeof raw !== 'string' || raw.length > limit ||
        (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(raw)) {
      throw new InputError(`Please check ${key.toLowerCase()}.`);
    }
    fields[key] = raw.trim();
    if (required && !fields[key]) throw new InputError(`Please complete ${key.toLowerCase()}.`);
  }
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(fields.email)) {
    throw new InputError('Please enter a valid email address.');
  }
  numeric(fields, 'Age', 0, 120);
  numeric(fields, 'Height (feet)', 0, 8);
  numeric(fields, 'Height (inches)', 0, 11);
  numeric(fields, 'Weight (lb)', 1, 1500, true);
  if (fields.Age && Number(fields.Age) < 18 && !fields['Parent / legal guardian']) {
    throw new InputError('Please enter the parent or legal guardian’s name.');
  }
  if (fields['Submission consent'] !== CONSENT) throw new InputError('Please confirm the submission consent.');
  let photo = null;
  if (payload.photo != null) {
    onlyKeys(payload.photo, ['content']);
    const b64 = payload.photo.content;
    if (typeof b64 !== 'string' || b64.length > 4 * Math.ceil(PHOTO_LIMIT / 3) ||
        b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
      throw new InputError('The photo must be a compressed JPEG under 1 MiB.', 413);
    }
    let bytes;
    try { bytes = Uint8Array.from(atob(b64), character => character.charCodeAt(0)); }
    catch { throw new InputError('Please choose a valid photo.'); }
    if (bytes.byteLength > PHOTO_LIMIT) throw new InputError('The photo is too large.', 413);
    const { width, height } = jpegDimensions(bytes);
    if (width < 1 || height < 1 || width > 1600 || height > 1600) throw new InputError('Please resize the photo to 1600 pixels or smaller.');
    photo = { content: b64 };
  }
  if (requireToken && (typeof payload.turnstileToken !== 'string' || !payload.turnstileToken || payload.turnstileToken.length > 2048)) {
    throw new InputError('Please complete the spam check and try again.', 403);
  }
  return { fields, photo };
}

export async function verifyTurnstile(token, hostname, secret, fetcher = fetch) {
  let result;
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Siteverify unavailable');
    result = await response.json();
  } catch { throw new InputError('The spam check is unavailable. Your card has not been sent. Please try again shortly.', 503); }
  if (result.success !== true || result.hostname !== hostname || result.action !== ACTION) {
    throw new InputError('The spam check expired or failed. Please complete it again; your card has not been sent.', 403);
  }
}

const escapeHTML = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const decodeBase64 = content => Uint8Array.from(atob(content), character => character.charCodeAt(0));
export function buildEmail(submission, receipt, timestamp) {
  const entries = Object.entries(submission.fields);
  const heading = `Crown Point Town Takeover — talent size card\nReceipt: ${receipt}\nSubmitted: ${timestamp}`;
  return {
    from: FROM, to: TO, replyTo: submission.fields.email,
    subject: `JCP Crown Point — Talent Size Card — ${submission.fields['Full name']}`,
    text: `${heading}\n\n${entries.map(([key, value]) => `${key}:\n${value || '(not provided)'}`).join('\n\n')}\n\nPhoto: ${submission.photo ? 'Attached as talent-photo.jpg' : 'Not provided'}`,
    html: `<h1>Crown Point talent size card</h1><p>Receipt: ${escapeHTML(receipt)}<br>Submitted: ${escapeHTML(timestamp)}</p><table>${entries.map(([key, value]) => `<tr><th style="text-align:left;vertical-align:top;padding:8px">${escapeHTML(key)}</th><td style="padding:8px;white-space:pre-wrap">${escapeHTML(value || '(not provided)')}</td></tr>`).join('')}</table><p>Photo: ${submission.photo ? 'Attached as talent-photo.jpg' : 'Not provided'}</p>`,
    ...(submission.photo ? { attachments: [{ content: decodeBase64(submission.photo.content), filename: 'talent-photo.jpg', type: 'image/jpeg', disposition: 'attachment' }] } : {}),
  };
}
