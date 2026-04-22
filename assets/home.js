// Spill — landing page motion + interactions
// Safe under strict CSP: no inline event handlers, no eval, no new Function.

(function () {
  'use strict';

  // Page loader
  window.addEventListener('load', function () {
    setTimeout(function () {
      var loader = document.getElementById('pageLoader');
      if (loader) loader.classList.add('done');
      if (window.gsap) animateHero();
    }, 600);
  });

  // Cursor dot
  var cursorDot = document.getElementById('cursorDot');
  var mx = 0, my = 0;
  document.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });
  (function tick() {
    if (cursorDot) cursorDot.style.transform = 'translate(' + (mx - 7) + 'px,' + (my - 7) + 'px)';
    requestAnimationFrame(tick);
  })();

  // Floating shapes
  var shapesContainer = document.getElementById('floatingShapes');
  var colors = ['#ffca26', '#f86015', '#d42518', '#19532b', '#9abc04'];
  if (shapesContainer) {
    for (var i = 0; i < 8; i++) {
      var s = document.createElement('div');
      s.className = 'shape';
      var size = Math.random() * 300 + 100;
      s.style.cssText = 'width:' + size + 'px;height:' + size + 'px;background:' +
        colors[Math.floor(Math.random() * colors.length)] + ';left:' +
        (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%';
      shapesContainer.appendChild(s);
    }
  }
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    document.querySelectorAll('.shape').forEach(function (s, i) {
      s.style.transform = 'translateY(' + (y * ((i % 3 + 1) * 0.03)) + 'px)';
    });
  }, { passive: true });

  // Hamburger
  var hamburger = document.getElementById('hamburger');
  var mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('active', open);
      hamburger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('[data-close]').forEach(function (a) {
      a.addEventListener('click', function () {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  // Hero mouse tilt (hover devices only)
  if (matchMedia('(hover: hover)').matches) {
    var heroLogo = document.getElementById('heroLogo');
    var hero = document.querySelector('.hero');
    if (heroLogo && hero) {
      hero.addEventListener('mousemove', function (e) {
        var r = heroLogo.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / 30;
        var dy = (e.clientY - (r.top + r.height / 2)) / 30;
        heroLogo.style.transform = 'perspective(600px) rotateY(' + dx + 'deg) rotateX(' + (-dy) + 'deg)';
      });
      hero.addEventListener('mouseleave', function () {
        heroLogo.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg)';
      });
    }
  }

  function animateHero() {
    if (!window.gsap) return;
    gsap.fromTo('#heroLogo',
      { opacity: 0, scale: 0.85 },
      { opacity: 1, scale: 1, duration: 1, ease: 'back.out(1.7)', delay: 0.2 });
    gsap.to('#heroTagline', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.6 });
  }

  // ScrollTrigger wiring after libs load
  window.addEventListener('load', function () {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    gsap.to('.hero-bg-text.top',    { scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 }, x: 200 });
    gsap.to('.hero-bg-text.bottom', { scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 }, x: -200 });

    gsap.utils.toArray('.title-word').forEach(function (word) {
      gsap.to(word, {
        scrollTrigger: { trigger: word, start: 'top 85%', end: 'top 60%', scrub: 1 },
        opacity: 1, y: 0, rotation: 0, ease: 'power3.out'
      });
    });

    gsap.utils.toArray('.brew-card').forEach(function (card, i) {
      var rot = [-3, 2, -2][i % 3];
      gsap.to(card, {
        scrollTrigger: { trigger: card, start: 'top 85%', end: 'top 55%', scrub: 1 },
        opacity: 1, y: 0, rotation: rot, ease: 'power2.out'
      });
    });

    gsap.utils.toArray('.statement-line').forEach(function (line) {
      gsap.to(line, {
        scrollTrigger: { trigger: line, start: 'top 85%', end: 'top 55%', scrub: 1 },
        opacity: 1, x: 0, ease: 'power3.out'
      });
    });

    gsap.to('#ctaBig', { scrollTrigger: { trigger: '.cta-section', start: 'top 70%', end: 'top 30%', scrub: 1 }, opacity: 1, scale: 1, ease: 'power3.out' });
    gsap.to('#ctaSub', { scrollTrigger: { trigger: '.cta-section', start: 'top 60%', end: 'top 30%', scrub: 1 }, opacity: 1 });
    gsap.to('#ctaBtn', { scrollTrigger: { trigger: '.cta-section', start: 'top 50%', end: 'top 25%', scrub: 1 }, opacity: 1 });

    // Horizontal pinned flavors scroll — desktop only.
    // Pin the .flavors-sticky element; GSAP's pinSpacing adds the scroll
    // distance automatically so the section ends as soon as the last card
    // reaches the left edge.
    var mm = matchMedia('(min-width: 901px)');
    var flavorScroll;

    function buildFlavorScroll() {
      var track = document.getElementById('flavorsTrack');
      var pinTarget = document.querySelector('.flavors-sticky');
      if (!track || !pinTarget) return;
      var overflow = Math.max(0, track.scrollWidth - window.innerWidth);
      if (overflow === 0) return;
      flavorScroll = gsap.to(track, {
        x: -overflow,
        ease: 'none',
        scrollTrigger: {
          trigger: pinTarget,
          start: 'top top',
          end: '+=' + overflow,
          scrub: 0.5,
          pin: pinTarget,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        }
      });
    }

    function destroyFlavorScroll() {
      if (flavorScroll) {
        if (flavorScroll.scrollTrigger) flavorScroll.scrollTrigger.kill();
        flavorScroll.kill();
        flavorScroll = null;
      }
      var track = document.getElementById('flavorsTrack');
      if (track) gsap.set(track, { clearProps: 'transform' });
    }

    function apply() {
      destroyFlavorScroll();
      if (mm.matches) buildFlavorScroll();
      ScrollTrigger.refresh();
    }

    apply();
    mm.addEventListener('change', apply);
    window.addEventListener('resize', function () { ScrollTrigger.refresh(); }, { passive: true });
  });
})();
