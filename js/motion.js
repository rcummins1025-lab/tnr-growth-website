/* ServiceMomentum motion layer.
 *
 * Purpose: make the *system* legible. Each animation stands for something real
 * The connected path through the seven stages, the four lifecycle steps in
 * sequence, an illustrative walk through the dashboard's stages, the case-study
 * timeline growing as milestones are reached. Nothing here invents a statistic,
 * implies live data, hijacks the scroll, or moves anything in the layout: only
 * opacity and transform change.
 *
 * No dependencies. IntersectionObserver only, with no scroll or resize listeners.
 *
 * Gate: <html class="motion">, set by the inline <head> script only when
 * JavaScript is running AND prefers-reduced-motion is not "reduce". This file
 * sets data-motion-ready="1"; if it never loads, that inline script drops the
 * class again so nothing is left hidden. All initial hidden states live in
 * styles.css behind ".motion", so they apply on the first paint (no flash).
 */
(function () {
  "use strict";

  var root = document.documentElement;
  if (!root.classList.contains("motion")) return;
  if (!("IntersectionObserver" in window)) {
    root.classList.remove("motion"); // fail open: show everything, unanimated
    return;
  }
  root.setAttribute("data-motion-ready", "1");

  /* Keep in sync with the shared reveal selector list in styles.css. */
  var REVEAL_SELECTOR = [
    ".band-head",
    ".flow-step",
    ".pillar > *",
    ".cta-band > .container > *",
    ".learn li",
    ".fit",
    ".nofit",
    ".faq details",
    ".note-callout",
    ".cs-side > *"
  ].join(",");

  var all = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };
  var setIndex = function (el, i) {
    el.style.setProperty("--i", String(Math.min(i, 9)));
  };

  /* ---------------------------------------------------------------- reveal */
  var revealIO = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        revealIO.unobserve(e.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );

  var targets = all(REVEAL_SELECTOR);
  var seenPerParent = new Map();
  targets.forEach(function (el) {
    var p = el.parentNode;
    var i = seenPerParent.get(p) || 0;
    seenPerParent.set(p, i + 1);
    setIndex(el, i);
    revealIO.observe(el);
  });

  /* ------------------------------------------------- hero: entry on arrival */
  var heroCopy = document.querySelector(".hero-copy");
  if (heroCopy) {
    all(":scope > *", heroCopy).forEach(setIndex);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        heroCopy.classList.add("is-in");
      });
    });
  }

  /* ------------------- hero product composition: panes settle, path draws --- */
  var stack = document.querySelector(".stack");
  if (stack) {
    all(".pane", stack).forEach(setIndex);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        stack.classList.add("is-in");
      });
    });
  }

  /* ------------------------ outcome flow: the amber rule draws across ------ */
  var flow = document.querySelector(".flow");
  if (flow) {
    var flowIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          flow.classList.add("is-in");
          flowIO.disconnect();
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );
    flowIO.observe(flow);
  }

  /* --------------------- the connected system path, traced through its stages */
  var sysrows = document.querySelector(".sysrows");
  if (sysrows) {
    all(".sysrow", sysrows).forEach(setIndex);
    var panel = sysrows.closest(".syspanel");
    var startSys = function () {
      if (panel) panel.classList.add("is-in");
      sysrows.classList.add("is-in");
    };
    // The panel sits in the hero, so it is normally on screen at load; observe
    // it anyway so a deep-linked or scrolled-down entry still plays in view.
    var sysIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          startSys();
          sysIO.disconnect();
        });
      },
      { threshold: 0.2 }
    );
    sysIO.observe(sysrows);
  }

  /* ------------------------------------- lifecycle steps, revealed in order */
  var strip = document.querySelector(".process-strip");
  if (strip) {
    all(".pstep", strip).forEach(setIndex);
    var stripIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          strip.classList.add("is-in");
          stripIO.disconnect();
        });
      },
      { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
    );
    stripIO.observe(strip);
  }

  /* ---- illustrative dashboard walk-through: New -> Booked -> Done -> Due.
     A one-pass illustration of the stages a job moves through. It is labelled
     as a redacted sample in the markup and is NOT live data; it replays only
     if the visitor scrolls away and comes back. ---- */
  var mock = document.querySelector(".ui-mock");
  if (mock) {
    var rows = all(".ui-row", mock);
    var timer = null;
    var running = false;
    var stop = function () {
      if (timer) clearTimeout(timer);
      timer = null;
      running = false;
    };
    var settle = function () {
      rows.forEach(function (r) {
        r.classList.remove("is-active");
        r.classList.add("is-settled");
      });
      running = false;
    };
    var step = function (i) {
      rows.forEach(function (r, j) {
        r.classList.toggle("is-active", j === i);
        if (j <= i) r.classList.add("is-settled");
      });
      if (i + 1 < rows.length) {
        timer = setTimeout(function () {
          step(i + 1);
        }, 900);
      } else {
        timer = setTimeout(settle, 900);
      }
    };
    var mockIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            if (!running) {
              running = true;
              step(0);
            }
          } else {
            stop(); // never animate off-screen
          }
        });
      },
      { threshold: 0.35 }
    );
    mockIO.observe(mock);
  }

  /* ------------- case-study timeline: grows as its milestones are revealed */
  var timeline = document.querySelector(".timeline");
  if (timeline) {
    var items = all("li", timeline);
    var reached = 0;
    var tlIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          tlIO.unobserve(e.target);
          reached = Math.max(reached, items.indexOf(e.target) + 1);
          timeline.style.setProperty(
            "--progress",
            String(reached / items.length)
          );
        });
      },
      { threshold: 0.4, rootMargin: "0px 0px -10% 0px" }
    );
    items.forEach(function (li) {
      tlIO.observe(li);
    });
  }

  /* ------------------------------ header lifts once the page has scrolled */
  var header = document.querySelector(".site-header");
  if (header && document.body) {
    var sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;";
    document.body.insertBefore(sentinel, document.body.firstChild);
    new IntersectionObserver(function (entries) {
      header.classList.toggle("is-scrolled", !entries[0].isIntersecting);
    }).observe(sentinel);
  }
})();
