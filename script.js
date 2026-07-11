const CTA_URL = "#booking";
const VIDEO_ID = "";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll(".js-cta").forEach((link) => {
  link.setAttribute("href", CTA_URL);
});

document.querySelectorAll("[data-year]").forEach((year) => {
  year.textContent = new Date().getFullYear();
});

const header = document.querySelector("[data-header]");
const hero = document.querySelector(".hero");

if (header && hero) {
  const headerObserver = new IntersectionObserver(
    ([entry]) => header.classList.toggle("is-scrolled", !entry.isIntersecting),
    { threshold: 0.08 }
  );
  headerObserver.observe(hero);

  const heroLightObserver = new IntersectionObserver(
    ([entry]) => hero.classList.toggle("is-lit", entry.intersectionRatio < 0.82),
    { threshold: [0.35, 0.55, 0.72, 0.82, 1] }
  );
  heroLightObserver.observe(hero);
}

const revealItems = document.querySelectorAll(".reveal");

if (prefersReducedMotion) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -6%" }
  );
  revealItems.forEach((item) => revealObserver.observe(item));
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

const processCards = document.querySelectorAll(".process-card");

if (processCards.length && !prefersReducedMotion) {
  const processObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("is-current", entry.isIntersecting));
    },
    { rootMargin: "-30% 0px -38%", threshold: 0.2 }
  );
  processCards.forEach((card) => processObserver.observe(card));
}

document.querySelectorAll("[data-accordion]").forEach((accordion) => {
  const items = accordion.querySelectorAll("details");
  items.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      items.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });
});

const videoFrame = document.querySelector("[data-video-frame]");
const videoTrigger = document.querySelector("[data-video-trigger]");
const videoStatus = document.querySelector("[data-video-status]");

if (videoFrame && videoTrigger) {
  videoTrigger.addEventListener("click", () => {
    if (!VIDEO_ID) {
      if (videoStatus) videoStatus.hidden = false;
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1`;
    iframe.title = "The Presage 60/40 retention model";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    videoFrame.replaceChildren(iframe);
  });
}

const showcase = document.querySelector("[data-showcase]");
const showcaseToggle = document.querySelector("[data-showcase-toggle]");

if (showcase && showcaseToggle) {
  if (prefersReducedMotion) {
    showcase.classList.add("is-paused");
    showcaseToggle.textContent = "Motion disabled";
    showcaseToggle.disabled = true;
  } else {
    showcaseToggle.addEventListener("click", () => {
      const paused = showcase.classList.toggle("is-paused");
      showcaseToggle.setAttribute("aria-pressed", String(paused));
      showcaseToggle.textContent = paused ? "Play motion" : "Pause motion";
    });
  }
}
