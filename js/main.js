/* ЛЕГРА — премиум-концепт. Plain JS + GSAP/ScrollTrigger + Lenis (CDN). */
(() => {
  'use strict';
  const D = window.LEGRA;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const isMobile = () => innerWidth <= 820;
  if (G && ST) G.registerPlugin(ST);

  /* ---------- плавный скролл ---------- */
  let lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    if (G && ST) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
      G.ticker.lagSmoothing(0);
    } else {
      const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }
  const scrollToEl = (el) => {
    if (!el) return;
    const off = -60;
    if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.4 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + off, behavior: RM ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = id === '#top' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(el);
  }));

  /* ---------- шапка / меню ---------- */
  const header = $('.header');
  const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const burger = $('.burger'), mnav = $('.mnav');
  function closeMenu() { mnav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); mnav.setAttribute('aria-hidden', 'true'); }
  burger.addEventListener('click', () => {
    const open = !mnav.classList.contains('is-open');
    mnav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    mnav.setAttribute('aria-hidden', String(!open));
  });

  /* ---------- сплит текста по буквам ---------- */
  function split(el) {
    if (el.dataset.split) return $$('.ch', el);
    el.dataset.split = '1';
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="w">${[...w].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`).join(' ');
    return $$('.ch', el);
  }

  /* ---------- курсор и «магнитные» кнопки ---------- */
  if (FINE && !RM) {
    const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', (e) => { cur.classList.add('is-live'); mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`; });
    (function loop() { rx = lerp(rx, mx, 0.16); ry = lerp(ry, my, 0.16); ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`; requestAnimationFrame(loop); })();
    document.addEventListener('mouseover', (e) => {
      cur.classList.toggle('is-hover', !!e.target.closest('a,button,.card'));
      cur.classList.toggle('is-drag', !!e.target.closest('.gallery__stage'));
    });
    $$('.magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.28, y = (e.clientY - r.top - r.height / 2) * 0.35;
        el.style.transform = `translate(${x}px,${y}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)'; el.style.transform = ''; setTimeout(() => (el.style.transition = ''), 600); });
    });
  }

  /* ================= 2. ГАЛЕРЕЯ ================= */
  const gallery = $('.gallery'), stage = $('.gallery__stage'), bgs = $('.gallery__bgs');
  const gTitle = $('.gallery__title'), gSub = $('.gallery__sub'), gCur = $('.gallery__cur'), gBar = $('.gallery__progress span');
  const N = D.gallery.length;
  $('.gallery__total').textContent = String(N).padStart(2, '0');
  const slides = D.gallery.map((s, i) => {
    const el = document.createElement('div');
    el.className = 'gslide';
    el.innerHTML = `<div class="gslide__inner"><img src="${s.img}" alt="${s.title}. ${s.sub}" ${i > 2 && i < N - 2 ? 'loading="lazy"' : ''} draggable="false"></div>`;
    el.addEventListener('click', () => { if (!dragMoved && i !== cur) go(i, Math.sign(off(i)) || 1); });
    stage.appendChild(el);
    return el;
  });
  let cur = 0, busy = false, dragMoved = false;
  const off = (i) => { let d = i - cur; if (d > N / 2) d -= N; if (d < -N / 2) d += N; return d; };

  function layout() {
    const m = isMobile();
    slides.forEach((el, i) => {
      const d = off(i), a = Math.abs(d);
      const tx = d * (m ? 86 : 74), tz = -a * (m ? 160 : 240), ry = -d * (m ? 16 : 24);
      el.style.transform = `translateX(${tx}%) translateZ(${tz}px) rotateY(${ry}deg)`;
      el.style.opacity = a > (m ? 1 : 2) ? 0 : 1 - a * (m ? 0.35 : 0.28);
      el.style.filter = `brightness(${1 - a * 0.32})`;
      el.style.zIndex = 100 - a;
      el.style.pointerEvents = a > 2 ? 'none' : '';
      el.classList.toggle('is-current', d === 0);
      const img = el.querySelector('img');
      img.style.transform = `translateX(${d * -9}%) scale(${d === 0 ? 1.02 : 1.12})`;
    });
  }

  function setBg(i, dir) {
    const b = document.createElement('div');
    b.className = 'gbg';
    b.style.backgroundImage = `url(${D.gallery[i].img})`;
    if (dir < 0) b.style.clipPath = 'inset(0 100% 0 0)';
    bgs.appendChild(b);
    requestAnimationFrame(() => requestAnimationFrame(() => { b.style.clipPath = ''; b.classList.add('is-on'); }));
    const olds = $$('.gbg', bgs).slice(0, -1);
    setTimeout(() => olds.forEach((o) => o.remove()), 1400);
  }

  function setInfo(i, dir) {
    const s = D.gallery[i];
    gCur.textContent = String(i + 1).padStart(2, '0');
    if (!G || RM) { gTitle.textContent = s.title; gSub.textContent = s.sub; return; }
    const out = $$('.ln', gTitle).concat($$('.ln', gSub));
    G.to(out, { yPercent: -110 * dir, duration: 0.45, ease: 'power3.in', stagger: 0.04, onComplete: () => {
      gTitle.innerHTML = `<span class="ln">${s.title}</span>`;
      gSub.innerHTML = `<span class="ln">${s.sub}</span>`;
      G.fromTo([$('.ln', gTitle), $('.ln', gSub)], { yPercent: 110 * dir }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.08 });
    } });
  }

  function go(i, dir = 1) {
    if (busy || i === cur) return;
    busy = true;
    cur = (i + N) % N;
    layout(); setBg(cur, dir); setInfo(cur, dir); restartAuto();
    setTimeout(() => (busy = false), 700);
  }
  const next = () => go((cur + 1) % N, 1);
  const prev = () => go((cur - 1 + N) % N, -1);
  $('.gbtn--next').addEventListener('click', next);
  $('.gbtn--prev').addEventListener('click', prev);
  gallery.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); });

  // перетаскивание / свайп
  let sx = 0, sy = 0, down = false;
  stage.addEventListener('pointerdown', (e) => { down = true; dragMoved = false; sx = e.clientX; sy = e.clientY; });
  addEventListener('pointerup', (e) => {
    if (!down) return; down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { dragMoved = true; dx < 0 ? next() : prev(); setTimeout(() => (dragMoved = false), 50); }
  });

  // наклон текущего слайда за мышью
  if (FINE && !RM) {
    gallery.addEventListener('mousemove', (e) => {
      const r = gallery.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      const inner = slides[cur].querySelector('.gslide__inner');
      inner.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 12}deg)`;
    });
    gallery.addEventListener('mouseleave', () => slides.forEach((s) => (s.querySelector('.gslide__inner').style.transform = '')));
  }

  // автопрокрутка с прогресс-линией
  const AUTO = 6;
  let autoTw = null, inView = false, hovering = false;
  function restartAuto() {
    if (RM || !G) return;
    autoTw && autoTw.kill();
    G.set(gBar, { scaleX: 0 });
    autoTw = G.to(gBar, { scaleX: 1, duration: AUTO, ease: 'none', paused: !inView || hovering, onComplete: next });
  }
  gallery.addEventListener('mouseenter', () => { hovering = true; autoTw && autoTw.pause(); });
  gallery.addEventListener('mouseleave', () => { hovering = false; inView && autoTw && autoTw.play(); });
  new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (!autoTw) return; inView && !hovering ? autoTw.play() : autoTw.pause(); }, { threshold: 0.35 }).observe(gallery);

  gTitle.innerHTML = `<span class="ln">${D.gallery[0].title}</span>`;
  gSub.innerHTML = `<span class="ln">${D.gallery[0].sub}</span>`;
  layout(); setBg(0, 1); restartAuto();
  addEventListener('resize', layout);

  $('[data-goto="glass"]').addEventListener('click', () => {
    const gi = D.gallery.findIndex((s) => s.tag === 'glass');
    setTimeout(() => go(gi, 1), 600);
  });

  // бегущая лента (дублируем для бесшовности)
  const track = $('.marquee__track');
  const mHTML = D.marquee.map((m) => `<figure class="mitem"><img src="${m.img}" alt="${m.t}" loading="lazy" width="286" height="202"><span>${m.t}</span></figure>`).join('');
  track.innerHTML = mHTML + (RM ? '' : mHTML.replaceAll('<figure class="mitem">', '<figure class="mitem" aria-hidden="true">'));

  /* ================= 3. КАРТОЧКИ + FLIP-раскрытие ================= */
  const cardsWrap = $('.cards');
  D.cards.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'card'; b.type = 'button';
    b.setAttribute('aria-label', `${c.title} — подробнее`);
    b.innerHTML = `<div class="card__media"><img src="${c.img}" alt="${c.title}" loading="lazy"><span class="card__shine"></span>
      <span class="card__num">${String(i + 1).padStart(2, '0')}</span><span class="card__plus">+</span>
      <div class="card__cap"><p class="card__kicker">${c.kicker}</p><h3 class="card__title">${c.title}</h3></div></div>`;
    b.addEventListener('click', () => openSheet(i, b));
    if (FINE && !RM) {
      const m = b.querySelector('.card__media');
      b.addEventListener('mousemove', (e) => {
        const r = m.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        m.style.transform = `rotateY(${(x - 0.5) * 10}deg) rotateX(${(0.5 - y) * 10}deg)`;
        m.style.setProperty('--mx', x * 100 + '%'); m.style.setProperty('--my', y * 100 + '%');
      });
      b.addEventListener('mouseleave', () => (m.style.transform = ''));
    }
    cardsWrap.appendChild(b);
  });

  const sheet = $('.sheet'), veil = $('.sheet__veil'), panel = $('.sheet__panel'), sMedia = $('.sheet__media');
  let openCard = null;
  function fillSheet(c) {
    $('.sheet__kicker').textContent = c.kicker;
    $('.sheet__title').textContent = c.title;
    $('.sheet__specs').innerHTML = c.specs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    sMedia.innerHTML = `<img src="${c.img}" alt="${c.title}">`;
  }
  function rectOf(el) { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }

  function openSheet(i, btn) {
    const c = D.cards[i]; openCard = btn;
    fillSheet(c);
    sheet.classList.add('is-open'); sheet.setAttribute('aria-hidden', 'false');
    lenis && lenis.stop(); document.documentElement.style.overflow = 'hidden';
    const reveal = $$('.sheet__content > *', sheet);
    if (!G || RM) { G ? G.set([veil, panel], { opacity: 1 }) : (veil.style.opacity = panel.style.opacity = 1); $('.sheet__close').focus(); return; }
    const from = rectOf(btn.querySelector('.card__media img'));
    G.set(panel, { opacity: 0 });
    const to = rectOf(sMedia);
    const clone = document.createElement('img');
    clone.src = c.img; clone.className = 'flip-clone';
    Object.assign(clone.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    document.body.appendChild(clone);
    G.set(sMedia.querySelector('img'), { opacity: 0 });
    G.set(reveal, { opacity: 0, y: 30 });
    const tl = G.timeline();
    tl.to(veil, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
      .to(clone, { left: to.left, top: to.top, width: to.width, height: to.height, borderRadius: 0, duration: 1, ease: 'expo.inOut' }, 0)
      .to(panel, { opacity: 1, duration: 0.45 }, 0.6)
      .add(() => { G.set(sMedia.querySelector('img'), { opacity: 1 }); clone.remove(); })
      .fromTo(sMedia.querySelector('img'), { scale: 1 }, { scale: 1.06, duration: 6, ease: 'none' })
      .to(reveal, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out' }, 0.85);
    setTimeout(() => $('.sheet__close').focus({ preventScroll: true }), 900);
  }
  function closeSheet() {
    if (!sheet.classList.contains('is-open')) return;
    const done = () => {
      sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = ''; lenis && lenis.start();
      openCard && openCard.focus({ preventScroll: true });
    };
    if (!G || RM) { done(); return; }
    const img = sMedia.querySelector('img');
    const from = rectOf(img), to = rectOf(openCard.querySelector('.card__media img'));
    const clone = img.cloneNode(); clone.className = 'flip-clone';
    Object.assign(clone.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    document.body.appendChild(clone);
    G.timeline({ onComplete: () => { clone.remove(); done(); } })
      .to(panel, { opacity: 0, duration: 0.3 }, 0)
      .to(clone, { left: to.left, top: to.top, width: to.width, height: to.height, borderRadius: 3, duration: 0.85, ease: 'expo.inOut' }, 0)
      .to(veil, { opacity: 0, duration: 0.5 }, 0.35);
  }
  $('.sheet__close').addEventListener('click', closeSheet);
  veil.addEventListener('click', closeSheet);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSheet(); closeMenu(); } });

  /* ================= 4. ПРЕИМУЩЕСТВА ================= */
  const advItems = $$('.adv__item');
  advItems[0].classList.add('is-active');
  advItems.forEach((it) => it.addEventListener('mouseenter', () => advItems.forEach((o) => o.classList.toggle('is-active', o === it))));
  $('.adv').addEventListener('mouseleave', () => advItems.forEach((o, k) => o.classList.toggle('is-active', k === 0)));

  /* ================= 5. ПОДВАЛ: «ЛЕГРА» светится за курсором ================= */
  const neonSvg = $('.neon__svg'), spot = $('#spot');
  let tx = 500, ty = 120, cx = 500, cy = 120, mouseSeen = false, neonVis = false;
  const footer = $('.footer');
  footer.addEventListener('mousemove', (e) => {
    const p = neonSvg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(neonSvg.getScreenCTM().inverse());
    tx = q.x; ty = q.y; mouseSeen = true;
  });
  new IntersectionObserver(([en]) => (neonVis = en.isIntersecting)).observe(neonSvg);
  (function neonLoop(t) {
    if (neonVis) {
      if (!mouseSeen || !FINE) { const s = t / 1000; tx = 500 + Math.sin(s * 0.6) * 420; ty = 120 + Math.cos(s * 0.9) * 60; }
      cx = lerp(cx, tx, RM ? 1 : 0.08); cy = lerp(cy, ty, RM ? 1 : 0.08);
      spot.setAttribute('cx', cx.toFixed(1)); spot.setAttribute('cy', cy.toFixed(1));
    }
    if (!RM) requestAnimationFrame(neonLoop);
  })(0);
  if (RM) { spot.setAttribute('r', '700'); }

  /* ================= прелоадер + анимации появления ================= */
  const pre = $('.preloader'), preNum = $('.preloader__num span'), preWord = $('.preloader__word');
  function intro() {
    if (!G || RM) return;
    const chars = $$('.hero__title .split').flatMap(split);
    G.from(chars, { yPercent: 115, rotate: 6, duration: 1.3, ease: 'expo.out', stagger: 0.035, delay: 0.25 });
    G.from('.hero .eyebrow, .hero__slogan, .hero__lead, .hero__ctas > *', { y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.09, delay: 0.7 });
    G.from('.hero__frame', { clipPath: 'inset(100% 0 0 0)', duration: 1.6, ease: 'expo.inOut' });
    G.from('.hero__img', { scale: 1.35, duration: 2.2, ease: 'expo.out' });
    G.from('.header > *', { y: -20, opacity: 0, duration: 0.9, stagger: 0.06, delay: 0.5, ease: 'power3.out' });
  }
  function scrollFx() {
    if (!G || !ST || RM) return;
    G.to('.hero__img', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    G.to('.hero__content', { y: -60, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: true } });
    $$('.section-head .h2').forEach((h) => {
      const chars = $$('.split', h).flatMap(split);
      G.from(chars, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.02, scrollTrigger: { trigger: h, start: 'top 85%' } });
    });
    $$('.section-head .eyebrow, .section-lead').forEach((el) => G.from(el, { y: 20, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));
    G.from('.gallery__stage', { opacity: 0, y: 80, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.gallery', start: 'top 80%' } });
    G.from('.card', { y: 90, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.cards', start: 'top 85%' } });
    G.from('.adv__item', { y: 60, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '.adv', start: 'top 85%' } });
    G.to('.adv__line', { scaleX: 1, duration: 1.4, ease: 'expo.inOut', stagger: 0.12, scrollTrigger: { trigger: '.adv', start: 'top 75%' } });
    $$('[data-count]').forEach((el) => {
      const end = +el.dataset.count, o = { v: 0 };
      if (!end) return;
      G.to(o, { v: end, duration: 1.8, ease: 'power2.out', onUpdate: () => (el.textContent = Math.round(o.v)), scrollTrigger: { trigger: el, start: 'top 90%' } });
      el.textContent = '0';
    });
    G.from('.glassnote__text', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.glassnote', start: 'top 85%' } });
    G.from('.neon__svg', { opacity: 0, scale: 0.94, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.neon', start: 'top 90%' } });
    G.from('.footer__phone', { y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.footer', start: 'top 80%' } });
  }

  if (RM || !G) { pre.remove(); scrollFx(); }
  else {
    const imgs = [$('.hero__img'), ...$$('.gslide img').slice(0, 3)];
    let loaded = 0, shown = 0, target = 0, finished = false;
    const bump = () => { loaded++; target = loaded / imgs.length; };
    imgs.forEach((im) => (im.complete ? bump() : (im.addEventListener('load', bump, { once: true }), im.addEventListener('error', bump, { once: true }))));
    const timeout = setTimeout(() => (target = 1), 2500);
    (function tick() {
      shown = lerp(shown, target, 0.12);
      const p = Math.min(100, Math.round(shown * 100 + 0.4));
      preNum.textContent = p; preWord.style.setProperty('--p', p + '%');
      if (p >= 100 && !finished) {
        finished = true; clearTimeout(timeout);
        setTimeout(() => { pre.classList.add('is-done'); intro(); scrollFx(); setTimeout(() => pre.remove(), 1300); }, 250);
        return;
      }
      requestAnimationFrame(tick);
    })();
  }
})();
