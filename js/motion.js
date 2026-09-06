/* ServiceMomentum motion layer.
 *
 * Purpose: make the *system* legible. Each animation stands for something real
 * The connected path through the seven stages, the four lifecycle steps in
 * sequence, one fictional service journey through the hero dashboard, the
 * case-study timeline growing as milestones are reached. Nothing here invents a
 * statistic, presents demo records as live data, hijacks the scroll, or moves
 * anything in the layout: only opacity and transform change.
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

  /* ---- One fictional service journey through the hero composition.
     Seven beats, in order: the website request is received, the lead appears
     as New, the next record is Booked, the next is Done, a review request is
     marked ready, a next-service date is set, and the customer turns up in
     Due for service.

     It runs ONCE, on first entry, and settles into the finished state. Every
     element it reveals is already in the markup, so nothing here is required
     for the information to be readable: styles.css hides the beats only under
     .motion, and the inline <head> script drops that class when this file
     never loads or when the visitor asks for reduced motion.

     If the composition leaves the viewport mid-sequence the remaining beats
     are applied immediately rather than animated off-screen, and the
     observer is already disconnected, so it never restarts. ---- */
  var journeyStack = document.querySelector(".stack");
  if (journeyStack) {
    var BEATS = 7;
    var BEAT_MS = 480;
    var beatEl = function (n) {
      return all('.jrn[data-beat="' + n + '"]', journeyStack);
    };
    var jTimers = [];
    var jStarted = false;
    var jSettled = false;
    var showBeat = function (n) {
      beatEl(n).forEach(function (el) {
        el.classList.add("is-on");
      });
    };
    var settleJourney = function () {
      if (jSettled) return;
      jSettled = true;
      jTimers.forEach(clearTimeout);
      jTimers = [];
      // The class comes first: it also switches the transition off, so a
      // settle that skips the sequence is an instant cut, never a fade.
      journeyStack.classList.add("journey-done"); // stable final state
      for (var n = 1; n <= BEATS; n++) showBeat(n);
    };
    var runJourney = function () {
      jStarted = true;
      for (var n = 1; n <= BEATS; n++) {
        (function (beat) {
          jTimers.push(
            setTimeout(function () {
              showBeat(beat);
              if (beat === BEATS) {
                jTimers.push(setTimeout(settleJourney, BEAT_MS));
              }
            }, beat * BEAT_MS)
          );
        })(n);
      }
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
    /* Last resort. If the observer never reports an intersection (a background
       tab that is never brought forward, an engine that stalls it), the
       records must not sit invisible behind a sequence that never starts.
       This mirrors the 2.5s fail-open in the inline <head> script. */
    setTimeout(function () {
      if (!jStarted) settleJourney();
    }, 3000);
    // Once started, leaving the viewport finishes the sequence instead of
    // animating where nobody can see it.
    var offscreenIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting && jTimers.length) {
            settleJourney();
            offscreenIO.disconnect();
          }
        });
      },
      { threshold: 0 }
    );
    offscreenIO.observe(journeyStack);
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
