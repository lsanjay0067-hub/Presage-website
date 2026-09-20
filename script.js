const CTA_URL = "#booking";
const CALENDLY_URL = "https://calendly.com/sanjay-presageretention/30min?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=1fab54";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll(".js-cta").forEach((link) => {
  link.setAttribute("href", CTA_URL);
});

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

const bookingModal = document.querySelector("[data-booking-modal]");
const calendlyParent = bookingModal?.querySelector("[data-calendly-parent]");
let calendlyMounted = false;

function openBooking() {
  if (!bookingModal || !calendlyParent) return false;
  if (!calendlyMounted) {
    if (!window.Calendly) return false; // widget not loaded yet: fall through to #booking
    window.Calendly.initInlineWidget({ url: CALENDLY_URL, parentElement: calendlyParent });
    calendlyMounted = true;
  }
  bookingModal.hidden = false;
  document.body.classList.add("has-modal");
  bookingModal.querySelector(".booking-modal-close")?.focus();
  return true;
}

function closeBooking() {
  if (!bookingModal || bookingModal.hidden) return;
  bookingModal.hidden = true;
  document.body.classList.remove("has-modal");
}

document.querySelectorAll(".js-cta").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    if (openBooking()) event.preventDefault();
  });
});

bookingModal?.querySelectorAll("[data-booking-close]").forEach((el) => el.addEventListener("click", closeBooking));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeBooking();
});

// ---------- horizontal email strip: pause when out of view ----------
const strip = document.querySelector("[data-strip]");
if (strip && "IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => strip.classList.toggle("is-idle", !entry.isIntersecting), { threshold: 0 }).observe(strip);
}

// ---------- first 60 days: circles light as the rail fills on scroll ----------
const days = document.querySelector("[data-days]");
if (days) {
  const steps = [...days.querySelectorAll("[data-days-step]")];
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
