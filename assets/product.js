// Product page — gallery, size toggle, qty stepper

(function () {
  'use strict';

  // Gallery thumbnail switching
  const thumbs = document.querySelectorAll('.thumb');
  const mainImg = document.getElementById('mainImg');
  thumbs.forEach(t => {
    t.addEventListener('click', () => {
      const src = t.getAttribute('data-img');
      if (!src || !mainImg) return;
      mainImg.style.opacity = '0';
      const preloader = new Image();
      preloader.onload = () => {
        mainImg.src = src;
        requestAnimationFrame(() => { mainImg.style.opacity = '1'; });
      };
      preloader.src = src;
      thumbs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
    });
  });

  // Size toggle
  const sizeOpts = document.querySelectorAll('.size-opt');
  sizeOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      sizeOpts.forEach(o => o.setAttribute('aria-pressed', 'false'));
      opt.setAttribute('aria-pressed', 'true');
    });
  });

  // Quantity stepper
  const qtyVal = document.getElementById('qtyVal');
  const qtyBtns = document.querySelectorAll('.qty-btn');
  let qty = 1;
  qtyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.getAttribute('data-qty'), 10) || 0;
      qty = Math.max(1, Math.min(99, qty + delta));
      if (qtyVal) qtyVal.textContent = qty;
    });
  });
})();
