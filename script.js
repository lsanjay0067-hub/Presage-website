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

// ---------- hero backdrop ----------
// The email wall, light leak, vignette, bottom fade and grain are painted on
// one <canvas> rather than as a dozen full-density composited layers. The
// backing store is capped at the stitched images' own resolution, so it costs
// a few MB regardless of screen density. It only paints while the hero is on
// screen, the tab is visible and no modal is open.
const wall = document.querySelector("[data-wall]");
let heroIdle = false;
let wallKick = () => {};

if (wall && wall.getContext) {
  const ctx = wall.getContext("2d", { alpha: true });
  const SRC_W = 340; // stitched column image width in px
  const ALPHA = 0.28;
  const MAX_PIXELS = 2e6;
  const images = wall.dataset.srcs.split(" ").map((src, i) => {
    const img = new Image();
    img.decoding = "async";
    if (i < 2) img.fetchPriority = "high";
    img.onload = () => { img.ready = true; wallKick(true); };
    img.src = src;
    return img;
  });
  const atmos = new Image();
  atmos.decoding = "async";
  atmos.onload = () => { atmos.ready = true; wallKick(true); };
  atmos.src = wall.dataset.atmos;

  // Fine static grain: a small tile of white specks with random alpha.
  const grainTile = document.createElement("canvas");
  grainTile.width = grainTile.height = 128;
  const grainCtx = grainTile.getContext("2d");
  const grainData = grainCtx.createImageData(128, 128);
  for (let i = 0; i < grainData.data.length; i += 4) {
    grainData.data[i] = grainData.data[i + 1] = grainData.data[i + 2] = 255;
    grainData.data[i + 3] = Math.random() * 140;
  }
  grainCtx.putImageData(grainData, 0, 0);
  const grain = ctx.createPattern(grainTile, "repeat");

  let cols = 5, gap = 18, colW = 0, scale = 1, loopSeconds = 46;
  let elapsed = 0, last = 0, raf = 0, released = false;

  const measure = () => {
    const root = getComputedStyle(document.documentElement);
    cols = parseInt(root.getPropertyValue("--wall-cols"), 10) || 5;
    gap = parseFloat(root.getPropertyValue("--wall-gap")) || 18;
    loopSeconds = parseFloat(root.getPropertyValue("--wall-speed")) || 46;
    const width = wall.clientWidth;
    const height = wall.clientHeight;
    colW = (width - (cols - 1) * gap) / cols;
    // Never store more pixels than the source images hold or the screen shows,
    // and never more than about two million in total, so a very large monitor
    // costs the same as a laptop.
    scale = Math.min(window.devicePixelRatio || 1, Math.max(1, SRC_W / colW), 1.5);
    scale = Math.min(scale, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    if (wall.width !== w || wall.height !== h) {
      wall.width = w;
      wall.height = h;
    }
  };

  const paint = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, wall.clientWidth, wall.clientHeight);
    ctx.globalAlpha = ALPHA;
    const height = wall.clientHeight;
    const progress = (elapsed / loopSeconds) % 1;
    for (let i = 0; i < cols; i += 1) {
      const img = images[i];
      if (!img || !img.ready) continue;
      const loopH = (img.naturalHeight / img.naturalWidth) * colW;
      // Even columns drift down, odd columns drift up.
      const shift = (i % 2 === 0 ? 1 - progress : progress) * loopH;
      const x = i * (colW + gap);
      for (let y = -shift; y < height; y += loopH) ctx.drawImage(img, x, y, colW, loopH);
    }
    const width = wall.clientWidth;
    ctx.globalAlpha = 1;
    // Light leak, vignette and the fade into the page colour, stretched to
    // the hero exactly as the percentage-based CSS gradients were.
    if (atmos.ready) ctx.drawImage(atmos, 0, 0, width, height);
    // Grain at one speck per backing pixel.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, wall.width, wall.height);
  };

  const running = () => !prefersReducedMotion && !heroIdle && !document.hidden && !document.body.classList.contains("has-modal");
  const frame = (now) => {
    raf = 0;
    if (!running()) { last = 0; return; }
    if (last) elapsed += Math.min(0.1, (now - last) / 1000);
    last = now;
    paint();
    raf = requestAnimationFrame(frame);
  };
  wallKick = (repaint) => {
    if (released) return;
    if (repaint && !raf) paint();
    if (!raf && running()) raf = requestAnimationFrame(frame);
  };

  // Far from the hero the canvas gives its pixels back entirely; it is
  // re-created and painted again before the hero scrolls back into view.
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting === !released) return;
      released = !entry.isIntersecting;
      if (released) {
        wall.width = wall.height = 1;
      } else {
        measure();
        wallKick(true);
      }
    }, { rootMargin: "700px 0px" }).observe(hero);
  }

  let resizeQueued = false;
  window.addEventListener("resize", () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      if (released) return;
      measure();
      wallKick(true);
    });
  });
  measure();
  wallKick(true);
}

// Stop painting the wall whenever the hero is off-screen or the tab is hidden.
if (hero) {
  const setIdle = (idle) => {
    heroIdle = idle;
    hero.classList.toggle("is-idle", idle);
    wallKick();
  };
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
    wallKick();
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

// ---------- horizontal email strip: pause when out of view ----------
const strip = document.querySelector("[data-strip]");
if (strip && "IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => strip.classList.toggle("is-idle", !entry.isIntersecting), { threshold: 0 }).observe(strip);
}

// ---------- hero: content fades out as it scrolls away ----------
// Writes opacity/transform straight onto the two layers (compositor-only
// properties) instead of a custom property that restyles the whole hero.
if (hero && !prefersReducedMotion) {
  const heroInner = hero.querySelector(".hero-inner");
  const heroBackdrop = hero.querySelector(".hero-wall");
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
    if (heroBackdrop) heroBackdrop.style.opacity = String(1 - fade * 0.85);
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

// ---------- hero client logos: one set, cloned to fill the screen, looping right to left ----------
const logos = document.querySelector("[data-logos]");
if (logos && !prefersReducedMotion) {
  const track = logos.firstElementChild;
  const set = [...track.children];
  logos.classList.add("is-moving");
  const fit = () => {
    const one = track.offsetWidth / (track.children.length / set.length);
    while (track.offsetWidth < window.innerWidth + one) {
      set.forEach((img) => {
        const copy = img.cloneNode();
        copy.alt = "";
        copy.setAttribute("aria-hidden", "true");
        track.append(copy);
      });
    }
    track.style.setProperty("--logos-set", `${one}px`);
    track.style.setProperty("--logos-time", `${one / 36}s`);
  };
  fit();
  window.addEventListener("resize", fit);
}

// ---------- customer journey: rails split, merge and light on scroll, like the 60-days rail ----------
const journey = document.querySelector("[data-journey]");
if (journey) {
  const svg = journey.querySelector("svg");
  const nodes = Object.fromEntries([...journey.querySelectorAll("[data-node]")].map((n) => [n.dataset.node, n]));
  const edges = Object.values(nodes).flatMap((from) =>
    (from.dataset.to || "").split(" ").filter(Boolean).map((to) => ({ from, to: nodes[to] })));
  let ticking = false;
  let watching = false;

  const paint = () => {
    ticking = false;
    const top = journey.getBoundingClientRect().top;
    const line = prefersReducedMotion ? Infinity : window.innerHeight * 0.62 - top;
    edges.forEach((e) => {
      e.fill.style.strokeDashoffset = 1 - Math.min(1, Math.max(0, (line - e.y1) / (e.y2 - e.y1)));
    });
    Object.values(nodes).forEach((n) => {
      const box = n.getBoundingClientRect();
      n.classList.toggle("is-lit", box.top + box.height / 2 - top <= line);
    });
  };

  // Square rails with rounded corners: a split turns just below its parent,
  // a merge just above its child, so lines leave and arrive together.
  const draw = () => {
    const box = journey.getBoundingClientRect();
    let paths = "";
    edges.forEach((e) => {
      const a = e.from.getBoundingClientRect();
      const b = e.to.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - box.left;
      const x2 = b.left + b.width / 2 - box.left;
      e.y1 = a.bottom - box.top;
      e.y2 = b.top - box.top;
      const merge = edges.filter((o) => o.to === e.to).length > 1;
      const split = e.from.dataset.to.includes(" ");
      const my = merge ? e.y2 - 28 : split ? e.y1 + 28 : (e.y1 + e.y2) / 2;
      const dx = Math.sign(x2 - x1);
      const r = Math.min(20, Math.abs(x2 - x1) / 2);
      const d = dx
        ? `M${x1} ${e.y1}V${my - r}Q${x1} ${my} ${x1 + dx * r} ${my}H${x2 - dx * r}Q${x2} ${my} ${x2} ${my + r}V${e.y2}`
        : `M${x1} ${e.y1}V${e.y2}`;
      paths += `<path d="${d}"/><path class="is-fill" d="${d}" pathLength="1"/>`;
    });
    svg.innerHTML = paths;
    svg.querySelectorAll(".is-fill").forEach((path, i) => { edges[i].fill = path; });
    paint();
  };

  const request = () => {
    if (!watching || ticking) return;
    ticking = true;
    requestAnimationFrame(paint);
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      watching = entry.isIntersecting;
      if (watching) draw(); // re-measure in case anything above changed height
    }, { rootMargin: "20% 0px 20% 0px" }).observe(journey);
  } else {
    watching = true;
  }

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", draw);
  draw();
}

// ---------- retention calculator ----------
const calc = document.querySelector("[data-calc]");
if (calc) {
  const inputs = [...calc.querySelectorAll("input")];
  const pips = calc.querySelector("[data-pips]");
  const out = Object.fromEntries([...calc.querySelectorAll("[data-out]")].map((el) => [el.dataset.out, el]));
  const money = (n) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
  const when = (order, freq) => (order <= 1 ? "On the first purchase" : `~${Math.round(((order - 1) / freq) * 12)} months after first order`);

  const update = () => {
    const v = {};
    inputs.forEach((el) => {
      v[el.name] = Number(el.value);
      el.style.setProperty("--p", `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
      const o = el.previousElementSibling.querySelector("output");
      o.textContent = o.dataset.unit === "$" ? `$${el.value}` : el.value + o.dataset.unit;
    });
    const perOrder = (v.aov * v.margin) / 100;
    const even = Math.ceil(v.cac / perOrder);
    const comp = Math.ceil((3 * v.cac) / perOrder); // 3:1 LTV:CAC, the usual healthy benchmark
    const orders = v.freq * v.life;
    const kept = Math.floor(orders);
    const ratio = (orders * perOrder) / v.cac;
    const short = Math.max(1, comp - kept);

    out.even.textContent = `Order ${even}`;
    out.evenWhen.textContent = when(even, v.freq);
    out.comp.textContent = `Order ${comp}`;
    out.compWhen.textContent = when(comp, v.freq);
    out.rev.textContent = money(orders * v.aov);
    out.orders.textContent = `${orders.toFixed(1)} orders over ${v.life} yr`;
    out.profit.textContent = money(orders * perOrder - v.cac);
    out.ratio.textContent = `${ratio.toFixed(1)}× LTV:CAC`;
    out.note.textContent = ratio >= 3
      ? `Your customers stay long enough to compound. Every order after ${comp} is the retention program paying for itself.`
      : ratio >= 1
        ? `You break even, but customers leave ${short} order${short > 1 ? "s" : ""} short of compounding. That gap is what retention closes.`
        : "Customers leave before paying back what it cost to acquire them. Retention is the difference between a loss and a profit here.";

    const count = Math.min(24, Math.max(comp, kept, even) + 1);
    pips.innerHTML = Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      const state = n > kept ? "lost" : n < even ? "paid" : n === even ? "even" : "profit";
      return `<li class="is-${state}"></li>`;
    }).join("");
  };

  calc.addEventListener("input", update);
  update();
}

// ---------- testimonials: illustrated avatars drawn from each card's unique id ----------
// The same id always draws the same face, so a person keeps their portrait.
const avatar = (id) => {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const pick = (list) => { const v = list[h % list.length]; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; return v; };
  const bg = pick(["#1f3a2c", "#24324a", "#3a2f24", "#2d2440", "#1d3b3f"]);
  const skin = pick(["#f1c9a5", "#e0ac83", "#c68c5f", "#a86f45", "#7c4a2d"]);
  const hairTone = pick(["#1c1410", "#4a2f1c", "#8a5a2b", "#c9a46a", "#5b5b5b"]);
  const shirt = pick(["#bdf7b8", "#e8e8e8", "#7fb8a8", "#d9b38c", "#9ab0d6"]);
  const hair = [
    `<path d="M19 29c0-9 6-15 13-15s13 6 13 15c-3-5-7-7-13-7s-10 2-13 7z" fill="${hairTone}"/>`,
    `<path d="M19 30c-1-10 6-16 14-16 7 0 12 5 12 12l-1 3c-2-4-8-7-16-6-4 1-7 3-9 7z" fill="${hairTone}"/>`,
    `<path d="M20.5 26a11.5 11.5 0 0 1 23 0c-4-3-19-3-23 0z" fill="${hairTone}"/>`,
    `<g fill="${hairTone}"><circle cx="22" cy="22" r="5"/><circle cx="29" cy="17" r="5.5"/><circle cx="36" cy="17" r="5.5"/><circle cx="42" cy="22" r="5"/></g>`,
  ][h % 4];
  const beard = h & 16 ? `<path d="M22 31c1 7 5 10 10 10s9-3 10-10c-2 3-6 4-10 4s-8-1-10-4z" fill="${hairTone}"/>` : "";
  const glasses = h & 32 ? `<g fill="none" stroke="#111" stroke-width="1.3"><circle cx="27.5" cy="29" r="3.2"/><circle cx="36.5" cy="29" r="3.2"/><path d="M30.7 29h2.6"/></g>` : "";
  return `<svg viewBox="8 10 48 48"><rect width="64" height="64" fill="${bg}"/>`
    + `<path d="M10 64c2-12 11-18 22-18s20 6 22 18z" fill="${shirt}"/><rect x="28" y="38" width="8" height="10" rx="3" fill="${skin}"/>`
    + `<circle cx="32" cy="29" r="12" fill="${skin}"/>${hair}${beard}`
    + `<g fill="#111"><circle cx="27.5" cy="29.5" r="1.2"/><circle cx="36.5" cy="29.5" r="1.2"/></g>`
    + `<path d="M28.5 35c2 1.6 5 1.6 7 0" fill="none" stroke="#5a3424" stroke-width="1.2" stroke-linecap="round"/>${glasses}</svg>`;
};
document.querySelectorAll("[data-avatar]").forEach((el) => { el.innerHTML = avatar(el.dataset.avatar); });

// Floating cards only animate while the section is near the screen.
const proof = document.querySelector(".proof-section");
if (proof && "IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => proof.classList.toggle("is-near", entry.isIntersecting), { rootMargin: "20% 0px" }).observe(proof);
} else if (proof) {
  proof.classList.add("is-near");
}
