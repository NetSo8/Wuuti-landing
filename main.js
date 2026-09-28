/* Wuuti, landing. Vanilla JS, aucune dépendance. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const pad2 = (n) => String(n).padStart(2, "0");
  const attrs = (el, o) => { for (const k in o) el.setAttribute(k, o[k]); };

  // Observe un ou plusieurs éléments ; `once` coupe l'observation au premier passage.
  const watch = (targets, cb, { once = false, ...opts } = {}) => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      cb(e.isIntersecting, e);
      if (once && e.isIntersecting) io.unobserve(e.target);
    }), opts);
    [].concat(targets).forEach((t) => io.observe(t));
    return io;
  };

  // Groupe radio accessible (clic + flèches) : couleurs de room, densité des pings.
  const radioGroup = (buttons, onPick, initial = 0) => {
    const pick = (b) => {
      buttons.forEach((s) => { s.setAttribute("aria-checked", String(s === b)); s.tabIndex = s === b ? 0 : -1; });
      onPick(b, buttons.indexOf(b));
    };
    buttons.forEach((b, i) => {
      b.addEventListener("click", () => pick(b));
      b.addEventListener("keydown", (e) => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const n = buttons[(i + d + buttons.length) % buttons.length];
        pick(n);
        n.focus();
      });
    });
    pick(buttons[initial]);
  };

  /* ------------------------------------------------------------------
     Les yeux : port direct de EyesPainter (lib/widgets.dart).
     Fermés pendant l'événement, ouverts quand le coffre s'ouvre.
     ------------------------------------------------------------------ */
  const SVGNS = "http://www.w3.org/2000/svg";
  let eyesUid = 0;
  const allEyes = [];

  class Eyes {
    constructor(host, open = 0) {
      this.host = host;
      this.open = open;
      this.look = { x: 0, y: 0 };
      this.anim = null;
      const id = `e${eyesUid++}`;
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("viewBox", "0 0 230 100");
      svg.setAttribute("fill", "none");
      svg.setAttribute("aria-hidden", "true");
      svg.innerHTML = `
        <defs>
          <clipPath id="${id}c"><path/><path/></clipPath>
          <mask id="${id}m" maskUnits="userSpaceOnUse" x="-20" y="-20" width="270" height="140">
            <rect x="-20" y="-20" width="270" height="140" fill="#fff"/>
            <circle fill="#000"/><circle fill="#000"/>
          </mask>
        </defs>
        <g clip-path="url(#${id}c)" mask="url(#${id}m)"><circle fill="currentColor"/><circle fill="currentColor"/></g>
        <g stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
          <path class="lo"/><path class="lo"/><path class="up"/><path class="up"/>
        </g>
        <g stroke="currentColor" stroke-width="7" stroke-linecap="round">
          ${"<line/>".repeat(6)}
        </g>`;
      host.appendChild(svg);
      this.clip = $$("clipPath path", svg);
      this.refl = $$("mask circle", svg);
      this.iris = $$("g[clip-path] circle", svg);
      this.lows = $$("path.lo", svg);
      this.ups = $$("path.up", svg);
      this.lashes = $$("line", svg);
      this.draw();
      allEyes.push(this);
    }

    draw() {
      const w = 100;
      const o = easeInOut(clamp(this.open, 0, 1));
      const f = (n) => n.toFixed(2);
      for (let i = 0; i < 2; i++) {
        const cx = w * 0.55 + i * w * 1.2;
        const cy = 50;
        const rx = w * 0.46;
        const L = [cx - rx, cy];
        const R = [cx + rx, cy];
        const low = [cx, cy + w * 0.4];
        const up = [cx, lerp(cy + w * 0.4, cy - w * 0.46, o)];
        const upPath = `M${f(L[0])} ${f(L[1])}Q${f(up[0])} ${f(up[1])} ${f(R[0])} ${f(R[1])}`;
        this.ups[i].setAttribute("d", upPath);

        if (o > 0.02) {
          this.clip[i].setAttribute("d", `${upPath}Q${f(low[0])} ${f(low[1])} ${f(L[0])} ${f(L[1])}Z`);
          this.lows[i].setAttribute("d", `M${f(L[0])} ${f(L[1])}Q${f(low[0])} ${f(low[1])} ${f(R[0])} ${f(R[1])}`);
          const icx = cx + this.look.x * w * 0.14;
          const icy = cy + w * 0.02 + this.look.y * w * 0.06;
          const ir = w * 0.2 * easeOut(clamp((o - 0.2) / 0.8, 0, 1));
          attrs(this.iris[i], { cx: f(icx), cy: f(icy), r: f(ir) });
          attrs(this.refl[i], { cx: f(icx + ir * 0.36), cy: f(icy - ir * 0.36), r: f(ir * 0.3) });
          this.lows[i].style.display = "";
        } else {
          this.lows[i].style.display = "none";
          this.iris[i].setAttribute("r", "0");
          this.clip[i].setAttribute("d", "");
        }

        // Cils : pendent fermés, se redressent en s'ouvrant.
        const bulge = up[1] - cy;
        const k = clamp(Math.abs(bulge) / (w * 0.25), 0, 1);
        const side = Math.sign(bulge) || 1;
        [0.25, 0.5, 0.75].forEach((t, j) => {
          const line = this.lashes[i * 3 + j];
          line.style.display = k <= 0.05 ? "none" : "";
          if (k <= 0.05) return;
          const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
          const p = [L[0] * a + up[0] * b + R[0] * c, L[1] * a + up[1] * b + R[1] * c];
          const tan = [(up[0] - L[0]) * 2 * (1 - t) + (R[0] - up[0]) * 2 * t, (up[1] - L[1]) * 2 * (1 - t) + (R[1] - up[1]) * 2 * t];
          const len = Math.hypot(tan[0], tan[1]);
          let n = [-tan[1] / len, tan[0] / len];
          if (Math.sign(n[1]) !== side) n = [-n[0], -n[1]];
          const fan = (t - 0.5) * 0.9 * side;
          n = [n[0] * Math.cos(fan) - n[1] * Math.sin(fan), n[0] * Math.sin(fan) + n[1] * Math.cos(fan)];
          const l = w * (t === 0.5 ? 0.19 : 0.15) * k * lerp(1, 0.72, o);
          attrs(line, {
            x1: f(p[0] + n[0] * w * 0.07), y1: f(p[1] + n[1] * w * 0.07),
            x2: f(p[0] + n[0] * (w * 0.07 + l)), y2: f(p[1] + n[1] * (w * 0.07 + l)),
          });
        });
      }
    }

    to(target, duration = 700) {
      if (this.anim) cancelAnimationFrame(this.anim);
      if (reduceMotion || duration === 0) { this.open = target; this.draw(); return Promise.resolve(); }
      const from = this.open;
      const start = performance.now();
      return new Promise((res) => {
        const tick = (now) => {
          const t = clamp((now - start) / duration, 0, 1);
          this.open = lerp(from, target, t);
          this.draw();
          if (t < 1) this.anim = requestAnimationFrame(tick);
          else { this.anim = null; res(); }
        };
        this.anim = requestAnimationFrame(tick);
      });
    }
  }

  // Les yeux décoratifs (bandeau, notification, manifeste) ne bougent jamais :
  // on dessine une fois, on clone. Seuls logo, coffre, CTA et footer sont animés.
  const eyesMap = new Map();
  let staticEyes = null;
  $$("[data-eyes]").forEach((el) => {
    if (el.dataset.eyes === "static") {
      if (!staticEyes) { staticEyes = new Eyes(el); allEyes.pop(); return; }
      el.appendChild(staticEyes.host.querySelector("svg").cloneNode(true));
      return;
    }
    eyesMap.set(el, new Eyes(el, el.hasAttribute("data-eyes-open") ? 1 : 0));
  });
  const logoEyes = eyesMap.get($("[data-eyes-logo]"));
  const vaultEyes = eyesMap.get($("[data-eyes-vault]"));
  const finalEyes = eyesMap.get($("[data-eyes-final]"));

  // Les yeux ouverts suivent le curseur, avec un amorti (pas de collage au pixel).
  if (finePointer && !reduceMotion) {
    let raf = null;
    let px = innerWidth / 2, py = innerHeight / 2;
    const step = () => {
      let moving = false;
      for (const e of allEyes) {
        if (e.open < 0.3) continue;
        const r = e.host.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) continue;
        const tx = clamp((px - (r.left + r.width / 2)) / 260, -1, 1);
        const ty = clamp((py - (r.top + r.height / 2)) / 200, -1, 1);
        e.look.x = lerp(e.look.x, tx, 0.14);
        e.look.y = lerp(e.look.y, ty, 0.14);
        if (Math.abs(e.look.x - tx) > 0.002 || Math.abs(e.look.y - ty) > 0.002) moving = true;
        if (!e.anim) e.draw();
      }
      raf = moving ? requestAnimationFrame(step) : null;
    };
    addEventListener("pointermove", (ev) => {
      px = ev.clientX; py = ev.clientY;
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
  }

  // Logo : la nuit, les yeux entrouvrent au survol, puis se referment.
  const logo = $(".nav .wordmark");
  let isDay = false;
  if (logo && finePointer) {
    logo.addEventListener("pointerenter", () => { if (!isDay) logoEyes.to(0.4, 260); });
    logo.addEventListener("pointerleave", () => { if (!isDay) logoEyes.to(0, 220); });
  }

  /* ------------------------------------------------------------------
     Nav : fond au scroll + thème selon la section sous la barre
     ------------------------------------------------------------------ */
  const nav = $("[data-nav]");
  const themeMeta = $('meta[name="theme-color"]');
  watch($("[data-hero-sentinel]"), (inView) => nav.classList.toggle("is-scrolled", !inView));

  const vault = $("[data-vault]");
  const themed = $$("main > section, main > div, footer");
  let underNav = null;
  const applyNavTheme = () => {
    if (!underNav) return;
    const day = underNav.classList.contains("day") || (underNav === vault && vault.classList.contains("is-open"));
    nav.dataset.theme = day ? "day" : "night";
    themeMeta.setAttribute("content", day ? "#EEF3F2" : "#0C1517");
  };
  // Bande fine en haut de l'écran (sous la barre) : la section qui la touche donne le thème.
  watch(themed, (inView, e) => {
    if (!inView) return;
    underNav = e.target;
    applyNavTheme();
  }, { rootMargin: "0px 0px -92% 0px" });

  /* ------------------------------------------------------------------
     Reveal au scroll, en cascade courte
     ------------------------------------------------------------------ */
  const revealIO = new IntersectionObserver((entries) => {
    const batch = entries.filter((e) => e.isIntersecting);
    batch.forEach((e, i) => {
      e.target.style.setProperty("--stagger", `${Math.min(i, 5) * 70}ms`);
      e.target.classList.add("is-in");
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  $$(".reveal").forEach((el) => revealIO.observe(el));

  /* ------------------------------------------------------------------
     Hero : notification qui tombe, compte à rebours, inclinaison
     ------------------------------------------------------------------ */
  const notif = $("[data-notif]");
  const notifCount = $("[data-notif-count]");
  const fmt = (s) => `${Math.floor(s / 60)}:${pad2(s % 60)}`;
  const rings = $("[data-rings]");
  const ring = () => {
    rings.classList.remove("is-ringing");
    void rings.offsetWidth; // relance l'animation
    rings.classList.add("is-ringing");
  };
  let notifLeft = 120;
  setTimeout(() => { notif.classList.add("is-in"); if (!reduceMotion) ring(); }, reduceMotion ? 0 : 1300);
  setInterval(() => {
    if (document.hidden) return;
    notifLeft = notifLeft <= 0 ? 120 : notifLeft - 1;
    notifCount.textContent = fmt(notifLeft);
    if (notifLeft === 120 && !reduceMotion) ring(); // nouveau ping : ça resonne
  }, 1000);

  $$("[data-magnetic]").forEach((btn) => {
    if (!finePointer || reduceMotion) return;
    const inner = [...btn.children];
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
      inner.forEach((c) => (c.style.transform = `translate(${dx}px, ${dy}px)`));
    });
    btn.addEventListener("pointerleave", () => inner.forEach((c) => (c.style.transform = "")));
  });

  const tiltHost = $("[data-tilt]");
  const front = $(".phone--front");
  if (tiltHost && finePointer && !reduceMotion) {
    const cur = { x: -8, y: 4 }, tgt = { x: -8, y: 4 };
    let raf = null;
    const loop = () => {
      cur.x = lerp(cur.x, tgt.x, 0.08);
      cur.y = lerp(cur.y, tgt.y, 0.08);
      front.style.setProperty("--ry", `${cur.x.toFixed(2)}deg`);
      front.style.setProperty("--rx", `${cur.y.toFixed(2)}deg`);
      raf = Math.abs(cur.x - tgt.x) + Math.abs(cur.y - tgt.y) > 0.01 ? requestAnimationFrame(loop) : null;
    };
    const hero = $(".hero");
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      tgt.x = -8 + nx * 14;
      tgt.y = 4 - ny * 10;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    hero.addEventListener("pointerleave", () => { tgt.x = -8; tgt.y = 4; if (!raf) raf = requestAnimationFrame(loop); });
  }

  /* ------------------------------------------------------------------
     Rituel : l'étape au centre de l'écran pilote le téléphone
     ------------------------------------------------------------------ */
  const steps = $$("[data-ritual-step]");
  const stepImgs = $$("[data-ritual-img]");
  const stepsList = $(".ritual__steps");
  const setStep = (i) => {
    steps.forEach((s, j) => s.classList.toggle("is-active", j === i));
    stepImgs.forEach((im, j) => im.classList.toggle("is-active", j === i));
    stepsList.style.setProperty("--progress", ((i + 0.5) / steps.length).toFixed(3));
  };
  // Au scroll plutôt qu'en IntersectionObserver : une bande fine au centre
  // de l'écran se fait sauter par un scroll rapide et l'étape reste figée.
  let current = -1, stepRaf = null;
  const syncStep = () => {
    stepRaf = null;
    const mid = innerHeight / 2;
    let i = 0;
    steps.forEach((s, j) => { if (s.getBoundingClientRect().top <= mid) i = j; });
    if (i !== current) { current = i; setStep(i); }
  };
  const queueStep = () => { if (!stepRaf) stepRaf = requestAnimationFrame(syncStep); };
  addEventListener("scroll", queueStep, { passive: true });
  addEventListener("resize", queueStep);
  syncStep();

  /* ------------------------------------------------------------------
     Manifeste : les mots s'allument un à un
     ------------------------------------------------------------------ */
  const words = $("[data-words]");
  words.innerHTML = words.textContent
    .trim()
    .split(/\s+/)
    .map((w, k) => `<span class="w" style="--k:${k}">${w}</span>`)
    .join(" ");
  watch(words, (inView) => inView && words.classList.add("is-in"), { once: true, threshold: 0.5 });

  const photos = Array.from({ length: 12 }, (_, i) => `assets/photos/p${i}.webp?v=2`);
  // Une légende par polaroïd, dans l'ordre des photos : les six premières
  // (visibles sur mobile) couvrent chacune une occasion.
  const captions = [
    "Les 18 ans de Léa", "EVJF de Camille", "Mariage J & T", "Le week-end",
    "Crémaillère", "Minuit pile", "Surprise !", "1er janvier",
    "Soirée d'inté", "Première danse", "Lac, 23h", "Les témoins",
  ];

  /* ------------------------------------------------------------------
     Le coffre : compte à rebours, puis la nuit bascule en jour
     ------------------------------------------------------------------ */
  const ticks = $(".vault__ticks");
  ticks.innerHTML = Array.from({ length: 60 }, (_, i) => {
    const long = i % 5 === 0;
    return `<line x1="100" y1="${long ? 6 : 9}" x2="100" y2="${long ? 20 : 16}" stroke="currentColor" stroke-width="${long ? 2.4 : 1.4}" stroke-linecap="round" transform="rotate(${i * 6} 100 100)"/>`;
  }).join("") + `<circle cx="100" cy="4" r="3.5" fill="#D93D14"/>`;

  const countdown = $("[data-vault-countdown]");
  const tickVault = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(11, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const s = Math.floor((target - now) / 1000);
    countdown.textContent = [s / 3600, (s % 3600) / 60, s % 60].map((v) => pad2(Math.floor(v))).join(":");
  };
  tickVault();
  setInterval(tickVault, 1000);

  const spots = [
    [-37, -24, -9], [-19, -31, 6], [20, -30, 8], [37, -20, -6],
    [-41, 7, 6], [40, 9, -8], [-30, 31, -5], [-10, 34, 7], [11, 34, -6], [30, 30, 5],
  ];
  // Mobile : rangées haut et bas seulement, le titre garde toute la largeur.
  const spotsMobile = [
    [-34, -33, -8], [34, -32, 7], [-33, 31, -6], [-11, 36, 5], [11, 36, -5], [33, 31, 7],
  ];
  const photoHost = $("[data-vault-photos]");
  const placeSpots = () => {
    const list = matchMedia("(max-width: 767px)").matches ? spotsMobile : spots;
    $$(".polaroid", photoHost).forEach((p, i) => {
      const s = list[i];
      p.hidden = !s;
      if (s) p.style.cssText = `--x:${s[0]}vw;--y:${s[1]}vh;--r:${s[2]}deg;--i:${i}`;
    });
  };
  // Les photos partent quand on approche du coffre (pas au chargement de la page),
  // et chaque polaroïd n'est révélé qu'une fois son image chargée : jamais de cadre vide.
  const polaroids = spots.map(() => {
    const p = document.createElement("figure");
    p.className = "polaroid";
    photoHost.appendChild(p);
    return p;
  });
  placeSpots();
  watch(vault, (inView) => {
    if (!inView) return;
    polaroids.forEach((p, i) => {
      const img = new Image(480, 600);
      img.alt = "";
      img.decoding = "async";
      img.addEventListener("load", () => p.classList.add("is-ready"), { once: true });
      img.addEventListener("error", () => { img.src = photos[(i + 5) % photos.length]; }, { once: true });
      img.src = photos[i];
      const cap = document.createElement("figcaption");
      cap.textContent = captions[i];
      p.append(img, cap);
    });
  }, { once: true, rootMargin: "150% 0px" });
  matchMedia("(max-width: 767px)").addEventListener("change", placeSpots);

  const setVault = (open) => {
    if (vault.classList.contains("is-open") === open) return;
    vault.classList.toggle("is-open", open);
    isDay = open;
    vaultEyes.to(open ? 1 : 0, open ? 900 : 400);
    logoEyes.to(open ? 1 : 0, open ? 900 : 300);
    applyNavTheme();
  };
  // Le déclencheur couvre la fin du coffre ; les sections "jour" comptent aussi,
  // pour qu'un saut d'ancre (ex. #tarifs) par-dessus le coffre l'ouvre quand même.
  const trigger = $("[data-vault-trigger]");
  const dayWatch = [trigger, ...$$("[data-day]")];
  const visible = new Set();
  watch(dayWatch, (inView, e) => {
    (inView ? visible.add(e.target) : visible.delete(e.target));
    setVault(visible.size > 0 || trigger.getBoundingClientRect().top < 0);
  }, { rootMargin: "0px 0px -50% 0px" });

  /* ------------------------------------------------------------------
     Bento : couleur de room, code, pings
     ------------------------------------------------------------------ */
  const cover = $("[data-cover]");
  radioGroup($$("[data-swatches] button"), (b) => cover.style.setProperty("--c", b.style.getPropertyValue("--c")));

  const codeBoxes = $$("[data-code] span");
  const codeOk = $("[data-code-ok]");
  const CODE = "85Z2XC";
  let codeTimers = [];
  const clearCode = () => {
    codeTimers.forEach(clearTimeout); codeTimers = [];
    codeBoxes.forEach((b) => { b.textContent = ""; b.classList.remove("is-filled", "is-caret"); });
    codeOk.classList.remove("is-in");
  };
  const typeCode = () => {
    clearCode();
    codeBoxes[0].classList.add("is-caret");
    [...CODE].forEach((ch, i) => {
      codeTimers.push(setTimeout(() => {
        codeBoxes[i].classList.remove("is-caret");
        codeBoxes[i].textContent = ch;
        codeBoxes[i].classList.add("is-filled");
        if (codeBoxes[i + 1]) codeBoxes[i + 1].classList.add("is-caret");
      }, 700 + i * 170));
    });
    codeTimers.push(setTimeout(() => codeOk.classList.add("is-in"), 700 + CODE.length * 170 + 150));
    codeTimers.push(setTimeout(typeCode, 700 + CODE.length * 170 + 3600));
  };
  watch($(".cell--join"), (inView) => (inView ? typeCode() : clearCode()), { threshold: 0.5 });

  // Pings : chaque personne reçoit les siens à un moment différent.
  const timeline = $("[data-timeline]");
  const seg = $("[data-seg]");
  const who = ["Léa", "Sami", "Toi"];
  const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const renderPings = (rate) => {
    timeline.innerHTML = "";
    who.forEach((name, li) => {
      const r = rand(97 + li * 131 + rate * 7);
      // `rate` = pings par personne sur la soirée, un par tranche, placé au hasard dedans
      const dots = Array.from({ length: rate }, (_, k) => clamp((k + 0.15 + r() * 0.7) / rate, 0.02, 0.98));
      const lane = document.createElement("div");
      lane.className = "lane";
      lane.innerHTML = `<span class="lane__who">${name}</span><span class="lane__track">${dots
        .map((x, k) => `<span class="lane__dot" style="left:${(x * 100).toFixed(2)}%;--k:${k}"></span>`)
        .join("")}</span>`;
      timeline.appendChild(lane);
    });
  };
  radioGroup($$("button", seg), (b, i) => {
    seg.style.setProperty("--idx", i);
    renderPings(+b.dataset.rate);
  }, 1);

  /* ------------------------------------------------------------------
     FAQ
     ------------------------------------------------------------------ */
  $$(".faq__item button").forEach((b) => {
    b.addEventListener("click", () => {
      const item = b.closest(".faq__item");
      const open = !item.classList.contains("is-open");
      item.classList.toggle("is-open", open);
      b.setAttribute("aria-expanded", String(open));
    });
  });

  /* ------------------------------------------------------------------
     CTA final : les yeux s'ouvrent quand on arrive
     ------------------------------------------------------------------ */
  watch($("[data-eyes-final]"), (inView) => finalEyes.to(inView ? 1 : 0, inView ? 900 : 300), { threshold: 0.6 });

})();
