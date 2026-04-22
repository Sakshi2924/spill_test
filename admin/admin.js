'use strict';

const API = '/admin/api';
const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' };
const OPTS = { credentials: 'same-origin' };

function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2500);
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, { ...OPTS, headers: H, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

// --- TABS ---
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
  });
});

// --- LOGOUT ---
document.getElementById('logout').addEventListener('click', async () => {
  try {
    await fetch('/admin/logout', { method: 'POST', credentials: 'same-origin', headers: H });
  } catch {}
  location.href = '/admin/login';
});

// --- FLAVORS PANEL ---
async function renderFlavors(data) {
  const panel = document.getElementById('panel-flavors');
  if (!data.flavors?.length) { panel.innerHTML = '<div class="empty">No flavors.</div>'; return; }
  panel.innerHTML = data.flavors.map(f => `
    <div class="card" data-slug="${escape(f.slug)}">
      <h2>${escape(f.name)}</h2>
      <div class="slug">${escape(f.slug)}</div>
      <div class="grid-2">
        <div><label>Name</label><input type="text" data-field="name" value="${escape(f.name)}" maxlength="100"></div>
        <div><label>Tagline</label><input type="text" data-field="tagline" value="${escape(f.tagline)}" maxlength="200"></div>
      </div>
      <div class="grid-3">
        <div><label>Price (₹)</label><input type="number" data-field="price" value="${Number(f.price)||0}" min="0" max="999999"></div>
        <div><label>Theme</label><input type="color" data-field="theme" value="${escape(f.theme || '#d42518')}"></div>
        <div><label>&nbsp;</label><label class="switch"><input type="checkbox" data-field="published" ${f.published?'checked':''}> Published</label></div>
      </div>
      <label>Short description</label>
      <textarea data-field="short" maxlength="600">${escape(f.short || '')}</textarea>

      <label>Images (${(f.images||[]).length})</label>
      <div class="images" data-images></div>
      <div class="upload-zone" data-upload>Click or drop an image to add.</div>
      <input type="file" data-filepick accept="image/*" hidden>

      <div class="row-actions">
        <button class="btn" data-save>Save</button>
      </div>
    </div>
  `).join('');

  panel.querySelectorAll('[data-slug]').forEach(card => wireFlavorCard(card, data));
}

function wireFlavorCard(card, data) {
  const slug = card.dataset.slug;
  const flavor = data.flavors.find(f => f.slug === slug);
  let images = [...(flavor.images || [])];

  function redrawImages() {
    const box = card.querySelector('[data-images]');
    box.innerHTML = images.map((src, i) => `
      <div class="img-chip" data-idx="${i}">
        <img src="${escape(src)}" alt="">
        <button class="rm" data-rm="${i}" aria-label="Remove">×</button>
      </div>
    `).join('');
    box.querySelectorAll('[data-rm]').forEach(b => {
      b.addEventListener('click', () => {
        images.splice(Number(b.dataset.rm), 1);
        redrawImages();
      });
    });
  }
  redrawImages();

  const zone = card.querySelector('[data-upload]');
  const picker = card.querySelector('[data-filepick]');
  zone.addEventListener('click', () => picker.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', async e => {
    e.preventDefault(); zone.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (file) await uploadInto(file);
  });
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    if (file) await uploadInto(file);
    picker.value = '';
  });

  async function uploadInto(file) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(API + '/upload', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch' }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      images.push(data.url);
      redrawImages();
      toast('Uploaded');
    } catch (e) { toast(e.message, true); }
  }

  card.querySelector('[data-save]').addEventListener('click', async (ev) => {
    ev.target.disabled = true;
    try {
      const patch = { images };
      card.querySelectorAll('[data-field]').forEach(el => {
        const k = el.dataset.field;
        if (el.type === 'checkbox') patch[k] = el.checked;
        else if (el.type === 'number') patch[k] = Number(el.value);
        else patch[k] = el.value;
      });
      await api('/flavours/' + encodeURIComponent(slug), { method: 'PUT', body: JSON.stringify(patch) });
      toast('Saved');
    } catch (e) { toast(e.message, true); }
    finally { ev.target.disabled = false; }
  });
}

// --- PAGES PANEL ---
async function renderPages(data) {
  const panel = document.getElementById('panel-pages');
  const entries = Object.entries(data.pages || {});
  if (!entries.length) { panel.innerHTML = '<div class="empty">No pages.</div>'; return; }
  panel.innerHTML = entries.map(([id, p]) => `
    <div class="card" data-page="${escape(id)}">
      <h2>${escape(p.title || id)}</h2>
      <div class="slug">${escape(id)}</div>
      <label>Title</label>
      <input type="text" data-field="title" value="${escape(p.title || '')}" maxlength="200">
      <label>Body</label>
      <textarea data-field="body" maxlength="20000" style="min-height:160px;">${escape(p.body || '')}</textarea>
      <div class="row-actions"><button class="btn" data-save>Save</button></div>
    </div>
  `).join('');

  panel.querySelectorAll('[data-page]').forEach(card => {
    card.querySelector('[data-save]').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      try {
        const patch = {
          title: card.querySelector('[data-field=title]').value,
          body:  card.querySelector('[data-field=body]').value,
        };
        await api('/pages/' + encodeURIComponent(card.dataset.page), { method: 'PUT', body: JSON.stringify(patch) });
        toast('Saved');
      } catch (e) { toast(e.message, true); }
      finally { ev.target.disabled = false; }
    });
  });
}

// --- MEDIA PANEL ---
(function wireMedia() {
  const zone = document.getElementById('zone');
  const picker = document.getElementById('mediaFile');
  const recent = document.getElementById('recent');
  const history = [];

  function renderRecent() {
    recent.innerHTML = history.map(url => `
      <div class="img-chip" title="${escape(url)}">
        <img src="${escape(url)}" alt="">
      </div>
    `).join('');
  }

  zone.addEventListener('click', () => picker.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', async e => {
    e.preventDefault(); zone.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (file) await doUpload(file);
  });
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    if (file) await doUpload(file);
    picker.value = '';
  });

  async function doUpload(file) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(API + '/upload', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch' }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      history.unshift(data.url);
      renderRecent();
      toast('Uploaded: ' + data.url);
    } catch (e) { toast(e.message, true); }
  }
})();

// --- SECURITY / 2FA PANEL ---
async function renderSecurity(me) {
  const status = document.getElementById('twofaStatus');
  const enabledBox = document.getElementById('twofaEnabled');
  const disabledBox = document.getElementById('twofaDisabled');
  const enrollBox = document.getElementById('twofaEnroll');

  function set(state) {
    enabledBox.style.display = state === 'enabled' ? '' : 'none';
    disabledBox.style.display = state === 'disabled' ? '' : 'none';
    enrollBox.style.display = state === 'enrolling' ? '' : 'none';
    status.textContent = state === 'enabled'
      ? 'You are protected by an authenticator app.'
      : 'Add a second factor to harden your account.';
  }
  set(me.user.has2fa ? 'enabled' : 'disabled');

  document.getElementById('enroll2fa').addEventListener('click', async () => {
    try {
      const d = await api('/2fa/enroll-start', { method: 'POST' });
      document.getElementById('enrollSecret').textContent = d.secret;
      document.getElementById('enrollUri').textContent = d.uri;
      set('enrolling');
    } catch (e) { toast(e.message, true); }
  });

  document.getElementById('cancel2fa').addEventListener('click', () => {
    document.getElementById('enrollCode').value = '';
    set('disabled');
  });

  document.getElementById('confirm2fa').addEventListener('click', async (ev) => {
    const code = document.getElementById('enrollCode').value.trim();
    ev.target.disabled = true;
    try {
      await api('/2fa/enroll-confirm', { method: 'POST', body: JSON.stringify({ code }) });
      toast('2FA enabled');
      set('enabled');
      document.getElementById('enrollCode').value = '';
    } catch (e) { toast(e.message, true); }
    finally { ev.target.disabled = false; }
  });

  document.getElementById('disable2fa').addEventListener('click', async (ev) => {
    const code = document.getElementById('disableCode').value.trim();
    ev.target.disabled = true;
    try {
      await api('/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) });
      toast('2FA disabled');
      set('disabled');
      document.getElementById('disableCode').value = '';
    } catch (e) { toast(e.message, true); }
    finally { ev.target.disabled = false; }
  });
}

// --- INIT ---
(async function init() {
  try {
    const me = await api('/me');
    document.getElementById('me').textContent = me.user?.username || 'admin';
    const content = await api('/content');
    await renderFlavors(content);
    await renderPages(content);
    await renderSecurity(me);
  } catch (e) {
    if (e.status === 401) location.href = '/admin/login';
    else toast(e.message, true);
  }
})();
