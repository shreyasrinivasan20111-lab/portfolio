/* ══════════════════════════════════════════════════════════
   In-place editing
   ──────────────────────────────────────────────────────────
   The key in the nav unlocks every element carrying data-edit.
   Text is edited where it sits and stored by that key, so the
   markup and the saved copy stay independent — rewording the
   HTML never orphans a saved edit as long as the key is kept.

   SECURITY: the password is checked in the browser. Anyone can
   read it in this file. It is a latch to stop idle visitors
   typing on the page, not a login — do not put anything behind
   it that would matter if a stranger changed it.

   WHERE EDITS GO: localStorage always, so they survive a reload
   on this machine. If SAVE_URL is set, a copy is POSTed there
   too and every visitor gets it; until then edits are yours
   alone. `Download` writes the same JSON out as content.json —
   commit that next to index.html and it ships to everyone with
   no backend at all.
   ══════════════════════════════════════════════════════════ */
(() => {
  const PASSWORD = 'shreya';        // change me
  const SAVE_URL = '';              // e.g. '/api/content' — see the note above
  const STORE = 'portfolio-content';

  const $ = sel => document.querySelector(sel);
  const fields = [...document.querySelectorAll('[data-edit]')];
  if (!fields.length) return;

  /* ── the saved copy ──────────────────────────────────── */
  const readLocal = () => {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
    catch { return {}; }
  };
  let content = readLocal();

  const apply = data => {
    for (const el of fields) {
      const key = el.dataset.edit;
      if (!(key in data)) continue;
      el.textContent = data[key];
      /* an edited field is filled by definition, so drop the placeholder look */
      el.dataset.filled = '1';
    }
  };

  /* content.json, when it exists, is the copy everyone sees; a local edit
     that is newer than it stays on top so a draft is never lost on reload */
  fetch('content.json', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(published => {
      if (published) content = { ...published, ...content };
      apply(content);
    })
    .catch(() => apply(content));

  apply(content);

  /* ── the lock ────────────────────────────────────────── */
  const key = $('.key');
  const lock = $('.lock');
  const input = $('#lockPass');
  const err = $('.lock-err');
  const bar = $('.edit-bar');
  const status = $('.edit-status');
  if (!key || !lock || !input || !bar) return;

  let on = false;

  const openLock = () => {
    lock.classList.add('open');
    err.textContent = '';
    input.value = '';
    input.focus();
  };
  const closeLock = () => lock.classList.remove('open');

  const setEditing = state => {
    on = state;
    document.body.classList.toggle('editing', on);
    key.dataset.on = on ? '1' : '0';
    key.setAttribute('aria-label', on ? 'Leave edit mode' : 'Edit this page');
    for (const el of fields) {
      if (on) {
        el.setAttribute('contenteditable', 'plaintext-only');
        el.setAttribute('spellcheck', 'true');
      } else {
        el.removeAttribute('contenteditable');
      }
    }
    if (!on) say('');
  };

  const say = (msg) => { if (status) status.textContent = msg; };

  key.addEventListener('click', () => (on ? setEditing(false) : openLock()));

  $('.lock-go').addEventListener('click', tryPass);
  $('.lock-cancel').addEventListener('click', closeLock);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') tryPass(); });
  lock.addEventListener('click', e => { if (e.target === lock) closeLock(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeLock(); });

  function tryPass() {
    if (input.value === PASSWORD) { closeLock(); setEditing(true); say('Editing — changes are not saved yet'); }
    else { err.textContent = 'Not that one.'; input.select(); }
  }

  /* ── collecting what changed ─────────────────────────── */
  fields.forEach(el => {
    el.addEventListener('input', () => {
      const key = el.dataset.edit;
      content[key] = el.textContent.trim();
      el.dataset.dirty = '1';
      el.dataset.filled = '1';
      say('Unsaved changes');
    });
    /* a paste carrying markup would smuggle HTML into the page */
    el.addEventListener('paste', e => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
    /* Enter would otherwise split the element into two nodes */
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
    });
  });

  /* ── saving ──────────────────────────────────────────── */
  $('.edit-save').addEventListener('click', async () => {
    try { localStorage.setItem(STORE, JSON.stringify(content)); }
    catch { say('Could not save locally — storage is full or blocked'); return; }

    fields.forEach(el => delete el.dataset.dirty);

    if (!SAVE_URL) { say('Saved on this device'); return; }

    say('Publishing…');
    try {
      const res = await fetch(SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
      say(res.ok ? 'Published — everyone sees this now' : `Publish failed (${res.status})`);
    } catch {
      say('Publish failed — saved on this device only');
    }
  });

  /* the no-backend route: write content.json out and commit it */
  $('.edit-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'content.json';
    a.click();
    URL.revokeObjectURL(a.href);
    say('content.json downloaded — commit it beside index.html');
  });

  $('.edit-reset').addEventListener('click', () => {
    if (!confirm('Discard every edit saved on this device?')) return;
    localStorage.removeItem(STORE);
    location.reload();
  });
})();
