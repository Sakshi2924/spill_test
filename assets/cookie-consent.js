// Spill — minimal first-party cookie consent
// No third-party trackers to gate yet — this records the user's choice so we
// can wire up analytics behind it later without asking again.

(function () {
  'use strict';

  var KEY = 'spill.cc.v1';

  function getChoice() {
    try { return localStorage.getItem(KEY); } catch (_) { return null; }
  }

  function setChoice(value) {
    try { localStorage.setItem(KEY, value); } catch (_) {}
    document.documentElement.dataset.consent = value;
    window.dispatchEvent(new CustomEvent('cookieconsent', { detail: { value: value } }));
  }

  // Compute href for the privacy-policy link that works from any depth.
  function privacyHref() {
    // /flavours/*.html → one level deep, so use ../privacy-policy.html
    if (/\/flavors\//.test(location.pathname)) return '../privacy-policy.html';
    return 'privacy-policy.html';
  }

  function render() {
    if (document.getElementById('cc-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'cc-banner';
    banner.className = 'cc-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Cookies');
    banner.innerHTML =
      '<p>We use a single session cookie to keep admins signed in and first-party storage to remember this choice. No trackers. ' +
      '<a href="' + privacyHref() + '">Read the policy</a>.</p>' +
      '<div class="cc-actions">' +
        '<button type="button" class="cc-accept">Accept</button>' +
        '<button type="button" class="cc-reject">Reject non-essential</button>' +
      '</div>';

    banner.querySelector('.cc-accept').addEventListener('click', function () {
      setChoice('accepted'); hide();
    });
    banner.querySelector('.cc-reject').addEventListener('click', function () {
      setChoice('rejected'); hide();
    });

    document.body.appendChild(banner);
    // next frame for transition
    requestAnimationFrame(function () { banner.classList.add('cc-visible'); });

    function hide() {
      banner.classList.remove('cc-visible');
      setTimeout(function () { banner.remove(); }, 450);
    }
  }

  function init() {
    var choice = getChoice();
    if (choice) {
      document.documentElement.dataset.consent = choice;
      return;
    }
    // Wait one tick so the page paints first
    setTimeout(render, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
