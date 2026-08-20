/* ══════════════════════════════════════════════════════════
   Shreya Srinivasan — interactions
   Everything here is progressive: with JS off the page still
   reads, because .reveal only hides once we confirm we can
   show it again.
   ══════════════════════════════════════════════════════════ */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── scroll progress ─────────────────────────────────── */
  const bar = document.querySelector('.progress');
  const nav = document.getElementById('nav');
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    nav.classList.toggle('stuck', y > 12);
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ── reveal on entry ─────────────────────────────────── */
  const targets = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);          // reveal once, then stop paying for it
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });
    targets.forEach(el => io.observe(el));
  }

  /* ── scroll-spy ──────────────────────────────────────── */
  const links = [...document.querySelectorAll('.nav-links a')];
  const sections = links
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    /* a band across the middle of the viewport decides which section
       counts as "current" — cheaper and steadier than measuring on
       every scroll frame */
    const spy = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const id = '#' + e.target.id;
        links.forEach(a => a.classList.toggle('current', a.getAttribute('href') === id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => spy.observe(s));
  }

  /* ── mobile menu ─────────────────────────────────────── */
  const burger = document.getElementById('burger');
  const close = () => {
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  };
  burger?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  links.forEach(a => a.addEventListener('click', close));
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  /* ── art carousel ────────────────────────────────────────
     Carried over from the old gallery page. The offset from
     centre is the only thing the script decides; CSS turns
     that into position, scale, opacity and blur. */
  const showcase = document.querySelector('.showcase');
  if (showcase) {
    const slides  = [...showcase.querySelectorAll('.slide')];
    const prevBtn = showcase.querySelector('.arrow-prev');
    const nextBtn = showcase.querySelector('.arrow-next');
    const dotWrap = document.querySelector('.dots');
    const n = slides.length;
    let cur = 0;

    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', `Artwork ${i + 1}`);
      b.addEventListener('click', () => go(i));
      dotWrap?.append(b);
      return b;
    });

    /* offset from centre, wrapped the shorter way round */
    const offsetOf = (i) => {
      let off = i - cur;
      if (off >  n / 2) off -= n;
      if (off < -n / 2) off += n;
      return off;
    };

    function layout() {
      slides.forEach((s, i) => {
        const off = offsetOf(i);
        s.dataset.off = Math.abs(off) <= 2 ? String(off) : 'far';
        s.setAttribute('aria-hidden', off === 0 ? 'false' : 'true');
      });
      dots.forEach((d, i) => d.setAttribute('aria-selected', i === cur ? 'true' : 'false'));
    }

    function go(next) { cur = (next + n) % n; layout(); }

    prevBtn?.addEventListener('click', () => go(cur - 1));
    nextBtn?.addEventListener('click', () => go(cur + 1));

    /* clicking a blurred neighbour brings it forward */
    slides.forEach((s, i) => s.addEventListener('click', () => {
      if (offsetOf(i) !== 0) go(i);
    }));

    /* arrow keys only while the gallery is on screen, so they do not
       fight the rest of the page */
    let inView = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; },
        { threshold: .35 }).observe(showcase);
    }
    addEventListener('keydown', e => {
      if (!inView) return;
      if (e.key === 'ArrowLeft')  go(cur - 1);
      if (e.key === 'ArrowRight') go(cur + 1);
    });

    /* swipe / drag anywhere across the carousel */
    let x0 = null;
    showcase.addEventListener('pointerdown', e => { x0 = e.clientX; });
    showcase.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
    });

    /* ── "see all": every artwork in a grid ── */
    const seeAll = document.getElementById('seeAll');
    const gridView = document.getElementById('gridView');

    if (seeAll && gridView) {
      /* built from the slides themselves, so it stays in step when
         artwork is added or removed */
      const buildGrid = () => {
        gridView.textContent = '';
        slides.forEach((s, i) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'g-item';
          item.innerHTML = s.innerHTML;
          item.setAttribute('aria-label', `Show artwork ${i + 1}`);
          if (i === cur) item.classList.add('is-current');
          item.addEventListener('click', () => { go(i); closeGrid(); });
          gridView.append(item);
        });
      };
      const openGrid = () => {
        buildGrid();
        gridView.hidden = false;
        document.body.classList.add('grid-open');
        seeAll.setAttribute('aria-expanded', 'true');
        seeAll.textContent = 'Close';
      };
      const closeGrid = () => {
        gridView.hidden = true;
        document.body.classList.remove('grid-open');
        seeAll.setAttribute('aria-expanded', 'false');
        seeAll.textContent = 'See all';
      };
      seeAll.addEventListener('click', () => gridView.hidden ? openGrid() : closeGrid());
      addEventListener('keydown', e => {
        if (e.key === 'Escape' && !gridView.hidden) closeGrid();
      });
    }

    layout();
  }

  /* ── footer year ─────────────────────────────────────── */
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();
})();
