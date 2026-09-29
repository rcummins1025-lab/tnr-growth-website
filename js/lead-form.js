/* Short lead form for command-center.html (ChatGPT Ads landing page).
 *
 * Same submission rules as the audit wizard (js/intake.js):
 *   - posts ONLY to window.TNR_CONFIG.formEndpoint, encoded per
 *     formEndpointMode; an empty endpoint never fakes success
 *   - https only (http just for a localhost mock), and never the
 *     tenant-scoped client-booking backend
 *   - hidden _gotcha spam trap, never transmitted
 *   - 20s timeout, and the provider's own error message is shown
 *   - the thank-you panel appears ONLY after a real 2xx response, and only
 *     then is the ads conversion hook (js/ads-events.js) called
 * No cookies, no storage, no third-party scripts.
 */
(function () {
  "use strict";

  var form = document.getElementById("lead-form");
  if (!form) return;

  var cfg = window.TNR_CONFIG || {};
  var HONEYPOT = "_gotcha";
  var REQUEST_TIMEOUT_MS = 20000;
  var SUBMIT_IDLE_LABEL = "Get my walkthrough";

  var submitBtn = document.getElementById("lf-submit");
  var status = document.getElementById("lf-status");
  var wrap = document.getElementById("lead-form-wrap");
  var thanks = document.getElementById("lead-thanks");
  var thanksTitle = document.getElementById("lead-thanks-title");

  var mode = String(cfg.formEndpointMode || "json").toLowerCase();
  if (mode !== "json" && mode !== "formspree") mode = "json";

  function supportEmail() {
    return cfg.email || "hello@tnrgrowthagency.com";
  }

  function warn(msg) {
    if (window.console && console.warn) console.warn("site-config: " + msg);
  }

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
      warn("formEndpoint looks like the client-booking backend. See docs/CONTACT-FORM.md.");
      return false;
    }
    return true;
  }

  function setStatus(kind, msg) {
    status.className = "form-status " + kind;
    status.textContent = msg;
    status.hidden = false;
  }

  function setSending(on) {
    submitBtn.disabled = on;
    submitBtn.textContent = on ? "Sending…" : SUBMIT_IDLE_LABEL;
  }

  /* Campaign tags from the ad URL (utm_*). Sanitised and length-capped, and
   * only ever sent as form values, never written into the page. The ad click
   * id itself is the pixel's business, not this form's. */
  var TAG_ALLOWED = /^[A-Za-z0-9 ._\-]+$/;
  function campaignTags() {
    var out = {};
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return out;
    }
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach(function (k) {
      var v = String(params.get(k) || "").replace(/\s+/g, " ").trim();
      if (v && v.length <= 80 && TAG_ALLOWED.test(v)) out["meta_" + k] = v;
    });
    return out;
  }

  var MESSAGES = {
    name: "Enter your name.",
    phone: "Enter a phone number we can call, with area code.",
    business_name: "Enter your business name.",
    trade: "Choose your trade.",
    city: "Enter your city."
  };

  function validate() {
    var first = null;
    Array.prototype.forEach.call(form.querySelectorAll("input[required], select[required]"), function (c) {
      var err = document.getElementById(c.id + "-err");
      var bad = !c.value.trim() || !c.checkValidity();
      if (c.name === "phone" && c.value.replace(/\D/g, "").length < 10) bad = true;
      c.setAttribute("aria-invalid", bad ? "true" : "false");
      if (err) err.textContent = bad ? MESSAGES[c.name] || "Please complete this field." : "";
      if (bad && !first) first = c;
    });
    if (first) first.focus();
    return !first;
  }

  function collect() {
    var data = {};
    new FormData(form).forEach(function (v, k) {
      if (k === HONEYPOT) return;
      data[k] = typeof v === "string" ? v.trim() : v;
    });
    var tags = campaignTags();
    Object.keys(tags).forEach(function (k) {
      data[k] = tags[k];
    });
    var product = cfg.productName || "ServiceMomentum";
    data.meta_product = product;
    data.meta_source = product.replace(/[^A-Za-z0-9]/g, "").toLowerCase() + "-command-center-landing";
    data.meta_submitted_at = new Date().toISOString();
    if (mode === "formspree") {
      data._subject = product + ": Command Center walkthrough: " + (data.business_name || "new request");
    }
    return data;
  }

  function succeed() {
    form.reset();
    wrap.hidden = true;
    thanks.hidden = false;
    if (thanksTitle) thanksTitle.focus();
    // Conversion fires only here, after a confirmed 2xx.
    try {
      if (window.SM_ADS && typeof window.SM_ADS.leadCreated === "function") window.SM_ADS.leadCreated();
    } catch (e) {
      /* never let tracking affect the visitor */
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitBtn.disabled) return;
    status.hidden = true;
    if (!validate()) return;

    var endpoint = String(cfg.formEndpoint || "").trim();
    if (!endpoint) {
      setStatus("info", "This form is not connected yet. Please email " + supportEmail() + " and we will call you back.");
      return;
    }
    if (!endpointIsSafe(endpoint)) {
      setStatus("err", "This form is misconfigured. Please email " + supportEmail() + ".");
      return;
    }
    var trap = form.querySelector('[name="' + HONEYPOT + '"]');
    if (trap && trap.value) return;

    var payload = collect();
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

    setSending(true);
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
        return res
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            var msg =
              body && body.errors && body.errors.length
                ? body.errors.map(function (x) { return x.message || x.code; }).filter(Boolean).join(" ")
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
          (detail ? detail + " " : "") + "Your request was not sent. Please try again, or email " + supportEmail() + "."
        );
      });
  });
})();
