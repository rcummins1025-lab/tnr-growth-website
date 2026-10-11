/* Service Momentum page behaviour: hero video controls and scroll reveal.
 * Everything here fails open. If this file never loads, the video still
 * autoplays muted (or shows its poster) and every section stays visible.
 */
(function () {
  "use strict";

  document.documentElement.setAttribute("data-site-ready", "1");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Hero loop: muted background video with a pause button (WCAG 2.2.2).
   * With reduced motion it starts paused on its poster frame. */
  var video = document.getElementById("hero-video");
  var toggle = document.getElementById("hero-video-toggle");
  function setPaused(paused) {
    if (!video || !toggle) return;
    toggle.setAttribute("aria-pressed", paused ? "true" : "false");
    toggle.setAttribute("aria-label", paused ? "Play background video" : "Pause background video");
  }
  if (video) {
    if (reduce) {
      video.removeAttribute("autoplay");
      video.pause();
      setPaused(true);
    } else {
      // Some browsers ignore the attribute until muted is set as a property.
      video.muted = true;
      var p = video.play && video.play();
      if (p && p.catch) p.catch(function () { setPaused(true); });
    }
    video.addEventListener("pause", function () { setPaused(true); });
    video.addEventListener("play", function () { setPaused(false); });
  }
  if (toggle && video) {
    toggle.addEventListener("click", function () {
      if (video.paused) video.play();
      else video.pause();
    });
  }

  /* Only one video plays at a time: starting the main video pauses the loop. */
  var media = Array.prototype.slice.call(document.querySelectorAll("video[controls]"));
  media.forEach(function (v) {
    v.addEventListener("play", function () {
      if (video && !video.paused) video.pause();
    });
  });

  /* Scroll reveal. Skipped entirely with reduced motion or no observer. */
  var items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  items.forEach(function (el) { io.observe(el); });
})();
