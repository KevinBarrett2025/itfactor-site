(() => {
  'use strict';
  const form = document.querySelector('#size-card');
  if (!form) return;
  const photo = document.querySelector('#photo');
  const preview = document.querySelector('#portrait-preview');
  const photoError = document.querySelector('#photo-error');
  const remove = document.querySelector('#remove-photo');
  const error = document.querySelector('#form-error');
  const notice = document.querySelector('#availability-notice');
  const status = document.querySelector('#submission-status');
  const button = form.querySelector('[type="submit"]');
  const age = document.querySelector('#age');
  const guardian = document.querySelector('#guardian');
  const textInputs = [...form.querySelectorAll('input[required]:not([type="checkbox"])')];
  let photoURL, token = '', widget, ready = false, busy = false, sent = false;
  function updateButton() { button.disabled = !ready || !token || busy || sent; }
  function showError(message) { error.textContent = message; error.hidden = false; error.focus(); }
  function validateGuardian() {
    guardian.setCustomValidity(age.value !== '' && Number(age.value) < 18 && !guardian.value.trim()
      ? 'Please enter the name of the parent or legal guardian completing this form.' : '');
  }
  age.addEventListener('input', validateGuardian);
  guardian.addEventListener('input', validateGuardian);
  for (const input of textInputs) input.addEventListener('input', () => input.setCustomValidity(input.value.trim() ? '' : 'Please complete this field.'));

  function updatePhoto() {
    if (photoURL) URL.revokeObjectURL(photoURL);
    photoURL = undefined;
    preview.hidden = true;
    preview.removeAttribute('src');
    photoError.hidden = true;
    photo.setCustomValidity('');
    photo.removeAttribute('aria-invalid');
    const file = photo.files[0];
    remove.hidden = !file;
    if (!file) return;
    let message = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) message = 'Please choose a JPG, PNG, or WebP photo.';
    else if (file.size > 8 * 1024 * 1024) message = 'This photo is over 8 MiB. Please choose a smaller photo.';
    else if (file.size === 0) message = 'This file is empty. Please choose another photo.';
    if (message) {
      photo.setCustomValidity(message); photo.setAttribute('aria-invalid', 'true');
      photoError.textContent = message; photoError.hidden = false; return;
    }
    photoURL = URL.createObjectURL(file); preview.src = photoURL; preview.hidden = false;
  }
  photo.addEventListener('change', updatePhoto);
  remove.addEventListener('click', () => { photo.value = ''; updatePhoto(); photo.focus(); });
  preview.addEventListener('error', () => {
    preview.hidden = true;
    photo.setCustomValidity('This photo could not be opened. Please choose a different JPG, PNG, or WebP.');
    photoError.textContent = photo.validationMessage; photoError.hidden = false;
  });
  async function compressPhoto(file) {
    if (!file) return null;
    const url = URL.createObjectURL(file);
    const picture = new Image();
    try {
      picture.src = url; await picture.decode();
      if (!picture.naturalWidth || !picture.naturalHeight || picture.naturalWidth * picture.naturalHeight > 50000000) {
        throw new Error('Please choose a photo no larger than 50 megapixels.');
      }
      const scale = Math.min(1, 1600 / Math.max(picture.naturalWidth, picture.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not prepare your photo. Please try another browser.');
      // Canvas re-encoding excludes the source filename and EXIF/GPS metadata.
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(picture, 0, 0, canvas.width, canvas.height);
      let blob;
      for (const quality of [0.85, 0.72, 0.58, 0.42]) {
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= 1024 * 1024) break;
      }
      canvas.width = canvas.height = 1;
      if (!blob || blob.size > 1024 * 1024) throw new Error('This photo could not be made small enough. Please choose a smaller photo.');
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error('The photo could not be read.'));
        reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob);
      });
      return { content };
    } finally { URL.revokeObjectURL(url); }
  }
  function resetChallenge() {
    token = ''; updateButton();
    if (window.turnstile && widget !== undefined) window.turnstile.reset(widget);
  }
  async function initialize() {
    try {
      const response = await fetch('/jcp-crown-point/config', { cache: 'no-store', credentials: 'omit' });
      const config = await response.json();
      if (!response.ok || config.enabled !== true || typeof config.sitekey !== 'string') throw new Error('not enabled');
      window.crownPointTurnstileReady = () => {
        widget = window.turnstile.render('#spam-check', {
          // Compact is 150px wide and fits even a 320px phone inside the card.
          sitekey: config.sitekey, action: 'crown_point_submit', theme: 'light', size: 'compact',
          callback: value => { token = value; status.textContent = 'Spam check complete. Ready to send.'; updateButton(); },
          'expired-callback': () => { token = ''; status.textContent = 'Please complete the refreshed spam check.'; updateButton(); },
          'error-callback': () => { token = ''; status.textContent = 'The spam check could not load. Your entries are still here; check your connection or contact Kevin.'; updateButton(); },
        });
        ready = true; notice.hidden = true; updateButton();
      };
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=crownPointTurnstileReady&render=explicit';
      script.async = true; script.defer = true;
      script.onerror = () => { notice.textContent = 'Spam protection could not load. Please check your connection or contact Kevin. Your entries have not been sent.'; };
      document.head.append(script);
    } catch { notice.textContent = 'Submissions are not available yet. Nothing has been sent. You can contact Kevin below for help.'; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || sent) return;
    error.hidden = true; validateGuardian();
    for (const input of textInputs) input.setCustomValidity(input.value.trim() ? '' : 'Please complete this field.');
    if (!form.reportValidity()) return;
    if (!ready || !token) { showError('Please complete the spam check before sending.'); return; }
    busy = true; updateButton(); form.setAttribute('aria-busy', 'true');
    const controls = [...form.querySelectorAll('input, textarea, button')];
    const previouslyDisabled = controls.map(control => control.disabled);
    const fields = {};
    for (const [key, value] of new FormData(form)) {
      if (typeof value === 'string' && key !== 'website' && key !== 'cf-turnstile-response') fields[key] = value;
    }
    const originalFile = photo.files[0], website = document.querySelector('#website').value;
    controls.forEach(control => { control.disabled = true; });
    let requestStarted = false;
    try {
      status.textContent = originalFile ? 'Preparing your photo…' : 'Preparing your card…';
      const attachment = await compressPhoto(originalFile);
      if (!token) throw new Error('The spam check expired while preparing your photo. Please complete it again.');
      status.textContent = 'Sending your card. Please keep this page open…';
      requestStarted = true;
      const response = await fetch(form.action, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, photo: attachment, turnstileToken: token, website }),
        signal: AbortSignal.timeout(45000),
      });
      let result;
      try { result = await response.json(); } catch { throw new Error('unconfirmed'); }
      if (!response.ok || result.ok !== true || !/^[a-f0-9-]{36}$/.test(result.receipt || '')) {
        if (typeof result.error === 'string') { showError(result.error); return; }
        throw new Error('unconfirmed');
      }
      sent = true;
      document.querySelector('#submission-receipt').textContent = `Receipt: ${result.receipt}`;
      form.hidden = true;
      const success = document.querySelector('#success-panel'); success.hidden = false; success.focus();
      form.reset(); updatePhoto();
      if (window.turnstile && widget !== undefined) window.turnstile.remove(widget);
    } catch (problem) {
      showError(requestStarted
        ? 'We could not confirm email acceptance. Your entries are still here. Please contact Kevin before retrying to avoid a duplicate.'
        : problem.message || 'Your photo could not be prepared. Nothing was sent. Please choose another photo.');
    } finally {
      busy = false; form.removeAttribute('aria-busy');
      controls.forEach((control, index) => { control.disabled = previouslyDisabled[index]; });
      if (!sent) { status.textContent = 'Your entries have been preserved. Complete the new spam check before retrying.'; resetChallenge(); }
      updateButton();
    }
  });
  initialize();
})();
