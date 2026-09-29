/* ChatGPT Ads (OpenAI Ads) conversion hook for command-center.html.
 *
 * INACTIVE. Until Ryan pastes the Ads Manager code, this file sends nothing,
 * sets nothing and loads nothing. js/lead-form.js calls leadCreated() exactly
 * once, and ONLY after the form endpoint returned a real 2xx. A failed,
 * spam-trapped or unsent submission never reaches it.
 *
 * INSTALL (see docs/CHATGPT-ADS.md, "Pixel install checklist"):
 *   1. Paste the base pixel from Ads Manager into the <head> of
 *      command-center.html at the OPENAI-ADS-PIXEL:BASE marker.
 *   2. In Ads Manager, create a conversion event of type Lead
 *      (event name lead_created) for that pixel.
 *   3. Paste the single lead_created line Ads Manager shows you at the
 *      OPENAI-ADS-PIXEL:LEAD_CREATED marker below. Copy it exactly; do not
 *      retype it from memory or from a blog post.
 *   4. Keep it inside the try block so an ad blocker or a pixel outage can
 *      never break the thank-you screen.
 */
(function () {
  "use strict";

  var fired = false;

  window.SM_ADS = {
    leadCreated: function () {
      if (fired) return; // one conversion per page load, never a duplicate
      fired = true;
      try {
        // OPENAI-ADS-PIXEL:LEAD_CREATED (paste the Ads Manager lead_created line here)
      } catch (e) {
        // Tracking must never affect the visitor. Swallow and move on.
      }
    }
  };
})();
