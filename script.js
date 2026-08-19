/* ══════════════════════════════════════════════════════════
   Shreya Srinivasan — fly-in
   ══════════════════════════════════════════════════════════ */
(() => {
  /* trigger the entrance once styles/fonts have settled */
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add('in');
        /* drop the entrance classes afterwards — their staggered
           transition delays would otherwise make hover feel laggy */
        setTimeout(() => {
          document.querySelectorAll('.fly-link, .fly-name')
            .forEach(el => el.classList.remove('fly-link', 'fly-name'));
        }, 1800);
      });
    });
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
    setTimeout(start, 900);            // don't wait forever on a slow font load
  } else {
    start();
  }

  /* mark the current page in the nav */
  const page = document.body.dataset.page;
  document.querySelectorAll('.links a').forEach(a => {
    if (a.getAttribute('href') === `${page}.html`) a.classList.add('active');
  });

  /* ── gallery carousel ─────────────────────────────────── */
  const showcase = document.querySelector('.showcase');
  if (showcase) {
    const slides = [...showcase.querySelectorAll('.slide')];
    const prevBtn = showcase.querySelector('.arrow-prev');
    const nextBtn = showcase.querySelector('.arrow-next');
    const dotWrap = document.querySelector('.dots');
    const n = slides.length;
    let cur = 0;

    /* build the dots */
    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', `Artwork ${i + 1}`);
      b.addEventListener('click', () => go(i));
      dotWrap?.append(b);
      return b;
    });

    /* offset from centre, wrapped to the shorter way round */
    function offsetOf(i) {
      let off = i - cur;
      if (off >  n / 2) off -= n;
      if (off < -n / 2) off += n;
      return off;
    }

    function layout() {
      slides.forEach((s, i) => {
        const off = offsetOf(i);
        s.dataset.off = Math.abs(off) <= 2 ? String(off) : 'far';
        s.setAttribute('aria-hidden', off === 0 ? 'false' : 'true');
      });
      dots.forEach((d, i) => d.setAttribute('aria-selected', i === cur ? 'true' : 'false'));
    }

    function go(next) {
      cur = (next + n) % n;
      layout();
    }

    prevBtn.addEventListener('click', () => go(cur - 1));
    nextBtn.addEventListener('click', () => go(cur + 1));

    /* clicking a blurred neighbour brings it to the front */
    slides.forEach((s, i) => {
      s.addEventListener('click', () => {
        const off = offsetOf(i);
        if (off !== 0) go(i);
      });
    });

    addEventListener('keydown', e => {
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
    const seeAll = document.querySelector('#seeAll');
    const gridView = document.querySelector('#gridView');

    if (seeAll && gridView) {
      /* built from the slides themselves, so it stays in step
         when artwork is added or removed */
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
        seeAll.textContent = 'close';
      };

      const closeGrid = () => {
        gridView.hidden = true;
        document.body.classList.remove('grid-open');
        seeAll.setAttribute('aria-expanded', 'false');
        seeAll.textContent = 'see all';
      };

      seeAll.addEventListener('click', () =>
        gridView.hidden ? openGrid() : closeGrid());

      addEventListener('keydown', e => {
        if (e.key === 'Escape' && !gridView.hidden) closeGrid();
      });
    }

    layout();
  }

  /* let the picture frame accept a dropped image, and remember it */
  const pic = document.querySelector('.pic');
  if (!pic) return;

  const showImage = src => {
    pic.querySelector('img')?.remove();
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Shreya Srinivasan';
    pic.append(img);
    pic.classList.add('has-img');
  };

  const saved = localStorage.getItem('portrait');
  if (saved) showImage(saved);

  pic.addEventListener('dragover', e => { e.preventDefault(); pic.classList.add('drop'); });
  pic.addEventListener('dragleave', () => pic.classList.remove('drop'));
  pic.addEventListener('drop', e => {
    e.preventDefault();
    pic.classList.remove('drop');
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      showImage(reader.result);
      try { localStorage.setItem('portrait', reader.result); } catch (_) {}
    };
    reader.readAsDataURL(file);
  });
})();
