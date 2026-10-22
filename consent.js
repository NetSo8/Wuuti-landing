/* Wuuti · consentement cookies / traceurs (vanilla, aucune dépendance).
   - Microsoft Clarity est BLOQUÉ par défaut : le script clarity.ms n'est
     injecté qu'après un consentement explicite (opt-in), jamais avant.
   - Choix conservé 6 mois (recommandation CNIL), modifiable à tout moment
     via le lien « Cookies » du pied de page. Refus = aussi simple qu'accepter.
   - Bilingue FR/EN, synchronisé avec i18n.js quand il est présent (index). */
(() => {
  "use strict";

  const CLARITY_ID = "z1uzxgbtr2";
  const STORE = "wuuti-consent";
  const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
  const CLARITY_COOKIES = ["_clck", "_clsk", "CLID", "ANONCHK", "MR", "MUID", "SM"];

  const STR = {
    fr: {
      bannerTitle: "Tes données, tes règles.",
      bannerText: "On utilise <strong>Microsoft Clarity</strong> pour comprendre comment le site est utilisé (pages vues, clics, cartes de chaleur). Rien ne se charge sans ton accord. <a href=\"confidentialite.html\">En savoir plus</a>",
      acceptAll: "Tout accepter",
      refuseAll: "Tout refuser",
      customize: "Personnaliser",
      modalTitle: "Préférences cookies",
      modalIntro: "Choisis ce que tu autorises. Ton choix est gardé 6 mois, tu peux le changer à tout moment via le lien « Cookies » en bas de page.",
      necessaryTitle: "Strictement nécessaires",
      necessaryText: "Mémorisent ton choix cookies et ta langue. Aucun traceur, toujours actifs.",
      necessaryBadge: "Toujours actifs",
      analyticsTitle: "Mesure d'audience — Microsoft Clarity",
      analyticsText: "Pages vues, interactions, cartes de chaleur et replays de session pour améliorer le site. Données traitées par Microsoft (transferts possibles vers les États-Unis). Cookies : _clck (13 mois max), _clsk (24 h), CLID, ANONCHK, MR, MUID, SM (durées fixées par Microsoft).",
      save: "Enregistrer mes choix",
      modalClose: "Fermer",
      on: "Activé",
      off: "Désactivé",
    },
    en: {
      bannerTitle: "Your data, your rules.",
      bannerText: "We use <strong>Microsoft Clarity</strong> to understand how the site is used (page views, clicks, heatmaps). Nothing loads without your consent. <a href=\"confidentialite.html\">Learn more</a>",
      acceptAll: "Accept all",
      refuseAll: "Reject all",
      customize: "Customise",
      modalTitle: "Cookie preferences",
      modalIntro: "Choose what you allow. Your choice is kept for 6 months and you can change it anytime via the “Cookies” link at the bottom of the page.",
      necessaryTitle: "Strictly necessary",
      necessaryText: "Remember your cookie choice and language. No trackers, always on.",
      necessaryBadge: "Always on",
      analyticsTitle: "Audience measurement — Microsoft Clarity",
      analyticsText: "Page views, interactions, heatmaps and session replays to improve the site. Data processed by Microsoft (possible transfers to the United States). Cookies: _clck (13 months max), _clsk (24 h), CLID, ANONCHK, MR, MUID, SM (durations set by Microsoft).",
      save: "Save my choices",
      modalClose: "Close",
      on: "On",
      off: "Off",
    },
  };

  const safe = (fn) => { try { return fn(); } catch { return null; } };
  const lang = () => {
    const l = safe(() => localStorage.getItem("wuuti-lang"))
      || new URLSearchParams(location.search).get("lang")
      || (navigator.language || "fr").slice(0, 2).toLowerCase();
    return l === "en" ? "en" : "fr";
  };
  let current = lang();
  const t = (key) => STR[current][key] || STR.fr[key];

  /* ------------------------------------------------------------------
     État du consentement
     ------------------------------------------------------------------ */
  const read = () => {
    const raw = safe(() => localStorage.getItem(STORE));
    if (!raw) return null;
    try {
      const c = JSON.parse(raw);
      if (!c || typeof c.analytics !== "boolean" || !c.date) return null;
      if (Date.now() - new Date(c.date).getTime() > SIX_MONTHS_MS) return null; // expiré
      return c;
    } catch { return null; }
  };
  const write = (analytics) =>
    safe(() => localStorage.setItem(STORE, JSON.stringify({ v: 1, analytics, date: new Date().toISOString() })));

  /* Stub Clarity : file les appels éventuels, sans jamais charger le réseau. */
  window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };

  let clarityLoaded = false;
  const loadClarity = () => {
    if (clarityLoaded) return;
    clarityLoaded = true;
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = "https://www.clarity.ms/tag/" + CLARITY_ID;
    const first = document.getElementsByTagName("script")[0];
    (first.parentNode || document.head).insertBefore(s, first);
  };

  const eraseClarityCookies = () => {
    const hosts = [location.hostname, "." + location.hostname.replace(/^www\./, "")];
    CLARITY_COOKIES.forEach((name) => {
      hosts.forEach((domain) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
      });
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  };

  const apply = (analytics) => {
    write(analytics);
    if (analytics) loadClarity();
    else {
      eraseClarityCookies();
      if (clarityLoaded) location.reload(); // un script déjà chargé ne peut pas être « déchargé »
    }
  };

  /* ------------------------------------------------------------------
     Interface : bandeau + modal, dans l'esprit du site (ink, pilules, ember)
     ------------------------------------------------------------------ */
  const root = document.createElement("div");
  root.className = "consent";
  root.innerHTML = `
    <div class="consent__banner" role="region" aria-labelledby="consent-title" hidden data-banner>
      <p class="consent__title" id="consent-title"></p>
      <p class="consent__text"></p>
      <div class="consent__actions">
        <button type="button" class="btn btn--ember btn--sm" data-accept></button>
        <button type="button" class="btn btn--ghost btn--sm" data-refuse></button>
        <button type="button" class="consent__link" data-customize></button>
      </div>
    </div>
    <div class="consent__overlay" hidden data-overlay>
      <div class="consent__modal" role="dialog" aria-modal="true" aria-labelledby="consent-modal-title">
        <h2 class="consent__modal-title" id="consent-modal-title"></h2>
        <p class="consent__modal-intro"></p>
        <ul class="consent__list">
          <li class="consent__item">
            <div>
              <p class="consent__item-title"></p>
              <p class="consent__item-text" data-necessary-text></p>
            </div>
            <span class="consent__badge" data-necessary-badge></span>
          </li>
          <li class="consent__item">
            <div>
              <p class="consent__item-title" data-analytics-title></p>
              <p class="consent__item-text" data-analytics-text></p>
            </div>
            <button type="button" class="consent__switch" role="switch" aria-checked="false" data-switch>
              <span class="consent__knob" aria-hidden="true"></span>
              <span class="sr" data-switch-label></span>
            </button>
          </li>
        </ul>
        <div class="consent__actions consent__actions--modal">
          <button type="button" class="btn btn--ember btn--sm" data-save></button>
          <button type="button" class="btn btn--ghost btn--sm" data-modal-accept></button>
          <button type="button" class="btn btn--ghost btn--sm" data-modal-refuse></button>
        </div>
        <button type="button" class="consent__close" data-close aria-label="Fermer">✕</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const $ = (sel) => root.querySelector(sel);
  const banner = $("[data-banner]");
  const overlay = $("[data-overlay]");
  const switchEl = $("[data-switch]");
  let pendingAnalytics = false;
  let lastFocus = null;

  const paint = () => {
    $("[data-banner] .consent__title").textContent = t("bannerTitle");
    $("[data-banner] .consent__text").innerHTML = t("bannerText");
    $("[data-accept]").textContent = t("acceptAll");
    $("[data-refuse]").textContent = t("refuseAll");
    $("[data-customize]").textContent = t("customize");
    root.querySelector(".consent__modal-title").textContent = t("modalTitle");
    root.querySelector(".consent__modal-intro").textContent = t("modalIntro");
    const titles = root.querySelectorAll(".consent__item-title");
    titles[0].textContent = t("necessaryTitle");
    titles[1].textContent = t("analyticsTitle");
    root.querySelector("[data-necessary-text]").textContent = t("necessaryText");
    root.querySelector("[data-necessary-badge]").textContent = t("necessaryBadge");
    root.querySelector("[data-analytics-text]").textContent = t("analyticsText");
    root.querySelector("[data-save]").textContent = t("save");
    root.querySelector("[data-modal-accept]").textContent = t("acceptAll");
    root.querySelector("[data-modal-refuse]").textContent = t("refuseAll");
    root.querySelector("[data-close]").setAttribute("aria-label", t("modalClose"));
    root.querySelector("[data-switch-label]").textContent =
      (switchEl.getAttribute("aria-checked") === "true" ? t("on") : t("off")) + " — " + t("analyticsTitle");
    document.documentElement.lang = current;
  };

  const syncSwitch = () => {
    switchEl.setAttribute("aria-checked", String(pendingAnalytics));
    root.querySelector("[data-switch-label]").textContent =
      (pendingAnalytics ? t("on") : t("off")) + " — " + t("analyticsTitle");
  };

  const showBanner = () => { banner.hidden = false; };
  const hideBanner = () => { banner.hidden = true; };
  const openModal = () => {
    const c = read();
    pendingAnalytics = c ? c.analytics : false;
    syncSwitch();
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    switchEl.focus({ preventScroll: true });
  };
  const closeModal = () => {
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };

  $("[data-accept]").addEventListener("click", () => { apply(true); hideBanner(); });
  $("[data-refuse]").addEventListener("click", () => { apply(false); hideBanner(); });
  $("[data-customize]").addEventListener("click", openModal);
  $("[data-close]").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) closeModal(); });
  switchEl.addEventListener("click", () => { pendingAnalytics = !pendingAnalytics; syncSwitch(); });
  $("[data-save]").addEventListener("click", () => { apply(pendingAnalytics); closeModal(); hideBanner(); });
  $("[data-modal-accept]").addEventListener("click", () => { apply(true); closeModal(); hideBanner(); });
  $("[data-modal-refuse]").addEventListener("click", () => { apply(false); closeModal(); hideBanner(); });

  /* Lien « Cookies » du pied de page (toutes les pages) */
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-consent-open]");
    if (opener) { e.preventDefault(); hideBanner(); openModal(); }
  });

  /* Changement de langue (pages avec i18n.js) */
  window.addEventListener("wuuti:lang", (e) => {
    current = e.detail && e.detail.lang === "en" ? "en" : "fr";
    paint();
  });

  /* ------------------------------------------------------------------
     Démarrage : sans choix valide, on affiche le bandeau et on ne charge RIEN
     ------------------------------------------------------------------ */
  current = (window.wuutiI18n && window.wuutiI18n.lang === "en") || lang() === "en" ? "en" : "fr";
  paint();
  const existing = read();
  if (existing && existing.analytics) loadClarity();
  else if (!existing) showBanner();

  /* API publique : réouvrir les préférences, rejouer le bandeau (tests) */
  window.wuutiConsent = {
    open: openModal,
    reset: () => { safe(() => localStorage.removeItem(STORE)); eraseClarityCookies(); showBanner(); },
  };
})();
