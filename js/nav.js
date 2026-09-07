/* ServiceMomentum compact mobile navigation.
 *
 * Deliberately NOT behind the motion gate: the menu is how a phone visitor
 * reaches the rest of the site, so it must work with reduced motion, and it
 * must never depend on js/motion.js having loaded.
 *
 * The list is a plain <ul> that CSS collapses only below the mobile breakpoint.
 * With JavaScript off, the toggle is hidden and the list renders normally.
 */
(function () {
  "use strict";

  /* The compact-menu width lives in the stylesheet as --nav-compact-max and is
   * read back here, so the panel's outside-click behaviour can never drift
   * from the width at which CSS actually collapses the menu. */
  function compactMaxPx() {
    var declared = getComputedStyle(document.documentElement)
      .getPropertyValue("--nav-compact-max")
      .trim();
    var n = parseInt(declared, 10);
    return n > 0 ? n : 1167;
  }

  var toggle = document.getElementById("nav-toggle");
  var panel = document.getElementById("nav-links");

  var MQ = "(max-width: " + compactMaxPx() + "px)";
  var mq = window.matchMedia ? window.matchMedia(MQ) : null;
  var isMobile = function () {
    return mq ? mq.matches : false;
  };

  /* ---------------------------------------------------------------------
   * Phone-only sticky audit CTA.
   *
   * NOT behind the motion gate: it is a navigation affordance, so it must
   * still work when a visitor asks for reduced motion. It ships hidden in the
   * markup and is only ever revealed here, which means a blocked or failed
   * script leaves nothing on screen that the page needs.
   *
   * It shows in exactly one band: after the hero has scrolled away and before
   * the closing CTA arrives. That keeps it off the real button and off the
   * footer's legal links, so it never covers anything. IntersectionObserver
   * only, no scroll listener. contact.html carries no such element, so the
   * audit itself never gets a sticky bar over its controls.
   * ------------------------------------------------------------------- */
  var sticky = document.getElementById("sticky-cta");
  if (sticky && "IntersectionObserver" in window) {
    var hero = document.querySelector(".hero-v3");
    var closing = document.querySelector(".cta-band");
    var pastHero = false;
    var atClosing = false;
    var sync = function () {
      sticky.hidden = !(pastHero && !atClosing);
    };
    if (hero) {
      new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            pastHero = !e.isIntersecting;
          });
          sync();
        },
        { threshold: 0 }
      ).observe(hero);
    }
    if (closing) {
      new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            atClosing = e.isIntersecting;
          });
          sync();
        },
        { threshold: 0 }
      ).observe(closing);
    }
  }

  if (!toggle || !panel) return;

  function setOpen(open) {
    panel.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function close() {
    if (toggle.getAttribute("aria-expanded") === "true") setOpen(false);
  }

  toggle.addEventListener("click", function () {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  // Following a link closes the menu (same-page anchors do not reload).
  panel.addEventListener("click", function (e) {
    if (e.target.closest("a")) close();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    close();
    toggle.focus();
  });

  document.addEventListener("click", function (e) {
    if (!isMobile()) return;
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (e.target.closest("#nav-links") || e.target.closest("#nav-toggle")) return;
    close();
  });

  // Widening past the breakpoint must not leave the panel in a half state.
  if (mq) {
    var onChange = function () {
      if (!mq.matches) close();
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();
