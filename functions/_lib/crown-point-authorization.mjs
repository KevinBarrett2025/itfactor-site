import { FROM, InputError, TO } from './crown-point.mjs';

// Turnstile actions must remain short; this is the fixed server/client action for this form.
export const AUTH_ACTION = 'crown_point_social_auth';
export const AUTH_DOC_ID = 'APPROVED_Positive Influence_Social Media Auth Form_091626-1.docx';
export const AUTH_DOCX_SHA256 = 'dc1fcca54cdd04f9c9296b09850f73a9b1441feba179e0dfc9b4391b18f1aa9a';
export const AUTH_PDF_SHA256 = '5d6fdf9202c5f8cd0ef43c0e4988d00c86f9c56600ffaf4504052a3bd25d6e27';
export const AUTH_SIGNATURE_METHOD = 'drawn_png_canvas_with_electronic_signature_affirmation';
export const AUTH_IDENTITY_LIMITATION = 'This receipt records the electronic submission and signature event associated with the signer-provided email address. It does not constitute independent identity verification.';
export const AUTH_SIGNATURE_LIMIT = 180 * 1024;
export const AUTH_REQUEST_LIMIT = 350 * 1024;
export const AUTH_CLIENT_RATE_LIMIT = 6;
export const AUTH_RECIPIENT_RATE_LIMIT = 2;
export const AUTH_RATE_LIMIT_PERIOD = 60;
export const AUTH_HOSTS = new Set([
  'itfactor.studio',
  'gm-crown-point-positive-influence-auth.itfactor-site.pages.dev',
]);

const EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;
const SINGLE_LINE_CONTROL = /[\x00-\x1f\x7f]/;
const PNG_MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bytesToHex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const escapeHTML = text => text.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const decodeBase64 = content => Uint8Array.from(atob(content), character => character.charCodeAt(0));

function onlyKeys(value, allowed) {
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw new InputError('The authorization contains unexpected fields.');
  }
}

function cleanSingleLine(value, label, limit, required = false) {
  if (typeof value !== 'string' || value.length > limit || SINGLE_LINE_CONTROL.test(value)) {
    throw new InputError(`Please check ${label}.`);
  }
  const cleaned = value.trim();
  if (required && !cleaned) throw new InputError(`Please complete ${label}.`);
  return cleaned;
}

function normalizeEmail(value, label) {
  const cleaned = cleanSingleLine(value, label, 100, true);
  if (!EMAIL.test(cleaned)) throw new InputError(`Please enter a valid ${label}.`);
  const at = cleaned.lastIndexOf('@');
  return `${cleaned.slice(0, at)}@${cleaned.slice(at + 1).toLowerCase()}`;
}

function parseSignature(signature) {
  onlyKeys(signature, ['content']);
  const content = signature.content;
  if (typeof content !== 'string' || content.length > 4 * Math.ceil(AUTH_SIGNATURE_LIMIT / 3) ||
      content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) {
    throw new InputError('Please draw your signature again.');
  }
  let bytes;
  try { bytes = decodeBase64(content); } catch { throw new InputError('Please draw your signature again.'); }
  if (bytes.byteLength > AUTH_SIGNATURE_LIMIT || bytes.length < 33 ||
      PNG_MAGIC.some((byte, index) => bytes[index] !== byte) ||
      String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') {
    throw new InputError('Please draw your signature again.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width < 120 || height < 40 || width > 1200 || height > 400) {
    throw new InputError('Please draw your signature in the signature box.');
  }
  return { content, bytes, width, height };
}

export function checkAuthorizationOrigin(request) {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || !AUTH_HOSTS.has(url.hostname) || url.port ||
      request.headers.get('Origin') !== url.origin) {
    throw new InputError('Please submit using the original authorization page.', 403);
  }
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') throw new InputError('Cross-site submission is not allowed.', 403);
  return url.hostname;
}

export function normalizeAuthorization(payload, requireToken = true) {
  onlyKeys(payload, requireToken ? ['fields', 'signature', 'turnstileToken', 'website'] : ['fields', 'signature']);
  onlyKeys(payload.fields, [
    'applicantName', 'under18', 'signerEmail', 'guardianName',
    'twitterX', 'facebook', 'instagram', 'youtube', 'tiktok', 'linkedin',
    'consentAccepted', 'signatureAffirmed',
  ]);
  if (requireToken && payload.website !== '') throw new InputError('The spam check failed. Please try again.', 403);
  const fields = {
    applicantName: cleanSingleLine(payload.fields.applicantName ?? '', 'applicant name', 100, true),
    under18: payload.fields.under18,
    signerEmail: normalizeEmail(payload.fields.signerEmail ?? '', payload.fields.under18 === true ? 'legal guardian email' : 'applicant email'),
    guardianName: cleanSingleLine(payload.fields.guardianName ?? '', 'legal guardian name', 80),
    twitterX: cleanSingleLine(payload.fields.twitterX ?? '', 'Twitter / X username', 80),
    facebook: cleanSingleLine(payload.fields.facebook ?? '', 'Facebook username', 80),
    instagram: cleanSingleLine(payload.fields.instagram ?? '', 'Instagram username', 80),
    youtube: cleanSingleLine(payload.fields.youtube ?? '', 'YouTube username', 80),
    tiktok: cleanSingleLine(payload.fields.tiktok ?? '', 'TikTok username', 80),
    linkedin: cleanSingleLine(payload.fields.linkedin ?? '', 'LinkedIn username', 80),
    consentAccepted: payload.fields.consentAccepted,
    signatureAffirmed: payload.fields.signatureAffirmed,
  };
  if (typeof fields.under18 !== 'boolean') throw new InputError('Please indicate whether the applicant is under 18.');
  if (fields.under18 && !fields.guardianName) throw new InputError('Please complete legal guardian name.');
  if (!fields.under18 && fields.guardianName) throw new InputError('Legal guardian information is only used when the applicant is under 18.');
  if (fields.consentAccepted !== true) throw new InputError('Please confirm that you read and accept the approved authorization.');
  if (fields.signatureAffirmed !== true) throw new InputError('Please affirm that the drawn signature is your electronic signature.');
  const signature = parseSignature(payload.signature);
  if (requireToken && (typeof payload.turnstileToken !== 'string' || !payload.turnstileToken || payload.turnstileToken.length > 2048)) {
    throw new InputError('Please complete the spam check and try again.', 403);
  }
  return { fields, signature: { content: signature.content } };
}

export async function sha256Hex(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return bytesToHex(await crypto.subtle.digest('SHA-256', view));
}

export function signatureHasInk(upng, signatureContent) {
  try {
    const bytes = decodeBase64(signatureContent);
    const exact = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const decoded = upng.decode(exact);
    const rgba = new Uint8Array(upng.toRGBA8(decoded)[0]);
    let ink = 0;
    for (let index = 0; index < rgba.length; index += 4) {
      if (rgba[index + 3] > 24 && rgba[index] + rgba[index + 1] + rgba[index + 2] < 690 && ++ink >= 40) return true;
    }
    return false;
  } catch { return false; }
}

function fittedSize(font, text, maxWidth, preferred = 10, minimum = 5.5) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.25;
  return size;
}

function drawFitted(page, font, text, options) {
  if (!text) return;
  const size = fittedSize(font, text, options.maxWidth, options.size, options.minimum);
  if (font.widthOfTextAtSize(text, size) > options.maxWidth) throw new InputError(`The ${options.label} is too long to fit the approved form.`);
  page.drawText(text, { x: options.x, y: options.y, size, font, color: options.color });
}

function drawAuditLine(page, font, bold, label, value, y, color) {
  page.drawText(label, { x: 54, y, size: 9.5, font: bold, color });
  const x = 250;
  const size = fittedSize(font, value, 308, 9.5, 5.5);
  page.drawText(value, { x, y, size, font, color });
  page.drawLine({ start: { x: 54, y: y - 8 }, end: { x: 558, y: y - 8 }, thickness: 0.45, color, opacity: 0.22 });
}

function sanitizeFilenamePart(value, fallback) {
  const ascii = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = ascii.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return cleaned || fallback;
}

function filenameNameParts(value, fallback) {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [fallback];
  const first = sanitizeFilenamePart(tokens[0], fallback);
  if (tokens.length === 1) return [first];
  const last = sanitizeFilenamePart(tokens[tokens.length - 1], fallback);
  return [first, last];
}

export function authorizationPdfFilename(submission, timestamp, suffix = '') {
  const date = new Date(timestamp).toISOString().slice(0, 10);
  const parts = ['JCP', 'CrownPoint', 'PositiveInfluenceAuth', ...filenameNameParts(submission.fields.applicantName, 'Applicant')];
  if (submission.fields.under18 && submission.fields.guardianName) {
    parts.push('Guardian', ...filenameNameParts(submission.fields.guardianName, 'Guardian'));
  }
  const safeSuffix = suffix ? sanitizeFilenamePart(suffix, '').slice(0, 12) : '';
  if (safeSuffix) parts.push(safeSuffix);
  return `${parts.join('_')}_${date}.pdf`;
}

export async function createAuthorizationPdf(pdfLib, upng, templateBytes, submission, receipt, timestamp) {
  const template = templateBytes instanceof Uint8Array ? templateBytes : new Uint8Array(templateBytes);
  if (await sha256Hex(template) !== AUTH_PDF_SHA256) throw new Error('Authorization template integrity check failed');
  if (!signatureHasInk(upng, submission.signature.content)) throw new InputError('Please draw your signature in the signature box.');
  const document = await pdfLib.PDFDocument.load(template, { updateMetadata: false });
  if (document.getPageCount() !== 1) throw new Error('Unexpected authorization template');
  const page = document.getPage(0);
  if (Math.round(page.getWidth()) !== 612 || Math.round(page.getHeight()) !== 792) throw new Error('Unexpected authorization page size');
  const font = await document.embedFont(pdfLib.StandardFonts.Helvetica);
  const bold = await document.embedFont(pdfLib.StandardFonts.HelveticaBold);
  const ink = pdfLib.rgb(0.08, 0.08, 0.08);
  const fields = submission.fields;
  drawFitted(page, font, fields.applicantName, { x: 77.5, y: 434, maxWidth: 455, size: 10, minimum: 6, label: 'applicant name', color: ink });
  const handles = [fields.twitterX, fields.facebook, fields.instagram, fields.youtube, fields.tiktok, fields.linkedin];
  [398, 377.5, 357, 336.5, 316, 295.5].forEach((y, index) => drawFitted(page, font, handles[index], {
    x: 130, y, maxWidth: 402, size: 9, minimum: 6, label: 'social media username', color: ink,
  }));
  drawFitted(page, font, fields.guardianName, { x: 77.5, y: 250, maxWidth: 220, size: 8.5, minimum: 5.5, label: 'legal guardian name', color: ink });
  drawFitted(page, font, fields.signerEmail, { x: 311, y: 250, maxWidth: 221, size: 8.5, minimum: 5.5, label: 'signer email', color: ink });
  const signatureBytes = decodeBase64(submission.signature.content);
  const signature = await document.embedPng(signatureBytes);
  const ratio = Math.min(215 / signature.width, 20 / signature.height);
  page.drawImage(signature, { x: 78, y: 214.5, width: signature.width * ratio, height: signature.height * ratio });
  const date = new Date(timestamp).toISOString().slice(0, 10);
  page.drawText(date, { x: 311, y: 218, size: 9, font, color: ink });

  const audit = document.addPage([612, 792]);
  audit.drawText('ELECTRONIC SIGNATURE AUDIT RECEIPT', { x: 54, y: 718, size: 17, font: bold, color: ink });
  audit.drawText('JCP Crown Point Positive Influence Social Media Authorization', { x: 54, y: 692, size: 11, font, color: ink });
  audit.drawText('This receipt records the electronic submission event associated with the approved authorization.', { x: 54, y: 658, size: 9.5, font, color: ink });
  const signerRole = fields.under18 ? 'Legal guardian for an applicant under 18' : 'Applicant age 18 or older';
  const rows = [
    ['Submission ID', receipt],
    ['Submitted UTC', timestamp],
    ['Document identifier', AUTH_DOC_ID],
    ['Approved DOCX SHA-256', AUTH_DOCX_SHA256],
    ['PDF template SHA-256', AUTH_PDF_SHA256],
    ['Signer email', fields.signerEmail],
    ['Signer role', signerRole],
    ['Consent accepted', 'Yes'],
    ['Electronic signature affirmed', 'Yes'],
    ['Signature method', AUTH_SIGNATURE_METHOD],
  ];
  let y = 616;
  for (const [label, value] of rows) { drawAuditLine(audit, font, bold, label, value, y, ink); y -= 38; }
  audit.drawText('No GPS or precise location was requested or recorded by this authorization flow.', { x: 54, y: 202, size: 9, font, color: ink });
  audit.drawText('This receipt records the electronic submission and signature event associated with the signer-provided email address.', { x: 54, y: 184, size: 9, font, color: ink });
  audit.drawText('It does not constitute independent identity verification.', { x: 54, y: 172, size: 9, font, color: ink });
  audit.drawText('Generated by the private iT Factor Crown Point authorization workflow.', { x: 54, y: 90, size: 8.5, font, color: pdfLib.rgb(0.35, 0.35, 0.35) });
  document.setTitle('JCP Crown Point Positive Influence Social Media Authorization');
  document.setAuthor('iT Factor');
  document.setSubject(`Electronic authorization receipt ${receipt}`);
  document.setCreationDate(new Date(timestamp));
  document.setModificationDate(new Date(timestamp));
  return new Uint8Array(await document.save({ useObjectStreams: false }));
}

export function buildAuthorizationEmail(submission, receipt, timestamp, pdfBytes) {
  const role = submission.fields.under18 ? 'Legal guardian' : 'Adult applicant';
  return {
    from: FROM,
    to: TO,
    replyTo: submission.fields.signerEmail,
    subject: `JCP Crown Point — Signed Social Media Authorization — ${submission.fields.applicantName}`,
    text: `Completed Positive Influence Social Media Authorization\n\nSubmission ID: ${receipt}\nSubmitted UTC: ${timestamp}\nApplicant: ${submission.fields.applicantName}\nSigner role: ${role}\nSigner email: ${submission.fields.signerEmail}\nApproved DOCX SHA-256: ${AUTH_DOCX_SHA256}\n\nThe completed authorization and audit receipt are attached as a PDF.`,
    html: `<h1>Completed Positive Influence Social Media Authorization</h1><p>Submission ID: ${escapeHTML(receipt)}<br>Submitted UTC: ${escapeHTML(timestamp)}<br>Applicant: ${escapeHTML(submission.fields.applicantName)}<br>Signer role: ${escapeHTML(role)}<br>Signer email: ${escapeHTML(submission.fields.signerEmail)}<br>Approved DOCX SHA-256: ${AUTH_DOCX_SHA256}</p><p>The completed authorization and audit receipt are attached as a PDF.</p>`,
    attachments: [{
      content: pdfBytes,
      filename: authorizationPdfFilename(submission, timestamp),
      type: 'application/pdf',
      disposition: 'attachment',
    }],
  };
}

export function buildAuthorizationConfirmation(submission, receipt) {
  const text = `Hello,\n\nYour electronic Social Media Background Check Authorization was received successfully.\n\nSubmission ID: ${receipt}\n\nThere is nothing else you need to do right now. If follow-up is needed, someone from the casting team will contact you directly.\n\nWarmly,\n\nKevin Barrett & Dustin Blackburn\nJCPenney Crown Point Casting`;
  return {
    from: FROM,
    to: submission.fields.signerEmail,
    subject: 'We received your JCP Crown Point social media authorization',
    text,
    html: `<p>Hello,</p><p>Your electronic Social Media Background Check Authorization was received successfully.</p><p>Submission ID: ${escapeHTML(receipt)}</p><p>There is nothing else you need to do right now. If follow-up is needed, someone from the casting team will contact you directly.</p><p>Warmly,</p><p>Kevin Barrett &amp; Dustin Blackburn<br>JCPenney Crown Point Casting</p>`,
  };
}
