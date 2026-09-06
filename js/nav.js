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

  var toggle = document.getElementById("nav-toggle");
  var panel = document.getElementById("nav-links");
  if (!toggle || !panel) return;

  var MQ = "(max-width: 860px)";
  var mq = window.matchMedia ? window.matchMedia(MQ) : null;
  var isMobile = function () {
    return mq ? mq.matches : false;
  };

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
