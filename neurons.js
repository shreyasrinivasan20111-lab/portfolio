/* ══════════════════════════════════════════════════════════
   The neuron field
   ──────────────────────────────────────────────────────────
   Nodes drift; any two close enough are joined by a line whose
   opacity falls off with distance, so the mesh knits and
   unravels on its own. The pointer is simply one more node
   with a longer reach and a little pull, which is the whole
   trick behind the field appearing to reach back.

   Everything scales off the viewport area, so a phone draws a
   few dozen nodes and a desktop a couple of hundred, and both
   cost about the same per frame.
   ══════════════════════════════════════════════════════════ */
(() => {
  const canvas = document.querySelector('.neurons');
  if (!canvas) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  /* capped, because past a point the extra nodes cost frames without
     making the mesh read any denser */
  const DENSITY = 1 / 16000;
  const MAX_NODES = 190;
  const LINK = 132;          // how close two nodes must be to join
  const LINK2 = LINK * LINK; // compared against squared distance, no sqrt
  const BUCKETS = 6;         // alpha steps the links are batched into
  const POINTER_LINK = 210;  // the pointer reaches further than a node
  const POINTER_PULL = 0.9;

  let w = 0, h = 0, dpr = 1, nodes = [], raf = 0;
  const buckets = Array.from({ length: BUCKETS }, () => []);
  const pointer = { x: -9999, y: -9999, on: false };

  const rand = (a, b) => a + Math.random() * (b - a);

  function build() {
    const count = Math.min(MAX_NODES, Math.round(w * h * DENSITY));
    nodes = Array.from({ length: count }, () => ({
      x: rand(0, w), y: rand(0, h),
      vx: rand(-0.16, 0.16), vy: rand(-0.16, 0.16),
      r: rand(0.7, 1.9),
      /* a handful of nodes burn brighter, so the field has focal points
         instead of reading as uniform noise */
      hot: Math.random() < 0.14,
    }));
  }

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function step() {
    ctx.clearRect(0, 0, w, h);

    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      /* wrap rather than bounce: a bounce makes the edges read as walls */
      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;

      if (pointer.on) {
        const dx = pointer.x - n.x, dy = pointer.y - n.y;
        const d = Math.hypot(dx, dy);
        if (d < POINTER_LINK && d > 1) {
          const pull = (1 - d / POINTER_LINK) * POINTER_PULL * 0.012;
          n.vx += dx * pull; n.vy += dy * pull;
        }
      }
      /* drag, so the pointer's pull never accumulates into a slingshot */
      n.vx *= 0.992; n.vy *= 0.992;
      const sp = Math.hypot(n.vx, n.vy);
      if (sp > 0.55) { n.vx = n.vx / sp * 0.55; n.vy = n.vy / sp * 0.55; }
    }

    /* Links — the O(n²) pass, which is why MAX_NODES is capped.
       Every link wants its own alpha, and setting strokeStyle per link means
       one beginPath/stroke per link: several hundred draw calls a frame, which
       is enough to steal frames from anything else animating on the page. So
       each link is sorted into one of BUCKETS alpha steps and every bucket is
       stroked as a single path — the same picture in a handful of calls. */
    ctx.lineWidth = 1;
    for (const b of buckets) b.length = 0;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK2) continue;
        const t = 1 - Math.sqrt(d2) / LINK;
        const slot = Math.min(BUCKETS - 1, (t * BUCKETS) | 0);
        buckets[slot].push(a.x, a.y, b.x, b.y);
      }
    }
    for (let k = 0; k < BUCKETS; k++) {
      const pts = buckets[k];
      if (!pts.length) continue;
      /* the bucket's midpoint alpha — within one step of each link's own */
      ctx.strokeStyle = `rgba(255,138,60,${(((k + 0.5) / BUCKETS) * 0.3).toFixed(3)})`;
      ctx.beginPath();
      for (let m = 0; m < pts.length; m += 4) {
        ctx.moveTo(pts[m], pts[m + 1]); ctx.lineTo(pts[m + 2], pts[m + 3]);
      }
      ctx.stroke();
    }

    /* the pointer's own links, bucketed the same way */
    if (pointer.on) {
      for (const b of buckets) b.length = 0;
      for (const a of nodes) {
        const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        if (d >= POINTER_LINK) continue;
        const t = 1 - d / POINTER_LINK;
        buckets[Math.min(BUCKETS - 1, (t * BUCKETS) | 0)].push(a.x, a.y, pointer.x, pointer.y);
      }
      for (let k = 0; k < BUCKETS; k++) {
        const pts = buckets[k];
        if (!pts.length) continue;
        ctx.strokeStyle = `rgba(255,192,122,${(((k + 0.5) / BUCKETS) * 0.62).toFixed(3)})`;
        ctx.beginPath();
        for (let m = 0; m < pts.length; m += 4) {
          ctx.moveTo(pts[m], pts[m + 1]); ctx.lineTo(pts[m + 2], pts[m + 3]);
        }
        ctx.stroke();
      }
    }

    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.hot ? 'rgba(255,192,122,.95)' : 'rgba(150,186,238,.5)';
      ctx.fill();
      if (n.hot) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,106,22,.08)';
        ctx.fill();
      }
    }

    raf = requestAnimationFrame(step);
  }

  /* one still frame is the right answer for reduced motion: the mesh is
     decoration, and a frozen mesh still reads as one */
  function still() {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > LINK) continue;
        ctx.strokeStyle = `rgba(255,138,60,${((1 - d / LINK) * 0.22).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fillStyle = a.hot ? 'rgba(255,192,122,.9)' : 'rgba(150,186,238,.45)';
      ctx.fill();
    }
  }

  addEventListener('pointermove', e => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true;
  }, { passive: true });
  addEventListener('pointerleave', () => { pointer.on = false; });
  /* a touch should light the field where it lands, then let it settle */
  addEventListener('touchend', () => { pointer.on = false; }, { passive: true });

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { size(); if (reduced) still(); }, 150);
  });

  /* stop drawing while the tab is hidden — there is nobody to see it */
  document.addEventListener('visibilitychange', () => {
    if (reduced) return;
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) raf = requestAnimationFrame(step);
  });

  size();
  if (reduced) still(); else raf = requestAnimationFrame(step);
})();
