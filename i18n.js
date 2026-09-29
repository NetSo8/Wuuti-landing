/* Wuuti, internationalisation. Vanilla JS, aucune dépendance.
   Le français vit dans le HTML (référence, et contenu servi sans JS) ; chaque autre
   langue est un fichier locales/<code>.json chargé à la demande.
   Pour ajouter une langue : un fichier JSON + une ligne dans LANGS.
     data-i18n="clé"              -> textContent
     data-i18n-html="clé"         -> innerHTML (traductions maison uniquement)
     data-i18n-attr="attr:clé,…"  -> attributs (alt, aria-label, content…) */
(() => {
  "use strict";

  const LANGS = [
    { code: "fr", label: "Français", locale: "fr_FR" },
    { code: "en", label: "English", locale: "en_US" },
  ];
  const DEFAULT = "fr";
  const STORE = "wuuti-lang";
  const VERSION = "2";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const known = (c) => LANGS.some((l) => l.code === c);
  const safe = (fn) => { try { return fn(); } catch { return null; } };

  const root = document.documentElement;
  const dicts = {};
  let lang = DEFAULT;

  // Le texte français d'origine, gardé pour pouvoir y revenir.
  const nodes = $$("[data-i18n], [data-i18n-html], [data-i18n-attr]").map((el) => {
    const attrs = {};
    (el.dataset.i18nAttr || "").split(",").filter(Boolean).forEach((pair) => {
      const [name, key] = pair.split(":");
      attrs[name] = { key, fr: el.getAttribute(name) };
    });
    return {
      el,
      text: el.dataset.i18n ? { key: el.dataset.i18n, fr: el.textContent } : null,
      html: el.dataset.i18nHtml ? { key: el.dataset.i18nHtml, fr: el.innerHTML } : null,
      attrs,
    };
  });

  const load = async (code) => {
    if (code === DEFAULT || dicts[code]) return;
    const res = await fetch(`locales/${code}.json?v=${VERSION}`);
    if (!res.ok) throw new Error(`locale ${code}: ${res.status}`);
    dicts[code] = await res.json();
  };

  // Chaîne d'une clé dans la langue courante ; `fallback` = le français, pour le texte posé par main.js.
  const t = (key, fallback = "") => (lang === DEFAULT ? fallback : dicts[lang]?.[key] ?? fallback);

  const paint = () => {
    const d = lang === DEFAULT ? null : dicts[lang];
    const pick = (spec) => (d && d[spec.key] != null ? d[spec.key] : spec.fr);
    nodes.forEach(({ el, text, html, attrs }) => {
      if (text) el.textContent = pick(text);
      if (html) el.innerHTML = pick(html);
      for (const name in attrs) el.setAttribute(name, pick(attrs[name]));
    });
    const meta = LANGS.find((l) => l.code === lang);
    root.lang = lang;
    $('meta[property="og:locale"]')?.setAttribute("content", meta.locale);
    syncPicker();
  };

  const set = async (code, { persist = true } = {}) => {
    if (!known(code)) code = DEFAULT;
    try { await load(code); } catch (err) { console.warn(err); code = DEFAULT; }
    lang = code;
    paint();
    if (persist) safe(() => localStorage.setItem(STORE, code));
    window.dispatchEvent(new CustomEvent("wuuti:lang", { detail: { lang } }));
  };

  // Langue de départ : choix mémorisé, ?lang=, puis langue du navigateur.
  const initial = () => {
    const saved = safe(() => localStorage.getItem(STORE));
    if (known(saved)) return saved;
    const asked = new URLSearchParams(location.search).get("lang");
    if (known(asked)) return asked;
    for (const l of navigator.languages || [navigator.language]) {
      const code = String(l).slice(0, 2).toLowerCase();
      if (known(code)) return code;
    }
    return DEFAULT;
  };

  /* ------------------------------------------------------------------
     Sélecteur : bouton globe + code ISO, liste des noms natifs
     ------------------------------------------------------------------ */
  const picker = $("[data-lang]");
  const btn = $("[data-lang-btn]", picker);
  const codeEl = $("[data-lang-code]", picker);
  const menu = $("[data-lang-menu]", picker);

  menu.innerHTML = LANGS.map((l) => `
    <li role="option" lang="${l.code}" tabindex="-1" data-value="${l.code}" aria-selected="false">
      <span class="lang__name">${l.label}</span>
      <span class="lang__iso" aria-hidden="true">${l.code.toUpperCase()}</span>
      <svg class="icon lang__check" aria-hidden="true"><use href="#i-check"/></svg>
    </li>`).join("");
  const options = $$("li", menu);

  function syncPicker() {
    codeEl.textContent = lang.toUpperCase();
    options.forEach((o) => o.setAttribute("aria-selected", String(o.dataset.value === lang)));
  }

  const isOpen = () => picker.classList.contains("is-open");
  const open = () => {
    picker.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    (options.find((o) => o.dataset.value === lang) || options[0]).focus({ preventScroll: true });
  };
  const close = (refocus = false) => {
    if (!isOpen()) return;
    picker.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    if (refocus) btn.focus();
  };
  const choose = (o) => { set(o.dataset.value); close(true); };

  btn.addEventListener("click", () => (isOpen() ? close() : open()));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); }
  });
  options.forEach((o) => o.addEventListener("click", () => choose(o)));
  menu.addEventListener("keydown", (e) => {
    const i = options.indexOf(document.activeElement);
    const go = (n) => { e.preventDefault(); options[(n + options.length) % options.length].focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(options.length - 1);
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (i >= 0) choose(options[i]); }
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") close();
  });
  document.addEventListener("pointerdown", (e) => { if (!picker.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(true); });

  window.wuutiI18n = { t, set, get lang() { return lang; } };

  // Pas d'éclair de français : on masque la page le temps de charger la langue.
  const start = initial();
  if (start === DEFAULT) { set(DEFAULT, { persist: false }); return; }
  root.classList.add("i18n-pending");
  const reveal = () => root.classList.remove("i18n-pending");
  const failsafe = setTimeout(reveal, 1500);
  set(start, { persist: false }).finally(() => { clearTimeout(failsafe); reveal(); });
})();
