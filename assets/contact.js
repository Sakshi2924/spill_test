// Contact form — fetch-based submit with inline status.

(function () {
  'use strict';

  var form = document.getElementById('contactForm');
  if (!form) return;

  var status = document.getElementById('formStatus');
  var submit = form.querySelector('button[type="submit"]');

  function say(msg, kind) {
    status.textContent = msg;
    status.className = 'form-status ' + (kind || '');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    say('', '');
    submit.disabled = true;
    var original = submit.textContent;
    submit.textContent = 'Sending…';
    try {
      var fd = new FormData(form);
      var payload = {
        name:     String(fd.get('name') || '').trim(),
        email:    String(fd.get('email') || '').trim(),
        subject:  String(fd.get('subject') || '').trim(),
        message:  String(fd.get('message') || '').trim(),
        honeypot: String(fd.get('honeypot') || ''),
      };
      if (!payload.name || !payload.email || !payload.subject || payload.message.length < 10) {
        throw new Error('Please fill in every field (message needs at least 10 characters).');
      }
      var res = await fetch('/api/contact', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify(payload),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again in a minute.');
      say("Thanks — we got it. We'll reply within 24 hours.", 'success');
      form.reset();
    } catch (err) {
      say(err.message, 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  });
})();
