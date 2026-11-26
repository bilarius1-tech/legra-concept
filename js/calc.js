/* ЛЕГРА — калькулятор лестниц. Самодостаточный модуль: нужен только calc-config.js и контейнер
   <section class="lgc" id="calc"></section>. Классы и переменные с префиксом lgc-. Без библиотек. */
(function () {
  'use strict';
  var root = document.getElementById('calc');
  var C = window.LEGRA_CALC_CONFIG;
  if (!root || !C) return;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var P = C.prices, G = C.geometry;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var nf = new Intl.NumberFormat('ru-RU');
  var money = function (v) { return nf.format(Math.round(v)).replace(/\u00a0|\u202f/g, '\u00a0') + '\u00a0₽'; };
  var byId = function (arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return arr[0]; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------------- состояние ---------------- */
  var S = { type: C.types[0].id, found: C.foundations[0].id, stepMat: C.stepMaterials[0].id, railMat: C.railingMaterials[0].id,
            h: G.heightCm.def, w: G.widthCm.def, bal: null, qty: 0, qtyManual: false };
  var lastKey = '';

  /* ---------------- геометрия ---------------- */
  function geometry() {
    var Hmm = S.h * 10, n = Math.max(1, Math.round(Hmm / G.riserTargetMm));
    if (Hmm / n > G.riserMaxMm) n++;
    if (Hmm / n < G.riserMinMm && n > 1) n--;
    var riser = Hmm / n, t = byId(C.types, S.type), landings = t.landings;
    var treads = Math.max(0, n - 1 - landings);
    var ok = riser >= G.riserMinMm - 0.5 && riser <= G.riserMaxMm + 0.5;
    var blondel = 2 * riser + G.treadMm;                       // формула удобства шага: 600–640 мм
    return { n: n, riser: riser, angle: Math.atan(riser / G.treadMm) * 180 / Math.PI, treads: treads,
             run: treads * G.treadMm / 1000, ok: ok, comfy: blondel >= 600 && blondel <= 640, landings: landings };
  }

  /* ---------------- расчёт стоимости ---------------- */
  function estimate(g) {
    var lines = [], total = 0, pending = false;
    var sp = P.stepPerPiece[S.stepMat], rp = P.railingPerMeter[S.railMat];
    var f = (typeof P.typeFactor[S.type] === 'number' ? P.typeFactor[S.type] : 1) *
            (typeof P.foundationFactor[S.found] === 'number' ? P.foundationFactor[S.found] : 1);
    if (typeof sp === 'number') {
      var v = g.n * sp * f; total += v;
      lines.push({ label: 'Ступени · ' + byId(C.stepMaterials, S.stepMat).title, sub: g.n + ' шт × ' + money(sp * f), amount: v });
    } else { pending = true; lines.push({ label: 'Ступени · ' + byId(C.stepMaterials, S.stepMat).title, sub: g.n + ' шт', amount: null }); }
    if (typeof rp === 'number') {
      var len = (g.treads * G.treadMm / 1000) + 0.9 * g.landings, vr = len * rp; total += vr;
      lines.push({ label: 'Ограждение · ' + byId(C.railingMaterials, S.railMat).title, sub: len.toFixed(1).replace('.', ',') + ' м × ' + money(rp), amount: vr });
    } else { pending = true; lines.push({ label: 'Ограждение · ' + byId(C.railingMaterials, S.railMat).title, sub: 'по проекту', amount: null }); }
    if (S.bal) {
      var bp = P.balusters[S.bal], name = nameOf(S.bal);
      if (typeof bp === 'number') { var vb = bp * S.qty; total += vb; lines.push({ label: 'Балясины · ' + name, sub: S.qty + ' шт × ' + money(bp), amount: vb }); }
      else { pending = true; lines.push({ label: 'Балясины · ' + name, sub: S.qty + ' шт', amount: null, note: 'цена по запросу' }); }
    }
    return { lines: lines, total: total, pending: pending, any: lines.some(function (l) { return l.amount !== null; }) };
  }
  function nameOf(id) { for (var i = 0; i < C.balusterCatalog.length; i++) if (C.balusterCatalog[i][0] === id) return C.balusterCatalog[i][1]; return id; }

  /* ---------------- иконки (план) ---------------- */
  var ln = function (x1, y1, x2, y2, c) { return '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '"' + (c ? ' class="' + c + '"' : '') + '/>'; };
  var rc = function (x, y, w, h) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>'; };
  function hatchV(x1, x2, y1, y2, n) { var s = ''; for (var i = 1; i < n; i++) { var y = y1 + (y2 - y1) * i / n; s += ln(x1, y, x2, y); } return s; }
  function hatchH(x1, x2, y1, y2, n) { var s = ''; for (var i = 1; i < n; i++) { var x = x1 + (x2 - x1) * i / n; s += ln(x, y1, x, y2); } return s; }
  function radial(cx, cy, r0, r1, n, a0, a1) { var s = ''; for (var i = 0; i <= n; i++) { var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; s += ln((cx + r0 * Math.cos(a)).toFixed(1), (cy + r0 * Math.sin(a)).toFixed(1), (cx + r1 * Math.cos(a)).toFixed(1), (cy + r1 * Math.sin(a)).toFixed(1)); } return s; }
  var arrowUp = function (x, y1, y2) { return '<path class="lgc-acc" d="M' + x + ' ' + y1 + 'V' + y2 + 'M' + (x - 3) + ' ' + (y2 + 4) + 'L' + x + ' ' + y2 + 'L' + (x + 3) + ' ' + (y2 + 4) + '"/>'; };
  var TYPE_ICON = {
    straight: function () { return rc(16, 6, 16, 36) + hatchV(16, 32, 6, 42, 9) + arrowUp(24, 39, 10); },
    land_l: function () { return rc(8, 26, 14, 16) + hatchV(8, 22, 26, 42, 5) + rc(8, 10, 14, 16) + rc(22, 10, 18, 16) + hatchH(22, 40, 10, 26, 6) + '<path class="lgc-acc" d="M15 40V18H37M34 15L37 18L34 21"/>'; },
    wind_l: function () { return rc(8, 28, 14, 14) + hatchV(8, 22, 28, 42, 4) + rc(8, 12, 14, 16) + ln(22, 28, 8, 22) + ln(22, 28, 8, 17) + ln(22, 28, 11, 12) + ln(22, 28, 16, 12) + rc(22, 12, 18, 16) + hatchH(22, 40, 12, 28, 6) + '<path class="lgc-acc" d="M15 40V25Q15 20 22 20H37M34 17L37 20L34 23"/>'; },
    spiral: function () { return '<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="3"/>' + radial(24, 24, 3, 17, 11, 0, 330) + '<path class="lgc-acc" d="M24 33A9 9 0 1 1 33 24M30 22L33 24L35 21"/>'; },
    wind_u: function () { return rc(8, 24, 10, 18) + hatchV(8, 18, 24, 42, 5) + rc(30, 24, 10, 18) + hatchV(30, 40, 24, 42, 5) + '<path d="M8 24A16 16 0 0 1 40 24"/>' + radial(24, 24, 0, 16, 5, 180, 360) + '<path class="lgc-acc" d="M13 40V24A11 11 0 0 1 35 24V38M32 35L35 38L38 35"/>'; },
    land_u: function () { return rc(8, 26, 10, 16) + hatchV(8, 18, 26, 42, 4) + rc(30, 26, 10, 16) + hatchV(30, 40, 26, 42, 4) + rc(8, 8, 32, 18) + '<path class="lgc-acc" d="M13 40V17H35V38M32 35L35 38L38 35"/>'; },
    shaft: function () { return rc(6, 6, 36, 36) + '<circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="2.5"/>' + radial(24, 24, 2.5, 14, 11, 0, 330); },
    three: function () { return rc(8, 26, 10, 16) + hatchV(8, 18, 26, 42, 4) + rc(8, 8, 10, 18) + rc(18, 8, 16, 10) + hatchH(18, 34, 8, 18, 5) + rc(34, 8, 8, 12) + rc(34, 20, 8, 22) + hatchV(34, 42, 20, 42, 5) + '<path class="lgc-acc" d="M13 40V13H38V38M35 35L38 38L41 35"/>'; }
  };
  var treadsPts = function (n, dx, dy) { var a = []; for (var i = 0; i < n; i++) a.push([4 + i * dx, 27 - i * dy]); return a; };
  var FOUND_ICON = {
    kosour: function () { var p = treadsPts(6, 9, 4), s = ''; p.forEach(function (q) { s += ln(q[0], q[1], q[0] + 9, q[1]) + ln(q[0], q[1], q[0], q[1] + 4); }); return s + '<path d="M4 29L49 9L49 14L4 33Z" class="lgc-fill"/>'; },
    tetiva: function () { var p = treadsPts(6, 9, 4), d = 'M4 28', s = ''; p.forEach(function (q) { d += 'L' + q[0] + ' ' + q[1] + 'L' + (q[0] + 9) + ' ' + q[1]; }); var d2 = ''; p.slice().reverse().forEach(function (q) { d2 += 'L' + (q[0] + 9) + ' ' + (q[1] - 5) + 'L' + q[0] + ' ' + (q[1] - 5); }); return '<path class="lgc-fill" d="' + d + d2 + 'Z"/>'; },
    bolts: function () { var p = treadsPts(6, 9, 4), s = ''; p.forEach(function (q) { s += ln(q[0], q[1], q[0] + 9, q[1]) + '<circle cx="' + (q[0] + 7) + '" cy="' + (q[1] + 4) + '" r="1.8"/>' + ln(q[0] + 7, q[1], q[0] + 7, q[1] + 2.2); }); return s; },
    spiral: function () { return '<circle cx="28" cy="16" r="12"/><circle cx="28" cy="16" r="2"/>' + radial(28, 16, 2, 12, 9, 0, 320); },
    single: function () { var p = treadsPts(6, 9, 4), s = ''; p.forEach(function (q) { s += ln(q[0] - 1, q[1], q[0] + 10, q[1]); }); return s + '<path class="lgc-fill" d="M4 31L49 11L49 19L4 38Z"/>'; },
    metal: function () { var p = treadsPts(6, 9, 4), s = ''; p.forEach(function (q) { s += ln(q[0], q[1], q[0] + 9, q[1]); }); s += '<path class="lgc-fill" d="M4 30L49 10L49 17L4 37Z"/>'; for (var i = 0; i < 7; i++) s += ln(4 + i * 7.5, 31 - i * 3.3 + (i % 2 ? 6 : 0), 11.5 + i * 7.5, 31 - (i + 1) * 3.3 + (i % 2 ? 0 : 6)); return s; }
  };

  /* ---------------- разметка ---------------- */
  function build() {
    var typeCards = C.types.map(function (t) {
      return '<button type="button" class="lgc-opt" data-k="type" data-v="' + t.id + '" aria-pressed="false"><svg viewBox="0 0 48 48" aria-hidden="true">' + TYPE_ICON[t.id]() + '</svg><span>' + t.title + '</span></button>';
    }).join('');
    var foundCards = C.foundations.map(function (t) {
      return '<button type="button" class="lgc-opt lgc-opt--f" data-k="found" data-v="' + t.id + '" aria-pressed="false"><svg viewBox="0 0 56 40" aria-hidden="true">' + FOUND_ICON[t.id]() + '</svg><span>' + t.title + '</span></button>';
    }).join('');
    var mat = function (arr, k) {
      return arr.map(function (m) {
        return '<button type="button" class="lgc-mat" data-k="' + k + '" data-v="' + m.id + '" aria-pressed="false"><img src="' + C.assetsBase + 'mat/' + m.id + '.webp" alt="" width="40" height="40" loading="lazy"><span>' + m.title + '</span></button>';
      }).join('');
    };
    var bals = '<button type="button" class="lgc-bal lgc-bal--none" data-k="bal" data-v="" aria-pressed="true"><span class="lgc-bal__x">∅</span><b>Без балясин</b><i>Ограждение без деревянных балясин</i></button>' +
      C.balusterCatalog.map(function (b) {
        var p = P.balusters[b[0]];
        return '<button type="button" class="lgc-bal" data-k="bal" data-v="' + b[0] + '" aria-pressed="false"><span class="lgc-bal__img"><img src="' + C.assetsBase + 'bal/' + b[0] + '.webp" alt="' + b[1] + '" loading="lazy" draggable="false"></span><b>' + b[1] + '</b><i>' + (typeof p === 'number' ? nf.format(p) + '\u00a0₽/шт' : 'цена по запросу') + '</i></button>';
      }).join('');
    root.innerHTML =
      '<div class="lgc-head"><p class="lgc-eyebrow"><span class="lgc-line"></span>Калькулятор лестниц</p>' +
      '<h2 class="lgc-h2">Рассчитайте <em>свою лестницу</em></h2>' +
      '<p class="lgc-lead">Пройдите 4 простых шага и узнайте предварительные параметры вашей лестницы. Точную стоимость назовём после бесплатного замера.</p></div>' +
      '<div class="lgc-grid"><div class="lgc-steps">' +
      step(1, 'Какой тип лестницы вам нужен?', '<div class="lgc-opts">' + typeCards + '</div>') +
      step(2, 'Какой тип основания?', '<div class="lgc-opts lgc-opts--f">' + foundCards + '</div>') +
      step(3, 'Выберите материалы', '<div class="lgc-mats"><div><p class="lgc-sub">Для ступеней</p><div class="lgc-matrow">' + mat(C.stepMaterials, 'stepMat') + '</div></div><div><p class="lgc-sub">Для ограждений</p><div class="lgc-matrow">' + mat(C.railingMaterials, 'railMat') + '</div></div></div>') +
      step(4, 'Укажите размеры', '<div class="lgc-dims">' +
        dim('h', 'Высота этажа', 'от пола до пола', G.heightCm) + dim('w', 'Ширина марша', 'для винтовой — диаметр', G.widthCm) + '</div><p class="lgc-warn" hidden></p>') +
      step(5, 'Балясины из каталога <small>по желанию · цены по прайсу</small>',
        '<div class="lgc-balwrap"><div class="lgc-balrow" tabindex="0">' + bals + '</div>' +
        '<div class="lgc-balnav"><button type="button" class="lgc-arr" data-dir="-1" aria-label="Назад">‹</button><button type="button" class="lgc-arr" data-dir="1" aria-label="Вперёд">›</button></div></div>' +
        '<div class="lgc-qty" hidden><span>Количество</span><div class="lgc-stepper"><button type="button" data-q="-1" aria-label="Меньше">−</button><input type="number" inputmode="numeric" min="1" max="999" value="1" aria-label="Количество балясин"><button type="button" data-q="1" aria-label="Больше">+</button></div><em class="lgc-hint"></em></div>') +
      '</div>' +
      '<aside class="lgc-side"><div class="lgc-card" data-lenis-prevent>' +
        '<div class="lgc-scheme"><svg viewBox="0 0 640 350" role="img" aria-label="Схема лестницы по вашим параметрам"></svg><span class="lgc-tag">Схема по вашим параметрам</span></div>' +
        '<div class="lgc-metrics"></div>' +
        '<ul class="lgc-chosen"></ul>' +
        '<div class="lgc-total"><p class="lgc-total__label">Итого по прайсу</p><p class="lgc-total__num"><span class="lgc-from">от</span> <b>0</b></p><div class="lgc-break"></div>' +
        '<p class="lgc-note">Предварительный расчёт. Точная цена — после бесплатного замера и 3D-проекта.</p></div>' +
        '<div class="lgc-cta"><a class="lgc-btn lgc-btn--red" href="tel:' + C.phoneTel + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z"/></svg>Позвонить</a>' +
        '<button type="button" class="lgc-btn lgc-btn--ghost lgc-send" aria-expanded="false">Отправить расчёт</button></div>' +
        '<form class="lgc-form" novalidate hidden><div class="lgc-form__in">' +
          '<label class="lgc-field"><span>Имя</span><input name="name" type="text" autocomplete="name" placeholder="Как к вам обращаться"></label>' +
          '<label class="lgc-field"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__"></label>' +
          '<label class="lgc-check"><input type="checkbox" name="agree"><i></i><span>Согласен(на) на обработку персональных данных</span></label>' +
          '<p class="lgc-err" hidden></p>' +
          '<button type="submit" class="lgc-btn lgc-btn--red lgc-btn--block">Отправить расчёт</button>' +
        '</div></form>' +
        '<div class="lgc-ok" hidden><div class="lgc-ok__mark"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div><p class="lgc-ok__t">Спасибо! Мы получили ваш расчёт</p><p class="lgc-ok__s">Менеджер перезвонит вам в ближайшее время.</p><p class="lgc-ok__demo">Демо-макет: данные никуда не отправляются.</p></div>' +
      '</div></aside></div>' +
      '<div class="lgc-bar" aria-hidden="true"><span class="lgc-bar__t"></span><a href="#calc-summary" class="lgc-bar__go">Итог ↓</a></div>';
    var side = $('.lgc-card'); side.id = 'calc-summary';
  }
  function step(n, title, body) { return '<section class="lgc-step"><div class="lgc-step__h"><span class="lgc-step__n">' + String(n).padStart(2, '0') + '</span><h3>' + title + '</h3></div>' + body + '</section>'; }
  function dim(k, title, hint, r) {
    return '<div class="lgc-dim" data-dim="' + k + '"><div class="lgc-dim__top"><span class="lgc-dim__t">' + title + '<em>' + hint + '</em></span>' +
      '<label class="lgc-num"><input type="number" inputmode="numeric" min="' + r.min + '" max="' + r.max + '" value="' + r.def + '" aria-label="' + title + ', см"><i>см</i></label></div>' +
      '<input type="range" min="' + r.min + '" max="' + r.max + '" value="' + r.def + '" step="1" aria-label="' + title + '"><div class="lgc-dim__r"><span>' + r.min + '</span><span>' + r.max + '</span></div></div>';
  }

  /* ---------------- SVG-схема ---------------- */
  var NS = 'http://www.w3.org/2000/svg';
  function f1(v) { return (+v).toFixed(1); }
  function scheme(g, animate) {
    var t = byId(C.types, S.type), svg = $('.lgc-scheme svg');
    var spiral = t.spiral || S.found === 'spiral';
    var out = spiral ? spiralPlan(g, t) : sideView(g, t);
    svg.innerHTML = '<defs><pattern id="lgcHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V6" stroke="rgba(227,207,178,.18)" stroke-width="1"/></pattern>' +
      '<marker id="lgcArr" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L7 4L1 7" fill="none" stroke="#e3261a" stroke-width="1.2"/></marker></defs>' +
      '<g class="lgc-sg' + (animate && !RM ? ' lgc-in' : '') + '">' + out + '</g>';
  }
  function sideView(g, t) {
    var h = S.h, b = G.treadMm / 10, n = g.n, F = t.landings + 1, w = S.w;
    var rh = g.riser / 10;
    var per = [], base = Math.floor(n / F), rem = n % F, i, f;
    for (f = 0; f < F; f++) per.push(base + (f < rem ? 1 : 0));
    // профиль: массив рисок {x,y,len,flight,first,last,landing}
    var risers = [], x = 0, y = 0, idx = 0;
    for (f = 0; f < F; f++) for (i = 0; i < per[f]; i++) {
      var lastOfFlight = i === per[f] - 1, isLanding = lastOfFlight && f < F - 1, isTop = idx === n - 1;
      y += rh;
      var len = isLanding ? w : (isTop ? b * 0.45 : b);
      risers.push({ x: x, y: y, len: len, f: f, first: i === 0, last: lastOfFlight, landing: isLanding });
      x += len; idx++;
    }
    var Lx = x, Wd = 640, Hd = 350, padL = 86, padR = 34, padT = 46, padB = 60;
    var s = Math.min((Wd - padL - padR) / Lx, (Hd - padT - padB) / (h + 96));
    var ox = padL + ((Wd - padL - padR) - Lx * s) / 2, oy = Hd - padB;
    var X = function (v) { return ox + v * s; }, Y = function (v) { return oy - v * s; };
    var tk = Math.max(3, 4 * s), sm = byId(C.stepMaterials, S.stepMat), rm = byId(C.railingMaterials, S.railMat);
    var o = '';
    // пол и перекрытие
    o += '<path class="lgc-ln lgc-ln--dim" d="M' + f1(X(-18)) + ' ' + f1(Y(0)) + 'H' + f1(X(Lx * 0.45)) + '"/>';
    var topx = risers[risers.length - 1].x;
    o += '<path class="lgc-ln" d="M' + f1(X(topx)) + ' ' + f1(Y(h)) + 'H' + f1(Wd - padR + 8) + '"/><rect x="' + f1(X(topx)) + '" y="' + f1(Y(h) + 1) + '" width="' + f1(Wd - padR + 8 - X(topx)) + '" height="10" fill="url(#lgcHatch)" opacity=".9"/>';
    // основание
    var d = 18, fl = [];
    for (f = 0; f < F; f++) fl.push(risers.filter(function (r) { return r.f === f; }));
    fl.forEach(function (rs, fi) {
      var a = rs[0], z = rs[rs.length - 1];
      var yA = a.y - rh, yZ = z.y - rh; // уровень пола марша в начале и «носка» последней ступени
      var pts;
      if (S.found === 'kosour' || S.found === 'metal' || S.found === 'single') {
        var dd = S.found === 'single' ? 26 : (S.found === 'metal' ? 20 : 18), gap = S.found === 'single' ? 6 : 0;
        pts = [[a.x, yA - gap], [z.x + z.len * 0.1, z.y - rh - gap], [z.x + z.len * 0.1, z.y - rh - gap - dd], [a.x, yA - gap - dd]];
        o += '<path class="lgc-ln lgc-fill" d="M' + pts.map(function (p) { return f1(X(p[0])) + ' ' + f1(Y(p[1])); }).join('L') + 'Z"/>';
        if (S.found === 'metal') { var zz = 'M'; for (var k = 0; k <= rs.length * 2; k++) { var tt = k / (rs.length * 2); var px = a.x + (z.x + z.len * 0.1 - a.x) * tt, py = (yA + (z.y - rh - yA) * tt) - (k % 2 ? 2 : dd - 2); zz += (k ? 'L' : '') + f1(X(px)) + ' ' + f1(Y(py)); } o += '<path class="lgc-ln lgc-ln--dim" d="' + zz + '"/>'; }
        if (S.found === 'single') rs.forEach(function (r) { o += '<path class="lgc-ln lgc-ln--dim" d="M' + f1(X(r.x + 4)) + ' ' + f1(Y(r.y - rh)) + 'V' + f1(Y(r.y - rh - gap)) + '"/>'; });
      } else if (S.found === 'tetiva') {
        var up = 16, dpath = '', k2;
        for (k2 = 0; k2 < rs.length; k2++) dpath += (k2 ? 'L' : 'M') + f1(X(rs[k2].x)) + ' ' + f1(Y(rs[k2].y)) + 'L' + f1(X(rs[k2].x + rs[k2].len)) + ' ' + f1(Y(rs[k2].y));
        var back = ''; for (k2 = rs.length - 1; k2 >= 0; k2--) back += 'L' + f1(X(rs[k2].x + rs[k2].len)) + ' ' + f1(Y(rs[k2].y + up)) + 'L' + f1(X(rs[k2].x)) + ' ' + f1(Y(rs[k2].y + up));
        o += '<path class="lgc-ln lgc-fill" d="' + dpath + back + 'Z"/>';
      } else if (S.found === 'bolts') {
        rs.forEach(function (r) { var bx = r.x + Math.min(r.len, b) * 0.85; o += '<path class="lgc-ln lgc-ln--dim" d="M' + f1(X(bx)) + ' ' + f1(Y(r.y)) + 'V' + f1(Y(r.y - 14)) + '"/><circle class="lgc-dot" cx="' + f1(X(bx)) + '" cy="' + f1(Y(r.y - 14)) + '" r="2.6"/>'; });
      }
      if (rs[rs.length - 1].landing) { var L = rs[rs.length - 1]; o += '<rect class="lgc-fill lgc-ln" x="' + f1(X(L.x)) + '" y="' + f1(Y(L.y - 1)) + '" width="' + f1(L.len * s) + '" height="' + f1(12 * s) + '"/>';
        o += '<path class="lgc-ln lgc-ln--dim" d="M' + f1(X(L.x + L.len - 3)) + ' ' + f1(Y(L.y - 13)) + 'V' + f1(Y(0)) + '"/>'; }
    });
    // ступени
    var risersSvg = '', treadsSvg = '';
    risers.forEach(function (r, k) {
      risersSvg += '<path class="lgc-ln lgc-ln--dim" d="M' + f1(X(r.x)) + ' ' + f1(Y(r.y - rh)) + 'V' + f1(Y(r.y)) + '"/>';
      treadsSvg += '<rect class="lgc-tread" style="animation-delay:' + (k * 22) + 'ms" x="' + f1(X(r.x - 2)) + '" y="' + f1(Y(r.y)) + '" width="' + f1((r.len + 2) * s) + '" height="' + f1(tk) + '" rx="1" fill="' + sm.tint + '"/>';
    });
    o += risersSvg + treadsSvg;
    // ограждение
    var RH = 90, railPts = [];
    fl.forEach(function (rs) {
      var a = rs[0], z = rs[rs.length - 1];
      railPts.push([[a.x + 2, a.y + RH], [z.x + (z.landing ? z.len : 4), z.y + RH]]);
    });
    var topS = [];
    railPts.forEach(function (seg) { topS.push('M' + f1(X(seg[0][0])) + ' ' + f1(Y(seg[0][1])) + 'L' + f1(X(seg[1][0])) + ' ' + f1(Y(seg[1][1]))); });
    var yAt = function (seg, xv) { var t0 = (xv - seg[0][0]) / ((seg[1][0] - seg[0][0]) || 1); return seg[0][1] + (seg[1][1] - seg[0][1]) * clamp(t0, 0, 1); };
    var rail = '';
    fl.forEach(function (rs, fi) {
      var seg = railPts[fi];
      rs.forEach(function (r, k) {
        var xs = r.landing ? [r.x + r.len * 0.25, r.x + r.len * 0.5, r.x + r.len * 0.75] : [r.x + b * 0.22, r.x + b * 0.7];
        xs.forEach(function (xv) {
          var y0 = r.y + 0.6, y1 = yAt(seg, xv);
          var X0 = f1(X(xv)), Y0 = f1(Y(y0)), Y1 = f1(Y(y1));
          if (rm.kind === 'wood') rail += '<path class="lgc-ln lgc-bl" d="M' + X0 + ' ' + Y0 + 'V' + Y1 + '"/>';
          if (rm.kind === 'forged') { var mid = (y0 + y1) / 2; rail += '<path class="lgc-ln lgc-bl" d="M' + X0 + ' ' + Y0 + 'V' + Y1 + '"/><circle class="lgc-ln lgc-ring" cx="' + X0 + '" cy="' + f1(Y(mid)) + '" r="' + f1(Math.max(3, 7 * s)) + '"/>'; }
          if (rm.kind === 'iron') { var m2 = (y0 + y1) / 2; rail += '<path class="lgc-ln lgc-bl lgc-bl--bold" d="M' + X0 + ' ' + Y0 + 'V' + Y1 + '"/><path class="lgc-ln lgc-bl" d="M' + f1(X(xv) - 4) + ' ' + f1(Y(m2)) + 'L' + X0 + ' ' + f1(Y(m2) - 4) + 'L' + f1(X(xv) + 4) + ' ' + f1(Y(m2)) + 'L' + X0 + ' ' + f1(Y(m2) + 4) + 'Z"/>'; }
        });
      });
      if (rm.kind === 'steel') {
        [30, 52, 72].forEach(function (off) { rail += '<path class="lgc-ln lgc-bl" d="M' + f1(X(seg[0][0])) + ' ' + f1(Y(seg[0][1] - RH + off)) + 'L' + f1(X(seg[1][0])) + ' ' + f1(Y(seg[1][1] - RH + off)) + '"/>'; });
        for (var k3 = 0; k3 < rs.length; k3 += 3) { var rr = rs[k3]; rail += '<path class="lgc-ln lgc-bl--post" d="M' + f1(X(rr.x + 3)) + ' ' + f1(Y(rr.y)) + 'V' + f1(Y(yAt(seg, rr.x + 3))) + '"/>'; }
      }
      if (rm.kind === 'glass') {
        rail += '<path class="lgc-glass" d="M' + f1(X(seg[0][0])) + ' ' + f1(Y(seg[0][1] - RH + 6)) + 'L' + f1(X(seg[1][0])) + ' ' + f1(Y(seg[1][1] - RH + 6)) + 'L' + f1(X(seg[1][0])) + ' ' + f1(Y(seg[1][1])) + 'L' + f1(X(seg[0][0])) + ' ' + f1(Y(seg[0][1])) + 'Z"/>';
        [0.12, 0.88].forEach(function (u) { var xv = seg[0][0] + (seg[1][0] - seg[0][0]) * u; rail += '<circle class="lgc-dot" cx="' + f1(X(xv)) + '" cy="' + f1(Y(yAt(seg, xv) - 8)) + '" r="2.4"/><circle class="lgc-dot" cx="' + f1(X(xv)) + '" cy="' + f1(Y(yAt(seg, xv) - RH + 14)) + '" r="2.4"/>'; });
      }
      // стойки по краям марша
      [seg[0], seg[1]].forEach(function (p, ei) { rail += '<path class="lgc-ln lgc-newel" d="M' + f1(X(p[0])) + ' ' + f1(Y(p[1] - RH)) + 'V' + f1(Y(p[1] + 5)) + '"/>'; });
    });
    o += '<g class="lgc-railing">' + rail + '</g><path class="lgc-ln lgc-hand" d="' + topS.join('') + '"/>';
    // размеры (красный акцент)
    var xd = 44;
    o += '<path class="lgc-dimln" marker-start="url(#lgcArr)" marker-end="url(#lgcArr)" d="M' + xd + ' ' + f1(Y(h)) + 'V' + f1(Y(0)) + '"/>';
    o += '<path class="lgc-ln lgc-ln--dim" d="M' + (xd - 6) + ' ' + f1(Y(h)) + 'H' + f1(X(topx)) + 'M' + (xd - 6) + ' ' + f1(Y(0)) + 'H' + f1(X(-18)) + '"/>';
    o += '<text class="lgc-dtx" x="' + (xd - 12) + '" y="' + f1((Y(h) + Y(0)) / 2) + '" text-anchor="middle" transform="rotate(-90 ' + (xd - 12) + ' ' + f1((Y(h) + Y(0)) / 2) + ')">' + h + ' см</text>';
    var r1 = risers[1] || risers[0];
    o += '<path class="lgc-dimln" d="M' + f1(X(r1.x) - 10) + ' ' + f1(Y(r1.y - rh)) + 'V' + f1(Y(r1.y)) + '"/><text class="lgc-dtx lgc-dtx--s" x="' + f1(X(r1.x) - 16) + '" y="' + f1(Y(r1.y - rh / 2) + 4) + '" text-anchor="end">' + Math.round(g.riser) + ' мм</text>';
    var yb = oy + 30;
    o += '<path class="lgc-dimln" marker-start="url(#lgcArr)" marker-end="url(#lgcArr)" d="M' + f1(X(0)) + ' ' + yb + 'H' + f1(X(topx)) + '"/><text class="lgc-dtx" x="' + f1((X(0) + X(topx)) / 2) + '" y="' + (yb + 20) + '" text-anchor="middle">≈ ' + (topx / 100).toFixed(1).replace('.', ',') + ' м по горизонтали</text>';
    return o;
  }
  function spiralPlan(g, t) {
    var cx = 320, cy = 158, R = 112, r0 = 16, n = Math.max(2, g.n - 1), sm = byId(C.stepMaterials, S.stepMat), rm = byId(C.railingMaterials, S.railMat);
    var a = Math.min(34, 360 / n), o = '';
    if (t.shaft) o += '<rect class="lgc-ln lgc-fill" x="' + (cx - R - 16) + '" y="' + (cy - R - 16) + '" width="' + (2 * R + 32) + '" height="' + (2 * R + 32) + '"/>';
    for (var i = 0; i < n; i++) {
      var a0 = -90 + i * a, a1 = a0 + a - 1.6, p = function (r, ang) { return f1(cx + r * Math.cos(ang * Math.PI / 180)) + ' ' + f1(cy + r * Math.sin(ang * Math.PI / 180)); };
      o += '<path class="lgc-tread lgc-tread--p" style="animation-delay:' + (i * 24) + 'ms;opacity:' + (0.5 + 0.5 * i / n).toFixed(2) + '" fill="' + sm.tint + '" d="M' + p(r0, a0) + 'L' + p(R, a0) + 'A' + R + ' ' + R + ' 0 0 1 ' + p(R, a1) + 'L' + p(r0, a1) + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + p(r0, a0) + 'Z"/>';
    }
    o += '<circle class="lgc-ln" cx="' + cx + '" cy="' + cy + '" r="' + r0 + '" fill="rgba(11,7,5,.8)"/>';
    o += '<circle class="lgc-ln lgc-hand" cx="' + cx + '" cy="' + cy + '" r="' + (R + 6) + '" fill="none"/>';
    if (rm.kind === 'glass') o += '<circle class="lgc-glass" cx="' + cx + '" cy="' + cy + '" r="' + (R + 6) + '" fill="rgba(160,215,230,.07)"/>';
    if (rm.kind === 'steel') o += '<circle class="lgc-ln lgc-bl" cx="' + cx + '" cy="' + cy + '" r="' + (R + 14) + '" fill="none" stroke-dasharray="1 5"/>';
    var aEnd = -90 + (n - 1) * a + a / 2;
    o += '<path class="lgc-dimln" d="M' + cx + ' ' + (cy - r0) + 'V' + (cy - R - 24) + '"/><text class="lgc-dtx lgc-dtx--s" x="' + (cx + 8) + '" y="' + (cy - R - 28) + '">старт</text>';
    o += '<path class="lgc-dimln" marker-start="url(#lgcArr)" marker-end="url(#lgcArr)" d="M' + (cx - R - 6) + ' ' + (cy + R + 30) + 'H' + (cx + R + 6) + '"/><text class="lgc-dtx" x="' + cx + '" y="' + (cy + R + 52) + '" text-anchor="middle">⌀ ' + S.w + ' см · ' + n + ' ступеней по кругу</text>';
    return o;
  }

  /* ---------------- анимация чисел ---------------- */
  var tweens = new WeakMap();
  function tweenNum(el, to, fmt) {
    var from = +el.dataset.v || 0;
    el.dataset.v = to;
    if (RM || from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), dur = 650, id = tweens.get(el);
    if (id) cancelAnimationFrame(id);
    (function frame(now) {
      var k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) tweens.set(el, requestAnimationFrame(frame)); else el.textContent = fmt(to);
    })(t0);
  }

  /* ---------------- обновление интерфейса ---------------- */
  function sync(userFlag) {
    var g = geometry();
    if (!S.qtyManual) S.qty = g.n * C.balustersPerStep;
    var key = [S.type, S.found, S.stepMat, S.railMat, g.n].join('|');
    scheme(g, key !== lastKey); lastKey = key;
    // кнопки выбора
    $$('[data-k]').forEach(function (el) {
      var k = el.dataset.k, v = el.dataset.v, on = k === 'bal' ? (S.bal || '') === v : S[k] === v;
      el.setAttribute('aria-pressed', on ? 'true' : 'false'); el.classList.toggle('is-on', on);
    });
    // метрики
    var mt = [['Ступеней', String(g.n), ''], ['Высота ступени', Math.round(g.riser) + ' мм', g.ok ? (g.comfy ? 'удобно' : 'в норме') : 'вне нормы'], ['Угол подъёма', Math.round(g.angle) + '°', ''], ['Глубина ступени', G.treadMm + ' мм', '']];
    $('.lgc-metrics').innerHTML = mt.map(function (m) { return '<div class="lgc-m"><span>' + m[0] + '</span><b>' + m[1] + '</b>' + (m[2] ? '<i class="' + (g.ok ? '' : 'is-bad') + '">' + m[2] + '</i>' : '') + '</div>'; }).join('');
    var warn = $('.lgc-warn');
    warn.hidden = g.ok;
    if (!g.ok) warn.textContent = 'При такой высоте высота ступени получается ' + Math.round(g.riser) + ' мм — вне нормы 150–200 мм. Мастер подберёт решение на замере.';
    // выбранное
    var t = byId(C.types, S.type), fd = byId(C.foundations, S.found);
    var chosen = [['Тип', t.title], ['Основание', fd.title], ['Ступени', byId(C.stepMaterials, S.stepMat).title], ['Перила', byId(C.railingMaterials, S.railMat).title], ['Высота', S.h + ' см'], ['Ширина', S.w + ' см']];
    $('.lgc-chosen').innerHTML = chosen.map(function (c) { return '<li><span>' + c[0] + '</span><b>' + c[1] + '</b></li>'; }).join('');
    // количество балясин
    var q = $('.lgc-qty'); q.hidden = !S.bal;
    if (S.bal) { var qi = $('input', q); if (document.activeElement !== qi) qi.value = S.qty; $('.lgc-hint', q).textContent = S.qtyManual ? 'Количество задано вручную' : 'Предложено: ' + C.balustersPerStep + ' на ступень · можно изменить'; }
    // стоимость
    var e = estimate(g);
    tweenNum($('.lgc-total__num b'), e.total, money);
    $('.lgc-total__num').classList.toggle('is-empty', !e.any);
    $('.lgc-total__label').textContent = e.any ? 'Итого по прайсу' : 'Стоимость лестницы';
    $('.lgc-from').hidden = !e.any;
    if (!e.any) $('.lgc-total__num b').textContent = 'по замеру';
    $('.lgc-break').innerHTML = e.lines.map(function (l) {
      return '<div class="lgc-row' + (l.amount === null ? ' is-pending' : '') + '"><div><span>' + l.label + '</span><small>' + l.sub + '</small></div><b>' + (l.amount === null ? (l.note || 'по замеру') : money(l.amount)) + '</b></div>';
    }).join('');
    $('.lgc-bar__t').textContent = g.n + ' ступ. · ' + Math.round(g.riser) + ' мм · ' + (e.any ? 'от ' + money(e.total) : 'цена по замеру');
  }

  /* ---------------- события ---------------- */
  function bind() {
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-k]');
      if (b) {
        var k = b.dataset.k, v = b.dataset.v;
        if (k === 'bal') { S.bal = v || null; if (S.bal && !S.qtyManual) S.qty = geometry().n * C.balustersPerStep; }
        else S[k] = v;
        sync(); return;
      }
      var arr = ev.target.closest('.lgc-arr');
      if (arr) { var row = $('.lgc-balrow'); row.scrollBy({ left: +arr.dataset.dir * row.clientWidth * 0.8, behavior: RM ? 'auto' : 'smooth' }); return; }
      var qb = ev.target.closest('[data-q]');
      if (qb) { S.qty = clamp(S.qty + +qb.dataset.q, 1, 999); S.qtyManual = true; sync(); return; }
      if (ev.target.closest('.lgc-send')) { var f = $('.lgc-form'), btn = $('.lgc-send'), open = f.hidden; f.hidden = !open; btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Скрыть форму' : 'Отправить расчёт'; if (open) { f.classList.remove('is-in'); void f.offsetWidth; f.classList.add('is-in'); setTimeout(function () { $('input[name=name]', f).focus({ preventScroll: true }); }, 50); } return; }
    });
    // размеры
    $$('.lgc-dim').forEach(function (box) {
      var k = box.dataset.dim, r = k === 'h' ? G.heightCm : G.widthCm, rng = $('input[type=range]', box), num = $('input[type=number]', box);
      var set = function (v, fromNum) { v = Math.round(+v); if (isNaN(v)) return; S[k] = clamp(v, r.min, r.max); rng.value = S[k]; if (!fromNum || clamp(v, r.min, r.max) === v) num.value = S[k]; sync(); };
      rng.addEventListener('input', function () { set(rng.value); });
      num.addEventListener('input', function () { if (num.value !== '' && +num.value >= r.min) set(num.value, true); });
      num.addEventListener('blur', function () { num.value = S[k]; });
    });
    var qi = $('.lgc-qty input');
    qi.addEventListener('input', function () { var v = Math.round(+qi.value); if (v >= 1) { S.qty = clamp(v, 1, 999); S.qtyManual = true; sync(); } });
    // форма (демо)
    var form = $('.lgc-form'), err = $('.lgc-err');
    var ph = $('input[name=phone]', form);
    ph.addEventListener('input', function () {
      var d = ph.value.replace(/\D/g, ''); if (d[0] === '8' || d[0] === '7') d = d.slice(1); d = d.slice(0, 10);
      var o = '+7'; if (d.length) o += ' (' + d.slice(0, 3); if (d.length >= 3) o += ')'; if (d.length > 3) o += ' ' + d.slice(3, 6); if (d.length > 6) o += '-' + d.slice(6, 8); if (d.length > 8) o += '-' + d.slice(8, 10);
      ph.value = d.length ? o : '';
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = form.name.value.trim(), digits = ph.value.replace(/\D/g, '');
      var msg = !name ? 'Введите ваше имя' : digits.length < 11 ? 'Введите телефон полностью' : !form.agree.checked ? 'Нужно согласие на обработку данных' : '';
      err.hidden = !msg; err.textContent = msg;
      if (msg) return;
      /* ДЕМО: ничего не отправляем. В Тильде здесь подключается форма заявок Тильды (см. README). */
      form.hidden = true; $('.lgc-cta').hidden = true; var ok = $('.lgc-ok'); ok.hidden = false; ok.classList.add('is-in');
    });
    // мини-панель на мобильном: показываем, пока калькулятор на экране, но итог ещё не виден
    var bar = $('.lgc-bar'), vis = { sec: false, card: false };
    var upd = function () { bar.classList.toggle('is-on', vis.sec && !vis.card); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { vis.sec = en[0].isIntersecting; upd(); }, { threshold: 0.05 }).observe(root.querySelector('.lgc-grid'));
      new IntersectionObserver(function (en) { vis.card = en[0].isIntersecting; upd(); }, { threshold: 0.2 }).observe($('.lgc-card'));
    }
    $('.lgc-bar__go').addEventListener('click', function (ev) { ev.preventDefault(); var c = $('.lgc-card'); window.scrollTo({ top: c.getBoundingClientRect().top + scrollY - 70, behavior: RM ? 'auto' : 'smooth' }); });
    // появление блоков при скролле
    if ('IntersectionObserver' in window && !RM) {
      var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-seen'); io.unobserve(e.target); } }); }, { threshold: 0.12 });
      $$('.lgc-step, .lgc-head, .lgc-card').forEach(function (el) { el.classList.add('lgc-rv'); io.observe(el); });
    }
  }

  build(); bind(); sync();
})();
