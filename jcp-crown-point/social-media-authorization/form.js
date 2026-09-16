(() => {
  'use strict';
  const form = document.querySelector('#authorization-form');
  if (!form) return;
  const under18 = document.querySelector('#under-18');
  const guardianField = document.querySelector('#guardian-field');
  const guardianName = document.querySelector('#guardian-name');
  const signerEmailLabel = document.querySelector('#signer-email-label');
  const signerEmailHelp = document.querySelector('#signer-email-help');
  const canvas = document.querySelector('#signature-pad');
  const context = canvas.getContext('2d');
  const clearSignature = document.querySelector('#clear-signature');
  const signatureError = document.querySelector('#signature-error');
  const error = document.querySelector('#form-error');
  const notice = document.querySelector('#availability-notice');
  const status = document.querySelector('#submission-status');
  const button = form.querySelector('[type="submit"]');
  let token = '', widget, ready = false, busy = false, sent = false, drawing = false, signatureDirty = false;

  function updateButton() { button.disabled = !ready || !token || busy || sent; }
  function showError(message) { error.textContent = message; error.hidden = false; error.focus(); }
  function updateSigner() {
    const minor = under18.value === 'yes';
    guardianField.hidden = !minor;
    guardianName.required = minor;
    if (!minor) { guardianName.value = ''; guardianName.setCustomValidity(''); }
    signerEmailLabel.textContent = minor ? 'Legal guardian email' : 'Applicant email';
    signerEmailHelp.textContent = minor
      ? 'The legal guardian must use the guardian’s own email address.'
      : 'The confirmation will be sent to this address.';
  }
  under18.addEventListener('change', updateSigner);
  updateSigner();

  if (!context) {
    notice.textContent = 'This browser cannot create an electronic signature. Nothing has been sent.';
    return;
  }
  context.lineWidth = 6;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#171717';
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  canvas.addEventListener('pointerdown', event => {
    drawing = true; signatureDirty = true; signatureError.hidden = true;
    canvas.setPointerCapture(event.pointerId);
    const start = point(event); context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(start.x + .1, start.y + .1); context.stroke();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drawing) return;
    const next = point(event); context.lineTo(next.x, next.y); context.stroke();
  });
  const stopDrawing = () => { drawing = false; };
  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);
  clearSignature.addEventListener('click', () => {
    context.clearRect(0, 0, canvas.width, canvas.height); signatureDirty = false; signatureError.hidden = true; canvas.focus();
  });

  function resetChallenge() {
    token = ''; updateButton();
    if (window.turnstile && widget !== undefined) window.turnstile.reset(widget);
  }
  async function initialize() {
    try {
      const response = await fetch('/jcp-crown-point/social-media-authorization/config', { cache: 'no-store', credentials: 'omit' });
      const config = await response.json();
      if (!response.ok || config.enabled !== true || typeof config.sitekey !== 'string') throw new Error('not enabled');
      window.crownPointAuthorizationTurnstileReady = () => {
        widget = window.turnstile.render('#spam-check', {
          sitekey: config.sitekey,
          action: 'crown_point_social_auth',
          theme: 'light',
          size: 'compact',
          callback: value => { token = value; status.textContent = 'Spam check complete. Ready to sign and submit.'; updateButton(); },
          'expired-callback': () => { token = ''; status.textContent = 'Please complete the refreshed spam check.'; updateButton(); },
          'error-callback': () => { token = ''; status.textContent = 'The spam check could not load. Your entries are still here; check your connection or contact Kevin.'; updateButton(); },
        });
        ready = true; notice.hidden = true; updateButton();
      };
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=crownPointAuthorizationTurnstileReady&render=explicit';
      script.async = true; script.defer = true;
      script.onerror = () => { notice.textContent = 'Spam protection could not load. Nothing has been sent.'; };
      document.head.append(script);
    } catch { notice.textContent = 'Authorizations are not available yet. Nothing has been sent.'; }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || sent) return;
    error.hidden = true; signatureError.hidden = true; updateSigner();
    if (!form.reportValidity()) return;
    if (!signatureDirty) { signatureError.hidden = false; canvas.focus(); return; }
    if (!ready || !token) { showError('Please complete the spam check before submitting.'); return; }
    const controls = [...form.querySelectorAll('input, select, button')];
    const previouslyDisabled = controls.map(control => control.disabled);
    const fields = {
      applicantName: document.querySelector('#applicant-name').value,
      under18: under18.value === 'yes',
      signerEmail: document.querySelector('#signer-email').value,
      guardianName: guardianName.value,
      twitterX: document.querySelector('#twitter-x').value,
      facebook: document.querySelector('#facebook').value,
      instagram: document.querySelector('#instagram').value,
      youtube: document.querySelector('#youtube').value,
      tiktok: document.querySelector('#tiktok').value,
      linkedin: document.querySelector('#linkedin').value,
      consentAccepted: document.querySelector('#consent-accepted').checked,
      signatureAffirmed: document.querySelector('#signature-affirmed').checked,
    };
    const signature = { content: canvas.toDataURL('image/png').split(',')[1] };
    const website = document.querySelector('#website').value;
    busy = true; updateButton(); form.setAttribute('aria-busy', 'true'); controls.forEach(control => { control.disabled = true; });
    let requestStarted = false;
    try {
      status.textContent = 'Generating and sending the signed authorization. Please keep this page open…';
      requestStarted = true;
      const response = await fetch(form.action, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, signature, turnstileToken: token, website }),
        signal: AbortSignal.timeout(45000),
      });
      let result;
      try { result = await response.json(); } catch { throw new Error('unconfirmed'); }
      if (!response.ok || result.ok !== true || !/^[a-f0-9-]{36}$/.test(result.receipt || '')) {
        if (typeof result.error === 'string') { showError(result.error); return; }
        throw new Error('unconfirmed');
      }
      sent = true;
      document.querySelector('#submission-receipt').textContent = `Submission ID: ${result.receipt}`;
      form.hidden = true;
      const success = document.querySelector('#success-panel'); success.hidden = false; success.focus();
      form.reset(); context.clearRect(0, 0, canvas.width, canvas.height);
      if (window.turnstile && widget !== undefined) window.turnstile.remove(widget);
    } catch {
      showError(requestStarted
        ? 'We could not confirm email acceptance. Your entries and signature are still here. Please contact Kevin before retrying to avoid a duplicate.'
        : 'The signed authorization could not be prepared. Nothing was sent.');
    } finally {
      busy = false; form.removeAttribute('aria-busy');
      controls.forEach((control, index) => { control.disabled = previouslyDisabled[index]; });
      if (!sent) { status.textContent = 'Your entries and signature have been preserved. Complete the new spam check before retrying.'; resetChallenge(); }
      updateButton();
    }
  });
  initialize();
})();
