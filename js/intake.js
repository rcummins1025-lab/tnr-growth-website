/* ServiceMomentum Growth System Audit (guided one-question-per-screen wizard).
 * Self-contained, no dependencies, no tracking, no analytics.
 * Submission goes ONLY to window.TNR_CONFIG.formEndpoint. If that is empty,
 * the form never fakes success. It clearly says it is not connected yet.
 */
(function () {
  "use strict";

  var form = document.getElementById("audit-form");
  if (!form) return;

  var cfg = window.TNR_CONFIG || {};

  // How the POST body is encoded. Documented in js/site-config.js.
  // Spam trap. A matching hidden input sits in the markup; humans never see or
  // tab to it, so anything in it means a bot filled the form. Formspree also
  // treats "_gotcha" this way server-side. This is the client half.
  var HONEYPOT = "_gotcha";

  /* Referral attribution. A link such as contact.html?source=referral records
   * "referral" alongside the submission so we can tell where an applicant came
   * from. Deliberately minimal: one query parameter, sanitised, with a plain
   * "direct" fallback. No cookie, no localStorage, no fingerprinting, no
   * third-party analytics, and the referring page URL is never read. The value
   * is only ever assigned to a hidden input's .value, never written into the
   * page as markup. */
  var REFERRAL_FALLBACK = "direct";
  var REFERRAL_MAX = 80;
  var REFERRAL_ALLOWED = /^[A-Za-z0-9 ._-]+$/;

  function referralSource() {
    var raw = "";
    try {
      raw = new URLSearchParams(window.location.search).get("source") || "";
    } catch (e) {
      return REFERRAL_FALLBACK; // no URLSearchParams, or a malformed query
    }
    var v = String(raw).replace(/\s+/g, " ").trim();
    if (!v || v.length > REFERRAL_MAX) return REFERRAL_FALLBACK;
    if (!REFERRAL_ALLOWED.test(v)) return REFERRAL_FALLBACK;
    return v;
  }

  var MODES = { json: 1, formspree: 1 };
  var mode = String(cfg.formEndpointMode || "json").toLowerCase();
  if (!MODES[mode]) {
    if (window.console && console.warn) {
      console.warn(
        'site-config: unknown formEndpointMode "' +
          cfg.formEndpointMode +
          '", so the form is falling back to "json". Valid values: json, formspree.'
      );
    }
    mode = "json";
  }

  var steps = Array.prototype.slice.call(form.querySelectorAll(".form-step"));
  // The wizard's progress bar and step counter live in the page chrome, above
  // the form, so these are looked up document-wide rather than within the form.
  var progressFill =
    form.querySelector(".progress-fill") || document.querySelector(".progress-fill");
  var stepDots = Array.prototype.slice.call(form.querySelectorAll(".stepper .sdot"));
  var progressLabel =
    form.querySelector(".progress-label") || document.querySelector(".progress-label");
  var status = document.getElementById("form-status");
  var backBtn = document.getElementById("btn-back");
  var nextBtn = document.getElementById("btn-next");
  var submitBtn = document.getElementById("btn-submit");
  // Confirmation panel. It ships hidden in contact.html and is only ever
  // unhidden by succeed(), which only ever runs on a real 2xx response.
  var successPanel = document.getElementById("audit-success");
  var successHeading = document.getElementById("audit-success-title");
  var navWrap = form.querySelector(".wz-nav");
  var current = 0;

  var REQUEST_TIMEOUT_MS = 20000;
  // How long the chosen tile stays visible before the wizard advances. Under a
  // reduced-motion preference we still pause briefly so the selection is
  // perceivable. We just don't animate the transition.
  var ADVANCE_PAUSE_MS = 420;
  var ADVANCE_PAUSE_REDUCED_MS = 140;
  function prefersReducedMotion() {
    return !!(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function supportEmail() {
    return cfg.email || "hello@tnrgrowthagency.com";
  }

  // Restoring the button after a failed send must put back the label that
  // contact.html actually ships ("Submit audit"). It used to restore a
  // different string, which silently renamed the control after any error.
  // scripts/validate.mjs compares this literal with the markup.
  var SUBMIT_IDLE_LABEL = "Submit audit";

  function setSending(on) {
    submitBtn.disabled = on;
    submitBtn.textContent = on ? "Sending…" : SUBMIT_IDLE_LABEL;
    if (backBtn) backBtn.disabled = on;
  }

  /* The endpoint must be an absolute HTTPS URL, and must never be the
   * tenant-scoped client-booking backend. That one derives its tenant from a
   * server-side secret and must not receive T&R's own agency leads. Plain http
   * is allowed only for a local mock during development (see
   * scripts/mock-endpoint.mjs), never from a page served over https. */
  function endpointIsSafe(url) {
    var u;
    try {
      u = new URL(url);
    } catch (e) {
      warn("formEndpoint is not a valid absolute URL: " + url);
      return false;
    }
    var localhost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(u.protocol === "http:" && localhost)) {
      warn("formEndpoint must be https (http is only allowed for localhost).");
      return false;
    }
    if (location.protocol === "https:" && u.protocol !== "https:") {
      warn("Refusing to post from an https page to a non-https endpoint.");
      return false;
    }
    if (/zentradesk|middleware/i.test(u.hostname + u.pathname)) {
      warn(
        "formEndpoint looks like the tenant-scoped client-booking backend. " +
          "Agency leads must go to a separate endpoint. See docs/CONTACT-FORM.md."
      );
      return false;
    }
    return true;
  }

  function warn(msg) {
    if (window.console && console.warn) console.warn("site-config: " + msg);
  }

  function setStatus(kind, msg) {
    if (!status) return;
    status.className = "form-status " + kind;
    status.textContent = msg;
    status.hidden = false;
  }
  function clearStatus() {
    if (status) status.hidden = true;
  }

  function showStep(i, moveFocus) {
    clearTimeout(advanceTimer);
    pointerCommit = false;
    steps.forEach(function (s, idx) {
      s.hidden = idx !== i;
    });
    current = i;
    var pct = Math.round(((i + 1) / steps.length) * 100);
    if (progressFill) progressFill.style.width = pct + "%";
    if (progressLabel)
      progressLabel.textContent =
        i === steps.length - 1
          ? "Last step"
          : "Question " + (i + 1) + " of " + steps.length;
    stepDots.forEach(function (d, idx) {
      d.classList.toggle("done", idx < i);
      d.classList.toggle("now", idx === i);
    });
    updateNav();
    if (!prefersReducedMotion()) {
      var el = steps[i];
      el.classList.remove("is-entering");
      void el.offsetWidth; // restart the enter animation
      el.classList.add("is-entering");
    }
    // Move focus to the step heading for screen-reader/keyboard users, but
    // ONLY after Continue/Back. On initial page load the visitor has not asked
    // to go anywhere, so stealing focus (and scrolling past the page heading)
    // would be disorienting.
    var h = steps[i].querySelector("h2, h3");
    if (h) {
      h.setAttribute("tabindex", "-1");
      if (moveFocus) h.focus();
    }
  }

  // Validate only the fields inside the current step.
  function validateStep(i) {
    var stepEl = steps[i];
    var invalid = null;
    // Clear previous field errors in this step.
    stepEl.querySelectorAll(".form-error").forEach(function (e) {
      e.textContent = "";
    });
    var controls = stepEl.querySelectorAll("input, select, textarea");
    // Native required check first.
    for (var k = 0; k < controls.length; k++) {
      var c = controls[k];
      if (!c.checkValidity()) {
        invalid = c;
        break;
      }
    }
    // Radio groups marked required: at least one checked.
    var radioGroups = stepEl.querySelectorAll("[data-required-group]");
    radioGroups.forEach(function (g) {
      if (invalid) return;
      var nm = g.getAttribute("data-required-group");
      if (!form.querySelector('input[name="' + nm + '"]:checked')) {
        invalid = g.querySelector("input");
      }
    });
    if (invalid) {
      var fieldWrap = invalid.closest(".field, .consent, .radio-set");
      var errEl = fieldWrap && fieldWrap.parentNode.querySelector(".form-error");
      if (!errEl) errEl = stepEl.querySelector(".form-error");
      if (errEl)
        errEl.textContent =
          invalid.validationMessage || "Please complete this field.";
      if (invalid.focus) invalid.focus();
      return false;
    }
    return true;
  }

  // Selected-answer state. CSS handles this with :has() where available; this
  // mirrors it onto the label so the navy/amber state is never missed.
  function syncTiles() {
    Array.prototype.forEach.call(
      form.querySelectorAll(".tile, .wz-tile"),
      function (t) {
        var input = t.querySelector("input");
        t.classList.toggle("is-selected", !!(input && input.checked));
      }
    );
  }
  form.addEventListener("change", function (e) {
    if (!e.target || e.target.type !== "radio") return;
    syncTiles();
    updateNav();
    clearStatus();
    if (pointerCommit) {
      pointerCommit = false;
      queueAdvance();
    }
  });
  // Mirror focus onto the tile so the ring shows around the whole target.
  form.addEventListener("focusin", function (e) {
    var t = e.target.closest && e.target.closest(".wz-tile");
    if (t) t.classList.add("is-focused");
  });
  form.addEventListener("focusout", function (e) {
    var t = e.target.closest && e.target.closest(".wz-tile");
    if (t) t.classList.remove("is-focused");
  });
  syncTiles();

  /* Back is available from the second screen on. Continue appears once the
     current question is answered. Pointer users are advanced automatically,
     but keyboard users browsing options with the arrow keys need an explicit
     commit, and anyone can use it to move on at their own pace. */
  function updateNav() {
    var last = current === steps.length - 1;
    backBtn.hidden = current === 0;
    submitBtn.hidden = !last;
    var answered = !!steps[current].querySelector(
      'input[type="radio"]:checked'
    );
    nextBtn.hidden = last || !answered;
  }

  var advanceTimer = null;
  function queueAdvance() {
    if (current >= steps.length - 1) return;
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(function () {
      if (validateStep(current)) showStep(current + 1, true);
    }, prefersReducedMotion() ? ADVANCE_PAUSE_REDUCED_MS : ADVANCE_PAUSE_MS);
  }

  // Only a deliberate commit advances. Arrow-key browsing within a radiogroup
  // changes the selection without moving on, so options stay explorable.
  var pointerCommit = false;
  form.addEventListener("pointerdown", function (e) {
    if (e.target.closest && e.target.closest(".wz-tile")) pointerCommit = true;
  });
  form.addEventListener("keydown", function (e) {
    pointerCommit = false;
    if (e.key !== "Enter") return;
    if (e.target.tagName === "TEXTAREA") return;
    if (current === steps.length - 1) return; // last screen submits normally
    e.preventDefault(); // never let Enter trigger the hidden submit button
    if (steps[current].querySelector('input[type="radio"]:checked'))
      queueAdvance();
  });

  nextBtn.addEventListener("click", function () {
    clearStatus();
    if (validateStep(current)) showStep(current + 1, true);
  });
  backBtn.addEventListener("click", function () {
    clearStatus();
    clearTimeout(advanceTimer);
    pointerCommit = false;
    showStep(current - 1, true);
  });

  function collect() {
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (v, k) {
      if (k === HONEYPOT) return; // never transmit the spam trap's value
      data[k] = typeof v === "string" ? v.trim() : v;
    });
    var product = cfg.productName || "ServiceMomentum";
    // NOTE: metadata keys deliberately avoid a leading underscore. Form services
    // (Formspree included) reserve "_"-prefixed names such as _replyto, _subject,
    // _cc, _next, _gotcha, and _format, and quietly swallow or repurpose anything else
    // that looks like one. Plain names always land in the submission.
    data.meta_product = product;
    // Derived from the working name so a rename leaves nothing stale behind.
    data.meta_source =
      product.replace(/[^A-Za-z0-9]/g, "").toLowerCase() + "-audit-form";
    data.meta_submitted_at = new Date().toISOString();

    if (mode === "formspree") {
      // The two reserved keys that actually make the notification inbox usable:
      // replies go to the applicant, and the subject line identifies the lead.
      if (data.email) data._replyto = data.email;
      data._subject =
        product +
        ": Growth System Audit: " +
        (data.business_name || data.company || "new application");
    }
    return data;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitBtn.disabled) return; // refuse duplicate requests while sending
    clearStatus();
    // Validate every step before sending.
    for (var i = 0; i < steps.length; i++) {
      if (!validateStep(i)) {
        showStep(i, true);
        return;
      }
    }

    var endpoint = (cfg.formEndpoint || "").trim();
    if (!endpoint) {
      // Honest state: nothing is wired up yet. Never fake success.
      setStatus(
        "info",
        "Thanks. Your answers are ready, but the application form is not connected to a submission service yet. Please email " +
          (cfg.email || "hello@tnrgrowthagency.com") +
          " and we’ll pick it up from there. (Setting up the endpoint is a launch step.)"
      );
      return;
    }
    if (!endpointIsSafe(endpoint)) {
      // Misconfiguration, not a visitor problem. Say so without faking success.
      setStatus("err", "This form is misconfigured. Please email " + supportEmail() + ".");
      return;
    }

    // A bot filled the invisible trap. Don't transmit, don't explain, don't
    // pretend it worked either. Just stop.
    var trap = form.querySelector('[name="' + HONEYPOT + '"]');
    if (trap && trap.value) return;

    var payload = collect();
    setSending(true);
    setStatus("info", "Sending your application…");

    var opts = { method: "POST", headers: { Accept: "application/json" } };
    if (mode === "formspree") {
      // FormData: the browser sets multipart/form-data, and the request stays a
      // CORS "simple" request (no preflight), which is what form services expect.
      var fd = new FormData();
      Object.keys(payload).forEach(function (k) {
        fd.append(k, payload[k]);
      });
      opts.body = fd;
    } else {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(payload);
    }

    // Never leave the button stuck on "Sending…" if the network stalls.
    var timedOut = false;
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    if (ctrl) opts.signal = ctrl.signal;
    var timer = setTimeout(function () {
      timedOut = true;
      if (ctrl) ctrl.abort();
    }, REQUEST_TIMEOUT_MS);

    fetch(endpoint, opts)
      .then(function (res) {
        clearTimeout(timer);
        if (res.ok) {
          succeed();
          return;
        }
        // Form services answer 4xx with {"errors":[{"message","field"}]}.
        // Surface what they actually said instead of a blanket failure.
        return res
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            var msg =
              body && body.errors && body.errors.length
                ? body.errors
                    .map(function (e) {
                      return e.message || e.code;
                    })
                    .filter(Boolean)
                    .join(" ")
                : "";
            throw new Error(msg || "HTTP " + res.status);
          });
      })
      .catch(function (err) {
        clearTimeout(timer);
        setSending(false);
        var detail = timedOut
          ? "That took too long to send."
          : (err && err.message) || "";
        setStatus(
          "err",
          (detail ? detail + " " : "") +
            "Your application was not submitted. Please try again, or email " +
            supportEmail() +
            "."
        );
      });
  });

  /* Retire a step control for good. `hidden` alone removes it from the tab
   * order in a current browser, but disabling it and pinning tabindex to -1
   * means no stale stylesheet, older engine, or restored bfcache page can
   * leave Back / Continue / Submit focusable behind the confirmation. */
  function retire(btn) {
    if (!btn) return;
    btn.hidden = true;
    btn.disabled = true;
    btn.setAttribute("tabindex", "-1");
  }

  /* The confirmation copy is fixed text in contact.html. No submitted value
   * is rendered back to the page at all, so nothing a visitor typed can reach
   * the confirmation in any form. */

  /* Runs ONLY from the res.ok branch of the submit handler. Nothing else in
   * this file calls it, so the confirmation cannot appear for a failed,
   * misconfigured, spam-trapped, or unsent submission. */
  function succeed() {
    form.reset();
    syncTiles();
    // The step meter is finished: fill it, and drop the "how long it takes"
    // hint, which is meaningless once the form is submitted.
    stepDots.forEach(function (d) {
      d.classList.remove("now");
      d.classList.add("done");
    });
    var timeHint = form.querySelector(".stepmeta .left");
    if (timeHint) timeHint.hidden = true;
    steps.forEach(function (s) {
      s.hidden = true;
    });
    retire(backBtn);
    retire(nextBtn);
    retire(submitBtn);
    if (navWrap) navWrap.hidden = true;
    if (progressFill) progressFill.style.width = "100%";
    if (progressLabel) progressLabel.textContent = "Submitted";

    if (successPanel) {
      // The panel is the confirmation, so the small status box goes away
      // rather than repeating it.
      clearStatus();
      successPanel.hidden = false;
      // Focus the heading so keyboard and screen-reader users land on the
      // confirmation instead of at the top of an emptied page.
      if (successHeading) successHeading.focus();
    } else {
      // The panel markup is missing (it never should be). Confirm in the
      // status region rather than leaving a submitted visitor with nothing.
      setStatus(
        "ok",
        "Thank you. Your Growth System Audit request has been received. We’ll reply by email within a couple of business days."
      );
    }
  }

  // Assigned as a value, never as markup.
  var referralField = document.getElementById("referral-source");
  if (referralField) referralField.value = referralSource();

  // Initial render only, with no focus movement (see showStep).
  showStep(0, false);
})();
