const CTA_URL = "#booking";
const CALENDLY_URL = "https://calendly.com/sanjay-presageretention/30min?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=1fab54";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// On the homepage CTAs open the booking modal; elsewhere (legal pages) they
// keep their own href back to the homepage's booking section.
if (document.querySelector(CTA_URL)) {
  document.querySelectorAll(".js-cta").forEach((link) => {
    link.setAttribute("href", CTA_URL);
  });
}

document.querySelectorAll("[data-year]").forEach((year) => {
  year.textContent = new Date().getFullYear();
});

const header = document.querySelector("[data-header]");
const hero = document.querySelector(".hero");

// ---------- phone menu ----------
const navToggle = document.querySelector("[data-nav-toggle]");
if (header && navToggle) {
  const setMenu = (open) => {
    header.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  navToggle.addEventListener("click", () => setMenu(!header.classList.contains("is-open")));
  header.querySelectorAll(".nav-links a, .button-nav").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });
  document.addEventListener("click", (event) => {
    if (header.classList.contains("is-open") && !header.contains(event.target)) setMenu(false);
  });
}

if (header && hero) {
  const headerObserver = new IntersectionObserver(
    ([entry]) => header.classList.toggle("is-scrolled", !entry.isIntersecting),
    { threshold: 0.08 }
  );
  headerObserver.observe(hero);
}

// Pause the hero wall whenever it is off-screen or the tab is hidden so the
// compositor is not animating five layers nobody can see.
if (hero) {
  const setIdle = (idle) => hero.classList.toggle("is-idle", idle);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => setIdle(!entry.isIntersecting), { threshold: 0 }).observe(hero);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) setIdle(true);
    else setIdle(hero.getBoundingClientRect().bottom <= 0);
  });
}

const revealItems = [...document.querySelectorAll(".reveal")];
const showReveal = (item) => item.classList.add("is-visible");

if (prefersReducedMotion) {
  revealItems.forEach(showReveal);
} else {
  // IntersectionObserver does the work normally; the scroll sweep below is a
  // belt-and-braces fallback so a throttled or late observer can never leave
  // a section invisible.
  let pending = revealItems.slice();

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          showReveal(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6%" }
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  let sweeping = false;
  const sweep = () => {
    sweeping = false;
    const limit = window.innerHeight * 0.94;
    pending = pending.filter((item) => {
      if (item.getBoundingClientRect().top > limit) return true;
      showReveal(item);
      return false;
    });
  };
  const queueSweep = () => {
    if (sweeping || !pending.length) return;
    sweeping = true;
    requestAnimationFrame(sweep);
  };
  window.addEventListener("scroll", queueSweep, { passive: true });
  window.addEventListener("resize", queueSweep);
  queueSweep();
}

const navLinks = [...document.querySelectorAll(".nav-links a")];
const navTargets = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if (navTargets.length) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = navLinks.find((item) => item.getAttribute("href") === `#${entry.target.id}`);
        if (!link) return;
        link.classList.toggle("is-active", entry.isIntersecting);
        if (entry.isIntersecting) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-42% 0px -42%", threshold: 0 }
  );
  navTargets.forEach((section) => sectionObserver.observe(section));
}

document.querySelectorAll("[data-faq]").forEach((faq) => {
  const items = [...faq.querySelectorAll(".faq-item")];
  items.forEach((item) => {
    const question = item.querySelector(".faq-question");
    if (!question) return;
    question.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");
      items.forEach((other) => {
        other.classList.remove("is-open");
        other.querySelector(".faq-question")?.setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        item.classList.add("is-open");
        question.setAttribute("aria-expanded", "true");
      }
    });
  });
});

// ---------- FAQ: phones show three questions until expanded ----------
const faqMore = document.querySelector("[data-faq-more]");
const faqList = document.querySelector("#faq-list");
if (faqMore && faqList) {
  faqMore.addEventListener("click", () => {
    const expanded = faqList.classList.toggle("is-expanded");
    faqMore.setAttribute("aria-expanded", String(expanded));
    faqMore.textContent = expanded ? "Show fewer questions" : "Show all questions";
  });
}

const bookingModal = document.querySelector("[data-booking-modal]");
const calendlyParent = bookingModal?.querySelector("[data-calendly-parent]");
let calendlyMounted = false;

// ---------- Calendly: loaded on demand, not on every page view ----------
// The widget script and stylesheet are fetched the first time someone shows
// intent (hovers or focuses a CTA) or scrolls near the booking section.
let calendlyLoading = null;
function loadCalendly() {
  if (window.Calendly) return Promise.resolve();
  if (calendlyLoading) return calendlyLoading;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "https://assets.calendly.com/assets/external/widget.css";
  document.head.append(css);
  calendlyLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      calendlyLoading = null;
      reject(new Error("Calendly failed to load"));
    };
    document.head.append(script);
  });
  return calendlyLoading;
}

const inlineCalendly = document.querySelector(".calendly-inline-widget");
function mountInlineCalendly() {
  loadCalendly()
    .then(() => {
      // widget.js scans for inline widgets itself when it runs; only mount if it did not.
      if (inlineCalendly && !inlineCalendly.querySelector("iframe")) {
        window.Calendly.initInlineWidget({ url: CALENDLY_URL, parentElement: inlineCalendly });
      }
    })
    .catch(() => {});
}

if (inlineCalendly) {
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      mountInlineCalendly();
    }, { rootMargin: "800px 0px" }).observe(inlineCalendly);
  } else {
    mountInlineCalendly();
  }
}

let bookingClosing = false;

function openBooking() {
  if (!bookingModal || !calendlyParent) return false;
  if (!calendlyMounted) {
    if (!window.Calendly) return false; // widget not loaded yet: fall through to #booking
    window.Calendly.initInlineWidget({ url: CALENDLY_URL, parentElement: calendlyParent });
    calendlyMounted = true;
  }
  bookingClosing = false;
  bookingModal.classList.remove("is-closing");
  bookingModal.hidden = false;
  document.body.classList.add("has-modal");
  bookingModal.querySelector(".booking-modal-close")?.focus();
  return true;
}

function closeBooking() {
  if (!bookingModal || bookingModal.hidden || bookingClosing) return;
  bookingClosing = true;
  bookingModal.classList.add("is-closing");
  const dialog = bookingModal.querySelector(".booking-modal-dialog");
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    dialog?.removeEventListener("animationend", finish);
    bookingModal.classList.remove("is-closing");
    bookingModal.hidden = true;
    document.body.classList.remove("has-modal");
    bookingClosing = false;
  };
  dialog?.addEventListener("animationend", finish);
  setTimeout(finish, 260); // safety net if the animation never reports back
}

document.querySelectorAll(".js-cta").forEach((trigger) => {
  if (!bookingModal) return;
  const warm = () => loadCalendly().catch(() => {});
  trigger.addEventListener("pointerenter", warm, { once: true });
  trigger.addEventListener("focus", warm, { once: true });
  trigger.addEventListener("touchstart", warm, { once: true, passive: true });
  trigger.addEventListener("click", (event) => {
    if (openBooking()) {
      event.preventDefault();
      return;
    }
    // Widget not ready yet: hold the click briefly for it, else fall through to #booking.
    event.preventDefault();
    let done = false;
    const fallback = () => {
      if (done) return;
      done = true;
      document.querySelector("#booking")?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
    };
    setTimeout(fallback, 2500);
    loadCalendly()
      .then(() => {
        if (done) return;
        done = true;
        if (!openBooking()) document.querySelector("#booking")?.scrollIntoView();
      })
      .catch(fallback);
  });
});

bookingModal?.querySelectorAll("[data-booking-close]").forEach((el) => el.addEventListener("click", closeBooking));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeBooking();
});

// ---------- horizontal email strip: wave in when seen, pause when out of view ----------
const strip = document.querySelector("[data-strip]");
if (strip && "IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => {
    strip.classList.toggle("is-idle", !entry.isIntersecting);
    if (entry.isIntersecting) strip.classList.add("is-waving");
  }, { threshold: 0.15 }).observe(strip);
} else if (strip) {
  strip.classList.add("is-waving");
}

// ---------- hero: content fades out as it scrolls away ----------
// Writes opacity/transform straight onto the four layers (compositor-only
// properties) instead of a custom property that restyles the whole hero.
if (hero && !prefersReducedMotion) {
  const heroInner = hero.querySelector(".hero-inner");
  const heroBackdrop = [".hero-wall", ".hero-streaks"].map((sel) => hero.querySelector(sel)).filter(Boolean);
  const heroAtmos = hero.querySelector(".hero-atmos");
  let fadeQueued = false;
  let lastFade = -1;
  const paintFade = () => {
    fadeQueued = false;
    const fade = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.85)));
    if (Math.abs(fade - lastFade) < 0.002) return;
    lastFade = fade;
    if (heroInner) {
      heroInner.style.opacity = String(Math.max(0, 1 - fade * 1.2));
      heroInner.style.transform = `translate3d(0, ${(-48 * fade).toFixed(1)}px, 0)`;
    }
    heroBackdrop.forEach((el) => { el.style.opacity = String(1 - fade * 0.85); });
    if (heroAtmos) heroAtmos.style.opacity = String(1 - fade * 0.6);
  };
  const queueFade = () => {
    if (fadeQueued || (lastFade === 1 && window.scrollY > hero.offsetHeight)) return;
    fadeQueued = true;
    requestAnimationFrame(paintFade);
  };
  window.addEventListener("scroll", queueFade, { passive: true });
  window.addEventListener("resize", queueFade);
  paintFade();
}

// ---------- first 60 days: circles light as the rail fills on scroll ----------
const days = document.querySelector("[data-days]");
if (days) {
  const steps = [...days.querySelectorAll("[data-days-step]")];

  // Each card grows from small to full size the first time it scrolls in.
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const growObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-grown");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.25, rootMargin: "0px 0px -8%" });
    steps.forEach((step) => growObserver.observe(step));
  } else {
    steps.forEach((step) => step.classList.add("is-grown"));
  }
  const nums = steps.map((step) => step.querySelector(".days-num"));
  const rail = days.querySelector(".days-rail");
  const fill = days.querySelector("[data-days-fill]");
  let ticking = false;
  let watching = false;

  const paint = () => {
    ticking = false;
    const line = window.innerHeight * 0.62;
    const railBox = rail.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (line - railBox.top) / railBox.height));
    fill.style.transform = `scaleY(${progress})`;
    steps.forEach((step, i) => {
      if (i === 0) return; // step one is always lit
      const box = nums[i].getBoundingClientRect();
      step.classList.toggle("is-lit", box.top + box.height / 2 <= line);
    });
  };

  const request = () => {
    if (!watching || ticking) return;
    ticking = true;
    requestAnimationFrame(paint);
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      watching = entry.isIntersecting;
      if (watching) request();
    }, { rootMargin: "20% 0px 20% 0px" }).observe(days);
  } else {
    watching = true;
  }

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  request();
}
