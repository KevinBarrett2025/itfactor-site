import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import pdfLibDefault from '../cloudflare/crown-point-mailer/node_modules/pdf-lib/cjs/index.js';
import UPNGModule from '../cloudflare/crown-point-mailer/node_modules/@pdf-lib/upng/cjs/UPNG.js';
import {
  AUTH_ACTION,
  AUTH_CLIENT_RATE_LIMIT,
  AUTH_DOCX_SHA256,
  AUTH_PDF_SHA256,
  AUTH_RATE_LIMIT_PERIOD,
  AUTH_RECIPIENT_RATE_LIMIT,
  buildAuthorizationConfirmation,
  buildAuthorizationEmail,
  createAuthorizationPdf,
  normalizeAuthorization,
  sha256Hex,
  signatureHasInk,
} from '../functions/_lib/crown-point-authorization.mjs';
import { onRequest as submit } from '../functions/jcp-crown-point/social-media-authorization/submit.js';
import { onRequest as config } from '../functions/jcp-crown-point/social-media-authorization/config.js';
import { handleAuthorization } from '../cloudflare/crown-point-mailer/authorization-mailer.mjs';

const pdfLib = pdfLibDefault;
const UPNG = UPNGModule.default || UPNGModule;
const host = 'itfactor.studio';
const receipt = '11111111-2222-4333-8444-555555555555';
const templatePath = new URL('../jcp-crown-point/social-media-authorization/approved-authorization.pdf', import.meta.url);
const templateBytes = new Uint8Array(await readFile(templatePath));

function signaturePng(ink = true) {
  const width = 900, height = 220;
  const rgba = new Uint8Array(width * height * 4);
  if (ink) {
    for (let y = 90; y < 108; y++) for (let x = 110; x < 760; x++) {
      const offset = (y * width + x) * 4;
      rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = 20;
      rgba[offset + 3] = 255;
    }
  }
  return Buffer.from(UPNG.encode([rgba.buffer], width, height, 0)).toString('base64');
}

const adultPayload = () => ({
  fields: {
    applicantName: 'Production Test Applicant',
    under18: false,
    signerEmail: 'controlled@example.com',
    guardianName: '',
    twitterX: '@productiontest',
    facebook: '',
    instagram: '@production.test',
    youtube: '',
    tiktok: '',
    linkedin: '',
    consentAccepted: true,
    signatureAffirmed: true,
  },
  signature: { content: signaturePng() },
  turnstileToken: 'test-token',
  website: '',
});
const minorPayload = () => {
  const payload = adultPayload();
  payload.fields.under18 = true;
  payload.fields.guardianName = 'Test Guardian';
  payload.fields.signerEmail = 'guardian@example.com';
  return payload;
};
const normalized = payload => normalizeAuthorization({
  fields: payload.fields,
  signature: payload.signature,
}, false);
const allowLimiter = () => ({ limit: async () => ({ success: true }) });
const dependencies = { pdfLib, upng: UPNG, templateBytes };
const rateKey = 'a'.repeat(64);
const mailerRequest = body => new Request('https://mailer/authorize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Crown-Point-Client-Key': rateKey },
  body: JSON.stringify(body),
});
const mailerEnv = () => ({
  CROWN_POINT_SEND_ENABLED: 'true',
  KEVIN_EMAIL: { send: async () => ({ messageId: 'kevin-message' }) },
  TALENT_EMAIL: { send: async () => ({ messageId: 'signer-message' }) },
  AUTH_SUBMISSION_RATE_LIMITER: allowLimiter(),
  AUTH_RECIPIENT_RATE_LIMITER: allowLimiter(),
});
const request = (body = adultPayload(), options = {}) => new Request(`https://${host}/jcp-crown-point/social-media-authorization/submit`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json', Origin: `https://${host}`,
    'Sec-Fetch-Site': 'same-origin', 'CF-Connecting-IP': '203.0.113.11',
    ...options.headers,
  },
  body: JSON.stringify(body),
});
const pagesEnv = () => ({
  CROWN_POINT_SEND_ENABLED: 'true',
  TURNSTILE_SECRET_KEY: 'local-test-secret',
  TURNSTILE_SITE_KEY: 'test-sitekey',
  CROWN_POINT_MAILER: { fetch: async () => Response.json({ ok: true, receipt }) },
});
async function withVerify(fn, result = { success: true, hostname: host, action: AUTH_ACTION }) {
  const prior = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.deepEqual(JSON.parse(options.body), { secret: 'local-test-secret', response: 'test-token' });
    return Response.json(result);
  };
  try { return await fn(); } finally { globalThis.fetch = prior; }
}

test('approved PDF template is one-page Letter and matches its immutable hash', async () => {
  assert.ok(AUTH_ACTION.length <= 32);
  assert.equal(await sha256Hex(templateBytes), AUTH_PDF_SHA256);
  const document = await pdfLib.PDFDocument.load(templateBytes);
  assert.equal(document.getPageCount(), 1);
  assert.deepEqual(document.getPage(0).getSize(), { width: 612, height: 792 });
  assert.equal(AUTH_DOCX_SHA256, 'dc1fcca54cdd04f9c9296b09850f73a9b1441feba179e0dfc9b4391b18f1aa9a');
});

test('adult and minor signer rules require the correct email, guardian, consent, and affirmation', () => {
  assert.equal(normalized(adultPayload()).fields.signerEmail, 'controlled@example.com');
  assert.equal(normalized(minorPayload()).fields.guardianName, 'Test Guardian');
  for (const mutate of [
    payload => { payload.fields.under18 = true; },
    payload => { payload.fields.consentAccepted = false; },
    payload => { payload.fields.signatureAffirmed = false; },
    payload => { payload.fields.signerEmail = ''; },
  ]) {
    const payload = adultPayload(); mutate(payload); assert.throws(() => normalizeAuthorization(payload));
  }
  const adultWithGuardian = adultPayload(); adultWithGuardian.fields.guardianName = 'Unexpected Guardian';
  assert.throws(() => normalizeAuthorization(adultWithGuardian));
});

test('server rejects malformed email, header injection, unknown routing fields, and malformed signatures', () => {
  for (const email of ['bad', 'a@example.com\r\nBcc:x@example.com', 'Name <a@example.com>', 'a@example.com,b@example.com']) {
    const payload = adultPayload(); payload.fields.signerEmail = email; assert.throws(() => normalizeAuthorization(payload));
  }
  for (const key of ['to', 'from', 'subject', 'replyTo', 'cc', 'bcc', 'headers']) {
    const payload = adultPayload(); payload[key] = 'evil@example.com'; assert.throws(() => normalizeAuthorization(payload));
  }
  for (const content of ['', 'bm90LXBuZw==', 'AAAA']) {
    const payload = adultPayload(); payload.signature.content = content; assert.throws(() => normalizeAuthorization(payload));
  }
});

test('decoded signature must contain visible ink', () => {
  assert.equal(signatureHasInk(UPNG, signaturePng()), true);
  assert.equal(signatureHasInk(UPNG, signaturePng(false)), false);
});

test('completed PDF keeps approved page first, overlays fields, and appends audit receipt', async () => {
  const submission = normalized(minorPayload());
  const completed = await createAuthorizationPdf(pdfLib, UPNG, templateBytes, submission, receipt, '2026-09-16T18:30:00.000Z');
  const document = await pdfLib.PDFDocument.load(completed);
  assert.equal(document.getPageCount(), 2);
  assert.deepEqual(document.getPage(0).getSize(), { width: 612, height: 792 });
  assert.deepEqual(document.getPage(1).getSize(), { width: 612, height: 792 });
  assert.equal(document.getSubject(), `Electronic authorization receipt ${receipt}`);
  await writeFile('/private/tmp/positive-influence-completed-sample.pdf', completed);
});

test('Kevin email has completed PDF; signer confirmation has no PDF, signature, or private fields', async () => {
  const submission = normalized(minorPayload());
  const completed = await createAuthorizationPdf(pdfLib, UPNG, templateBytes, submission, receipt, '2026-09-16T18:30:00.000Z');
  const kevin = buildAuthorizationEmail(submission, receipt, '2026-09-16T18:30:00.000Z', completed);
  assert.equal(kevin.to, 'kevin@itfactor.studio');
  assert.equal(kevin.replyTo, 'guardian@example.com');
  assert.equal(kevin.attachments.length, 1);
  assert.equal(kevin.attachments[0].type, 'application/pdf');
  const signer = buildAuthorizationConfirmation(submission, receipt);
  assert.equal(signer.to, 'guardian@example.com');
  assert.ok(!('attachments' in signer));
  for (const privateValue of ['Test Guardian', '@productiontest', '@production.test', 'Production Test Applicant']) {
    assert.ok(!signer.text.includes(privateValue));
  }
  for (const key of ['replyTo', 'cc', 'bcc', 'headers']) assert.ok(!(key in signer));
});

test('private mailer sends Kevin first, then exactly one signer confirmation', async () => {
  const env = mailerEnv(); const order = [];
  env.KEVIN_EMAIL.send = async email => { order.push(['kevin', email]); return { messageId: 'kevin-message' }; };
  env.TALENT_EMAIL.send = async email => { order.push(['signer', email]); return { messageId: 'signer-message' }; };
  const response = await handleAuthorization(mailerRequest(normalized(adultPayload())), env, dependencies);
  assert.equal(response.status, 200);
  assert.deepEqual(order.map(entry => entry[0]), ['kevin', 'signer']);
  assert.equal(order[0][1].attachments.length, 1);
  assert.ok(!('attachments' in order[1][1]));
});

test('Kevin success remains authoritative when signer confirmation fails without PII logs', async () => {
  const env = mailerEnv(); let attempts = 0;
  env.TALENT_EMAIL.send = async () => { attempts++; throw new Error('controlled@example.com provider failure'); };
  const prior = console.warn, logs = []; console.warn = (...values) => logs.push(values.join(' '));
  try {
    const response = await handleAuthorization(mailerRequest(normalized(adultPayload())), env, dependencies);
    assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  } finally { console.warn = prior; }
  assert.equal(attempts, 1);
  assert.deepEqual(logs, ['authorization_confirmation_send_failed']);
  assert.ok(!logs.join(' ').includes('controlled@example.com'));
});

test('authorization source and recipient rate limits block all email sends', async () => {
  for (const blocked of ['source', 'recipient']) {
    const env = mailerEnv(); let sends = 0;
    env.KEVIN_EMAIL.send = env.TALENT_EMAIL.send = async () => { sends++; return { messageId: 'message' }; };
    env.AUTH_SUBMISSION_RATE_LIMITER.limit = async () => ({ success: blocked !== 'source' });
    env.AUTH_RECIPIENT_RATE_LIMITER.limit = async ({ key }) => { assert.match(key, /^[a-f0-9]{64}$/); return { success: blocked !== 'recipient' }; };
    const response = await handleAuthorization(mailerRequest(normalized(adultPayload())), env, dependencies);
    assert.equal(response.status, 429); assert.equal(sends, 0);
  }
});

test('public endpoint validates input before Turnstile and forwards only normalized data', async () => {
  await withVerify(async () => {
    const env = pagesEnv(); let calls = 0;
    env.CROWN_POINT_MAILER.fetch = async workerRequest => {
      calls++; assert.equal(workerRequest.url, 'https://crown-point-mailer.internal/authorize');
      assert.match(workerRequest.headers.get('X-Crown-Point-Client-Key'), /^[a-f0-9]{64}$/);
      assert.deepEqual(Object.keys(await workerRequest.json()), ['fields', 'signature']);
      return Response.json({ ok: true, receipt });
    };
    const response = await submit({ request: request(), env });
    assert.equal(response.status, 200); assert.equal(calls, 1);
    assert.deepEqual(await response.json(), { ok: true, receipt });
  });
});

test('Turnstile uses the authorization action and foreign origins fail closed', async () => {
  await withVerify(async () => assert.equal((await submit({ request: request(), env: pagesEnv() })).status, 200));
  await withVerify(async () => assert.equal((await submit({ request: request(), env: pagesEnv() })).status, 403), { success: true, hostname: host, action: 'crown_point_submit' });
  const foreign = request(adultPayload(), { headers: { Origin: 'https://evil.example' } });
  assert.equal((await submit({ request: foreign, env: pagesEnv() })).status, 403);
});

test('public config is secret-free and disabled without complete bindings', async () => {
  let response = config({ request: new Request(`https://${host}/jcp-crown-point/social-media-authorization/config`), env: pagesEnv() });
  assert.deepEqual(await response.json(), { enabled: true, sitekey: 'test-sitekey' });
  response = config({ request: new Request(`https://${host}/jcp-crown-point/social-media-authorization/config`), env: {} });
  assert.deepEqual(await response.json(), { enabled: false });
});

test('Cloudflare config keeps existing mail bindings and adds isolated exact rate limits', async () => {
  const worker = JSON.parse(await readFile(new URL('../cloudflare/crown-point-mailer/wrangler.jsonc', import.meta.url), 'utf8'));
  const kevin = worker.send_email.find(binding => binding.name === 'KEVIN_EMAIL');
  const talent = worker.send_email.find(binding => binding.name === 'TALENT_EMAIL');
  assert.equal(kevin.destination_address, 'kevin@itfactor.studio');
  assert.deepEqual(talent.allowed_sender_addresses, ['submissions@forms.itfactor.studio']);
  const authLimits = worker.ratelimits.filter(item => item.name.startsWith('AUTH_'));
  assert.deepEqual(authLimits.map(item => item.simple), [
    { limit: AUTH_CLIENT_RATE_LIMIT, period: AUTH_RATE_LIMIT_PERIOD },
    { limit: AUTH_RECIPIENT_RATE_LIMIT, period: AUTH_RATE_LIMIT_PERIOD },
  ]);
  assert.equal(worker.workers_dev, false); assert.equal(worker.preview_urls, false); assert.equal(worker.observability.enabled, false);
});

test('static page is private-by-design, exact-document linked, accessible without analytics, and has no browser persistence', async () => {
  const html = await readFile(new URL('../jcp-crown-point/social-media-authorization/index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../jcp-crown-point/social-media-authorization/form.js', import.meta.url), 'utf8');
  for (const text of ['SOCIAL MEDIA BACKGROUND CHECK AUTHORIZATION', 'If applicant is younger than 18 years old', 'electronically signed']) {
    assert.match(html.toUpperCase(), new RegExp(text.toUpperCase()));
  }
  assert.match(html, /approved-authorization\.pdf/);
  assert.match(html, /<canvas[^>]+aria-label="Signature drawing area"/);
  assert.match(html, /<noscript>/);
  assert.ok(!/googletagmanager|gtag\(|formsubmit/i.test(html));
  assert.ok(!/localStorage|sessionStorage|indexedDB|console\./i.test(js));
  assert.match(js, /toDataURL\('image\/png'\)/);
});

test('browser Turnstile action matches the server action and stays within the platform limit', async () => {
  const js = await readFile(new URL('../jcp-crown-point/social-media-authorization/form.js', import.meta.url), 'utf8');
  assert.match(js, new RegExp(`action: '${AUTH_ACTION}'`));
  assert.ok(AUTH_ACTION.length <= 32);
});
