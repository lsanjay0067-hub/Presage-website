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

if (hero) {
  requestAnimationFrame(() => hero.classList.add("is-lit"));
}

if (header && hero) {
  const headerObserver = new IntersectionObserver(
    ([entry]) => header.classList.toggle("is-scrolled", !entry.isIntersecting),
    { threshold: 0.08 }
  );
  headerObserver.observe(hero);
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
