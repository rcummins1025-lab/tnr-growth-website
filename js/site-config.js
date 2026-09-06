/* ServiceMomentum runtime site config (mirrors brand.config.json).
 * This is the ONE place to set the lead-form submission endpoint.
 * Keep in sync with brand.config.json (or regenerate via scripts/apply-brand.mjs).
 *
 * formEndpoint:
 *   "" (empty)  -> the audit form does NOT fake a submission. It tells the
 *                  visitor it is not connected yet. Nothing is transmitted.
 *   "https://…" -> the form POSTs to this URL and shows the REAL result.
 *
 * formEndpointMode controls how the POST body is encoded for your provider:
 *   "json"      -> Content-Type: application/json, body = JSON.stringify(answers).
 *                  Use for a custom serverless function you control.
 *   "formspree" -> body = FormData (browser sets multipart/form-data), with
 *                  Accept: application/json. Use for Formspree and other form
 *                  services: it is a CORS "simple" request, so it needs no
 *                  preflight and works with providers that reject a JSON
 *                  content type. Formspree also accepts "json"; FormData is the
 *                  safer default there.
 * Any other value falls back to "json" and logs a console warning.
 *
 * Recommended for launch: a dedicated agency-lead endpoint such as Formspree
 * (https://formspree.io) or a small serverless function. Do NOT point this at
 * the tenant-scoped client-booking backend. That requires a server-side secret
 * that must never ship in browser JavaScript.
 */
window.TNR_CONFIG = {
  productName: "ServiceMomentum",
  email: "hello@tnrgrowthagency.com",
  formEndpoint: "https://formspree.io/f/xqpklkny",
  // "json" | "formspree". See the note above. Ignored while formEndpoint is "".
  formEndpointMode: "formspree"
};
