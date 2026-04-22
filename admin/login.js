'use strict';

(function () {
  var sub       = document.getElementById('sub');
  var stepCreds = document.getElementById('stepCreds');
  var step2fa   = document.getElementById('step2fa');
  var err1      = document.getElementById('err1');
  var err2      = document.getElementById('err2');

  function show(step) {
    [stepCreds, step2fa].forEach(function (s) { s.classList.remove('active'); });
    step.classList.add('active');
    var firstInput = step.querySelector('input');
    if (firstInput) firstInput.focus();
  }

  stepCreds.addEventListener('submit', async function (e) {
    e.preventDefault();
    err1.classList.remove('show');
    var btn = stepCreds.querySelector('button');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      var res = await fetch('/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({
          username: document.getElementById('u').value,
          password: document.getElementById('p').value,
        }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Login failed');
      if (data.need2fa) {
        sub.textContent = 'One more step — enter your code.';
        show(step2fa);
      } else {
        location.href = '/admin';
      }
    } catch (ex) {
      err1.textContent = ex.message;
      err1.classList.add('show');
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });

  step2fa.addEventListener('submit', async function (e) {
    e.preventDefault();
    err2.classList.remove('show');
    var btn = step2fa.querySelector('button');
    btn.disabled = true; btn.textContent = 'Verifying…';
    try {
      var res = await fetch('/admin/verify-2fa', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ code: document.getElementById('code').value.trim() }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      location.href = '/admin';
    } catch (ex) {
      err2.textContent = ex.message;
      err2.classList.add('show');
    } finally {
      btn.disabled = false; btn.textContent = 'Verify';
    }
  });

  document.getElementById('restart').addEventListener('click', function (e) {
    e.preventDefault();
    sub.textContent = 'Sign in to manage content.';
    document.getElementById('code').value = '';
    show(stepCreds);
  });
})();
