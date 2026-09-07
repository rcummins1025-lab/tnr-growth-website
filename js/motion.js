/* ServiceMomentum motion layer.
 *
 * Purpose: make the *system* legible. Each animation stands for something real
 * The connected path through the seven stages, the four lifecycle steps in
 * sequence, one fictional service journey through the hero dashboard. Nothing
 * here invents a statistic, presents demo records as live data, hijacks the
 * scroll, or moves anything in the layout: only opacity and transform change.
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
    ".proof",
    ".accuracy"
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

  /* ---- One fictional service journey through the hero composition.
     Seven steps, in order: the website request is received, the lead appears
     as New, the next record is Booked, the next is Done, a review request is
     marked ready, a next-service date is set, and the customer turns up in
     Due for service.

     This HIGHLIGHTS rows that are already on screen. The dashboard is fully
     populated by the static markup at first paint, so nothing here is needed
     for the information to be readable: with this file blocked, with
     JavaScript off, or under reduced motion, the finished dashboard is simply
     what renders. All this adds is a ring that moves through the steps once,
     within JOURNEY_MAX_MS, and then goes out for good.

     It runs once, on first entry. Leaving the viewport clears it immediately
     rather than tracing where nobody can see it, and the observer is already
     disconnected, so it never restarts. ---- */
  var journeyStack = document.querySelector(".stack");
  if (journeyStack) {
    var BEATS = 7;
    var BEAT_MS = 300;
    var JOURNEY_MAX_MS = 2500; // hard ceiling for the whole sequence
    var jTimers = [];
    var jDone = false;
    var lit = function (n) {
      all(".jrn", journeyStack).forEach(function (el) {
        el.classList.toggle("is-lit", n !== 0 && el.getAttribute("data-beat") === String(n));
      });
    };
    var endJourney = function () {
      if (jDone) return;
      jDone = true;
      jTimers.forEach(clearTimeout);
      jTimers = [];
      lit(0); // ring off; the dashboard is unchanged underneath
      journeyStack.classList.add("journey-done");
    };
    var runJourney = function () {
      for (var n = 1; n <= BEATS; n++) {
        (function (beat) {
          jTimers.push(
            setTimeout(function () {
              lit(beat);
            }, (beat - 1) * BEAT_MS)
          );
        })(n);
      }
      // Never longer than the ceiling, whatever the beat count.
      jTimers.push(setTimeout(endJourney, JOURNEY_MAX_MS));
    };
    var journeyIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            journeyIO.disconnect(); // once only; never replays
            runJourney();
          }
        });
      },
      { threshold: 0.25 }
    );
    journeyIO.observe(journeyStack);
    // Leaving the viewport ends it rather than tracing off-screen.
    var offscreenIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting && jTimers.length) {
            endJourney();
            offscreenIO.disconnect();
          }
        });
      },
      { threshold: 0 }
    );
    offscreenIO.observe(journeyStack);
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
