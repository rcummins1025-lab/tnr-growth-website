/* Service Momentum "Book a demo" form.
 * Self-contained, no dependencies, no tracking, no analytics.
 * Submission goes ONLY to window.TNR_CONFIG.formEndpoint (js/site-config.js).
 * If that is empty, the form never fakes success: it says it is not connected.
 * The success panel appears only after a real 2xx response.
 */
(function () {
  "use strict";

  var form = document.getElementById("demo-form");
  if (!form) return;

  var cfg = window.TNR_CONFIG || {};
  var HONEYPOT = "_gotcha";
  var REQUEST_TIMEOUT_MS = 20000;
  var SUBMIT_IDLE_LABEL = "Book my demo";

  var submitBtn = document.getElementById("demo-submit");
  var status = document.getElementById("form-status");
  var errorEl = document.getElementById("form-error");
  var successPanel = document.getElementById("demo-success");
  var successHeading = document.getElementById("demo-success-title");

  var MODES = { json: 1, formspree: 1 };
  var mode = String(cfg.formEndpointMode || "json").toLowerCase();
  if (!MODES[mode]) {
    warn('unknown formEndpointMode "' + cfg.formEndpointMode + '", falling back to "json".');
    mode = "json";
  }

  function supportEmail() {
    return cfg.email || "hello@tnrgrowthagency.com";
  }
  function warn(msg) {
    if (window.console && console.warn) console.warn("site-config: " + msg);
  }

  /* Referral attribution: one sanitised ?source= value, "direct" otherwise.
   * No cookie, no storage, no referring URL. Assigned as a value, never markup. */
  function referralSource() {
    var raw = "";
    try {
      raw = new URLSearchParams(window.location.search).get("source") || "";
    } catch (e) {
      return "direct";
    }
    var v = String(raw).replace(/\s+/g, " ").trim();
    if (!v || v.length > 80 || !/^[A-Za-z0-9 ._-]+$/.test(v)) return "direct";
    return v;
  }
  var referralField = document.getElementById("referral-source");
  if (referralField) referralField.value = referralSource();

  /* The endpoint must be absolute HTTPS (http only for a localhost mock) and
   * must never be the tenant-scoped client-booking backend. */
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
      warn("formEndpoint looks like the client-booking backend. Agency leads need their own endpoint.");
      return false;
    }
    return true;
  }

  function setStatus(kind, msg) {
    status.className = "form-status" + (kind === "err" ? " err" : "");
    status.textContent = msg;
    status.hidden = false;
  }
  function clearStatus() {
    status.hidden = true;
    errorEl.textContent = "";
  }
  function setSending(on) {
    submitBtn.disabled = on;
    submitBtn.textContent = on ? "Sending…" : SUBMIT_IDLE_LABEL;
  }

  /* Agreeing to texts with no number to text is not a usable consent, so the
   * phone is required only while the text-message box is ticked. */
  var SMS_NEEDS_PHONE = "Add a mobile number to receive text messages, or untick the text-message box.";
  var smsConsent = form.querySelector('input[name="sms_consent"]');
  var phoneField = form.querySelector('input[name="phone"]');
  function syncSmsConsent() {
    if (!smsConsent || !phoneField) return;
    phoneField.setCustomValidity(smsConsent.checked && !phoneField.value.trim() ? SMS_NEEDS_PHONE : "");
  }

  var LABELS = {
    name: "Please add your name.",
    business_name: "Please add your business name.",
    email: "Please add an email we can reply to.",
    trade: "Please choose what you do.",
    trucks: "Please choose how many trucks you run.",
    contact_consent: "Please tick the box so we can contact you about your demo."
  };

  function validate() {
    syncSmsConsent();
    var controls = form.querySelectorAll("input, select, textarea");
    var first = null;
    for (var i = 0; i < controls.length; i++) {
      var c = controls[i];
      if (c.name === HONEYPOT || c.type === "hidden") continue;
      var bad = !c.checkValidity();
      if (c.type !== "checkbox") c.setAttribute("aria-invalid", bad ? "true" : "false");
      if (bad && !first) first = c;
    }
    if (first) {
      var msg = LABELS[first.name] || first.validationMessage || "Please check this field.";
      if (first.name === "email" && first.value) msg = "That email doesn’t look right.";
      if (first.name === "phone") msg = first.validationMessage;
      errorEl.textContent = msg;
      first.focus();
      return false;
    }
    return true;
  }

  form.addEventListener("input", function (e) {
    if (e.target.getAttribute("aria-invalid") === "true" && e.target.checkValidity()) {
      e.target.setAttribute("aria-invalid", "false");
    }
  });
  form.addEventListener("change", syncSmsConsent);

  function collect() {
    var data = {};
    new FormData(form).forEach(function (v, k) {
      if (k === HONEYPOT) return; // never transmit the spam trap's value
      data[k] = typeof v === "string" ? v.trim() : v;
    });
    // An unticked box is absent from FormData. Record the refusal explicitly so
    // the submission is an unambiguous consent record either way.
    if (smsConsent && !smsConsent.checked) data.sms_consent = "no";
    var product = cfg.productName || "Service Momentum";
    // No leading underscores: form services reserve "_" keys.
    data.meta_product = product;
    data.meta_source = product.replace(/[^A-Za-z0-9]/g, "").toLowerCase() + "-demo-form";
    data.meta_page = location.pathname.split("/").pop() || "index.html";
    data.meta_submitted_at = new Date().toISOString();
    if (mode === "formspree") {
      if (data.email) data._replyto = data.email;
      data._subject = product + ": Demo request: " + (data.business_name || "new request");
    }
    return data;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitBtn.disabled) return; // no duplicate requests while sending
    clearStatus();
    if (!validate()) return;

    var endpoint = (cfg.formEndpoint || "").trim();
    if (!endpoint) {
      setStatus(
        "info",
        "Thanks. This form is not connected to a submission service yet, so nothing was sent. Please email " +
          supportEmail() +
          " and we’ll set up your demo."
      );
      return;
    }
    if (!endpointIsSafe(endpoint)) {
      setStatus("err", "This form is misconfigured. Please email " + supportEmail() + ".");
      return;
    }

    // A bot filled the invisible trap: don't send, don't explain, just stop.
    var trap = form.querySelector('[name="' + HONEYPOT + '"]');
    if (trap && trap.value) return;

    var payload = collect();
    setSending(true);
    setStatus("info", "Sending…");

    var opts = { method: "POST", headers: { Accept: "application/json" } };
    if (mode === "formspree") {
      var fd = new FormData();
      Object.keys(payload).forEach(function (k) {
        fd.append(k, payload[k]);
      });
      opts.body = fd;
    } else {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(payload);
    }

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
        if (res.ok) return succeed();
        // Form services answer 4xx with {"errors":[{"message"}]}. Show what they said.
        return res
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            var msg =
              body && body.errors && body.errors.length
                ? body.errors
                    .map(function (x) {
                      return x.message || x.code;
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
        var detail = timedOut ? "That took too long to send." : (err && err.message) || "";
        setStatus(
          "err",
          (detail ? detail + " " : "") +
            "Your request was not sent. Please try again, or email " +
            supportEmail() +
            "."
        );
      });
  });

  // Runs ONLY from the res.ok branch above. Nothing a visitor typed is echoed.
  function succeed() {
    form.reset();
    form.hidden = true;
    successPanel.hidden = false;
    if (successHeading) successHeading.focus();
  }
})();
