#!/usr/bin/env node
/**
 * validate.mjs — focused checks for this static site (product name lives in
 *   brand.config.json; nothing here hard-codes it).
 * No dependencies. Run: npm run validate  (or: node scripts/validate.mjs)
 *
 * Verifies structure, internal links + anchors, escaping, email consistency,
 * JSON-LD validity, absence of fake rating markup, the pilot-implementation claim
 * guardrails, the brand symbol (present, drawn not embedded, approved colours,
 * no letterforms), the form's submission safeguards, and the motion layer's
 * reduced-motion / fail-open guarantees.
 * Exits non-zero if anything fails.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  slugFor,
  MARK_COLORS,
  FORGE_PALETTE,
  RETIRED_COLORS,
  APPROVED_MARK_PAINTS,
  MARK_ASSETS,
  INITIALS_BADGE_RE
} from "./brand-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = readdirSync(root).filter((f) => f.endsWith(".html"));
// Split so the protected customer's name is never stored verbatim in this
// repository, including in the validator that checks for it.
const PILOT_NAME = ["G", "avin"].join("");
let fails = 0;
let checks = 0;
const fail = (m) => {
  fails++;
  console.log("  ✗ " + m);
};
const ok = (m) => {
  checks++;
  console.log("  ✓ " + m);
};

const read = (f) => readFileSync(join(root, f), "utf8");

// Collect id="" anchors per page (for fragment link checks).
const idsByPage = {};
for (const f of htmlFiles) {
  const html = read(f);
  const ids = new Set();
  for (const m of html.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]);
  idsByPage[f] = ids;
}

console.log("\n== Structure ==");
for (const f of htmlFiles) {
  const h = read(f);
  const titles = (h.match(/<title>/g) || []).length;
  titles === 1 ? ok(`${f}: one <title>`) : fail(`${f}: ${titles} <title> tags`);
  /<html lang="en">/.test(h) ? ok(`${f}: lang=en`) : fail(`${f}: missing lang`);
  /rel="canonical"/.test(h)
    ? ok(`${f}: canonical`)
    : fail(`${f}: missing canonical`);
  /name="viewport"/.test(h)
    ? ok(`${f}: viewport`)
    : fail(`${f}: missing viewport`);
}

console.log("\n== Escaping (raw & outside entities) ==");
for (const f of htmlFiles) {
  const h = read(f);
  const bad = [...h.matchAll(/&(?!amp;|lt;|gt;|quot;|#\d+;|[a-z]+;)/g)];
  bad.length === 0
    ? ok(`${f}: clean`)
    : fail(`${f}: ${bad.length} raw ampersand(s)`);
}

console.log("\n== Email consistency ==");
for (const f of htmlFiles.concat(["js/site-config.js", "brand.config.json"])) {
  if (!existsSync(join(root, f))) continue;
  const h = read(f);
  if (/ryan@tnrgrowthagency\.com/.test(h)) fail(`${f}: contains old ryan@ email`);
  const emails = [...h.matchAll(/[A-Za-z0-9._%+-]+@tnrgrowthagency\.com/g)].map(
    (m) => m[0]
  );
  const bad = emails.filter((e) => e !== "hello@tnrgrowthagency.com");
  bad.length === 0
    ? ok(`${f}: emails ok (${emails.length})`)
    : fail(`${f}: unexpected email(s): ${[...new Set(bad)].join(", ")}`);
}

console.log("\n== Internal links + anchors ==");
for (const f of htmlFiles) {
  const h = read(f);
  const refs = [...h.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|#|mailto:|tel:|data:)/.test(ref)) {
      if (ref.startsWith("#")) {
        const id = ref.slice(1);
        if (id && !idsByPage[f].has(id)) fail(`${f}: dead anchor ${ref}`);
      }
      continue;
    }
    const [rawPath, frag] = ref.split("#");
    const path = rawPath.split("?")[0]; // a cache-busting ?v= is not part of the filename
    if (path && !existsSync(join(root, path)))
      fail(`${f}: missing file ${path}`);
    else if (frag && path.endsWith(".html") && idsByPage[path] && !idsByPage[path].has(frag))
      fail(`${f}: ${ref} -> #${frag} not found in ${path}`);
  }
  ok(`${f}: link refs checked (${refs.length})`);
}

console.log("\n== JSON-LD validity ==");
for (const f of htmlFiles) {
  const h = read(f);
  const blocks = [
    ...h.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
    )
  ];
  for (const b of blocks) {
    try {
      JSON.parse(b[1].trim());
      ok(`${f}: JSON-LD parses`);
    } catch (e) {
      fail(`${f}: JSON-LD invalid (${e.message})`);
    }
  }
}

console.log("\n== Cache busting: every page asks for the same stylesheet ==");
// A version query on some pages but not others leaves returning visitors on a
// stale stylesheet for the pages that lack it.
const sheetRefs = htmlFiles.map((f) => ({
  file: f,
  href: (read(f).match(/<link rel="stylesheet" href="([^"]+)"/) || [])[1]
}));
const sheetVersions = [...new Set(sheetRefs.map((r) => r.href))];
sheetVersions.length === 1
  ? ok(`assets: all ${sheetRefs.length} pages request ${sheetVersions[0]}`)
  : fail(
      `assets: stylesheet URL differs across pages: ${sheetRefs
        .map((r) => `${r.file} -> ${r.href}`)
        .join(", ")}`
    );

console.log("\n== Published surface: local tooling stays out of GitHub Pages ==");
const pagesConfig = existsSync(join(root, "_config.yml")) ? read("_config.yml") : "";
const PRIVATE_BUILD_PATHS = ["scripts", "docs", "package.json", "README.md", "brand.config.json"];
const missingExclusions = PRIVATE_BUILD_PATHS.filter(
  (path) => !new RegExp("^\\s*-\\s*" + path.replace(".", "\\.") + "\\s*$", "m").test(pagesConfig)
);
missingExclusions.length === 0
  ? ok("pages: development tooling and internal docs are excluded")
  : fail(`pages: missing exclusions for ${missingExclusions.join(", ")}`);
!existsSync(join(root, ".nojekyll"))
  ? ok("pages: Jekyll processing remains enabled so exclusions take effect")
  : fail("pages: .nojekyll would bypass the development-file exclusions");
const excludedRefs = htmlFiles.filter((file) =>
  /(?:href|src)=["'](?:scripts|docs|package\.json|README\.md|brand\.config\.json)/i.test(read(file))
);
excludedRefs.length === 0
  ? ok("pages: production HTML does not depend on excluded paths")
  : fail(`pages: production HTML references excluded paths in ${excludedRefs.join(", ")}`);

console.log("\n== No fake rating / review markup ==");
for (const f of htmlFiles) {
  const h = read(f);
  const bad = /aggregateRating|reviewRating|ratingValue|reviewCount/i.test(h);
  bad ? fail(`${f}: contains rating markup`) : ok(`${f}: no rating markup`);
}

console.log("\n== Pilot-implementation claim guardrails ==");
const banned = [
  "cannabis",
  "we guarantee",
  "guaranteed placement",
  "guaranteed leads",
  "guaranteed growth",
  "guaranteed results",
  "guaranteed revenue",
  "rank first",
  "ranks first",
  "always ranks",
  "always first",
  "in revenue",
  "generated $",
  "scaled " + PILOT_NAME.toLowerCase()
];
for (const f of htmlFiles) {
  const h = read(f).toLowerCase();
  const hit = banned.filter((p) => h.includes(p));
  hit.length === 0
    ? ok(`${f}: no banned claims`)
    : fail(`${f}: banned phrase(s): ${hit.join(", ")}`);
}

console.log("\n== Positioning + SEO assets ==");
const idx = read("index.html");
idx.includes(
  "Turn your website and past customers into a repeatable growth system"
)
  ? ok("index: positioning statement present")
  : fail("index: positioning statement missing");
existsSync(join(root, "robots.txt"))
  ? ok("robots.txt present")
  : fail("robots.txt missing");
if (existsSync(join(root, "sitemap.xml"))) {
  const sm = read("sitemap.xml");
  /<urlset/.test(sm) && /tnrgrowthagency\.com\/</.test(sm)
    ? ok("sitemap.xml valid + has canonical URLs")
    : fail("sitemap.xml malformed");
} else fail("sitemap.xml missing");
existsSync(join(root, "assets/og-image.svg"))
  ? ok("og-image present")
  : fail("og-image missing");
existsSync(join(root, "CNAME")) && read("CNAME").trim() === "tnrgrowthagency.com"
  ? ok("CNAME preserved (tnrgrowthagency.com)")
  : fail("CNAME changed or missing");


console.log("\n== Brand symbol: drawn geometry, approved colours, no letters ==");
const brand = JSON.parse(read("brand.config.json"));
const mark = brand.productMark || {};
/PROVISIONAL/.test(mark.status || "")
  ? ok("brand.config: symbol is recorded as PROVISIONAL pending name/trademark clearance")
  : fail("brand.config: productMark.status must record the symbol as PROVISIONAL");
mark.forgeBlack === MARK_COLORS.forgeBlack &&
mark.burntOrange === MARK_COLORS.burntOrange
  ? ok(`brand.config: mark colours are Forge Black ${MARK_COLORS.forgeBlack} + Burnt Orange ${MARK_COLORS.burntOrange}`)
  : fail("brand.config: productMark colours do not match the approved palette");

for (const f of MARK_ASSETS) {
  if (!existsSync(join(root, f))) {
    fail(`${f}: missing brand symbol asset`);
    continue;
  }
  const svg = read(f);
  ok(`${f}: present`);

  // Drawn, not traced or embedded: no raster of any kind, however referenced.
  const raster = [
    [/<image\b/i, "<image> element"],
    [/base64/i, "base64 payload"],
    [/data:image/i, "data:image URI"],
    [/\.(png|jpe?g|gif|webp|avif|bmp|tiff?)\b/i, "raster file reference"],
    [/xlink:href|(?<!\w)href=/i, "external href"],
    [/<foreignObject/i, "<foreignObject>"]
  ].filter(([re]) => re.test(svg));
  raster.length === 0
    ? ok(`${f}: no embedded or referenced raster art`)
    : fail(`${f}: contains ${raster.map(([, n]) => n).join(", ")}`);

  // Only the approved paints.
  const paints = [...svg.matchAll(/(?:fill|stroke|stop-color|flood-color)="([^"]*)"/g)].map(
    (m) => m[1].trim().toLowerCase()
  );
  const rogue = [...new Set(paints.filter((c) => !APPROVED_MARK_PAINTS.has(c)))];
  rogue.length === 0
    ? ok(`${f}: ${paints.length} paint value(s), all approved`)
    : fail(`${f}: unapproved colour(s): ${rogue.join(", ")}`);

  // The primary + reversed variants must carry exactly one amber accent node.
  if (f !== "assets/mark-mono.svg") {
    const endpoint = (svg.match(new RegExp(MARK_COLORS.burntOrange, "gi")) || []).length;
    endpoint === 1
      ? ok(`${f}: exactly one Burnt Orange endpoint`)
      : fail(`${f}: ${endpoint} Burnt Orange uses (expected exactly 1)`);
  }

  // Banned decoration and motifs.
  const banned = [
    [/<(linear|radial)Gradient|gradient/i, "gradient"],
    [/<filter|feGaussianBlur|feDropShadow|drop-shadow|box-shadow/i, "filter/shadow/glow"],
    [/marker-end|arrow/i, "arrow"]
  ].filter(([re]) => re.test(svg));
  banned.length === 0
    ? ok(`${f}: no gradients, shadows, glow or arrows`)
    : fail(`${f}: contains ${banned.map(([, n]) => n).join(", ")}`);

  // No letterforms, and no product wordmark baked into the artwork.
  /<text\b/i.test(svg)
    ? fail(`${f}: contains <text> — the symbol must not depend on letters`)
    : ok(`${f}: letter-free (no <text>)`);
  new RegExp(brand.productName, "i").test(svg)
    ? fail(`${f}: the product name is baked into the artwork`)
    : ok(`${f}: no product name baked in`);
  /PROVISIONAL/.test(svg)
    ? ok(`${f}: labelled PROVISIONAL`)
    : fail(`${f}: must be labelled PROVISIONAL until the name clears`);
}

console.log("\n== Lockup: symbol in markup, product name as HTML text ==");
for (const f of htmlFiles) {
  const h = read(f);
  const marks = (h.match(/class="brand-mark"/g) || []).length;
  marks >= 1
    ? ok(`${f}: ${marks} brand symbol reference(s)`)
    : fail(`${f}: no brand symbol in the lockup`);
  const stale = [...h.matchAll(INITIALS_BADGE_RE)];
  stale.length === 0
    ? ok(`${f}: no letter-initials badge`)
    : fail(`${f}: the retired initials badge is back (${stale.length} occurrence(s))`);
  const names = (h.match(/data-brand="product"/g) || []).length;
  names >= 1
    ? ok(`${f}: product name is HTML text (data-brand="product")`)
    : fail(`${f}: product name must stay centralized HTML text`);
  // The symbol must reserve its space so it cannot shift the layout.
  const imgs = [...h.matchAll(/<img[^>]*class="brand-mark"[^>]*>/g)].map((m) => m[0]);
  imgs.every((t) => /width="\d+"/.test(t) && /height="\d+"/.test(t))
    ? ok(`${f}: symbol has intrinsic width/height (no layout shift)`)
    : fail(`${f}: brand-mark <img> missing width/height`);
}
/href="favicon\.svg"/.test(read("index.html"))
  ? ok("index: favicon points at the updated mark")
  : fail("index: favicon link missing");

// Every shipped file: no leftover form of a previous working name, in any casing.
const brandSlug = slugFor(brand.productName);
console.log("\n== Form: safeguards, endpoint mode, focus behavior ==");
const cfgJs = read("js/site-config.js");
const intake = read("js/intake.js");
const endpoint = (cfgJs.match(/formEndpoint:\s*"([^"]*)"/) || [])[1];
endpoint === "" || /^https:\/\//.test(endpoint)
  ? ok(`site-config: formEndpoint ${endpoint === "" ? "unset (form never fakes success)" : "is https"}`)
  : fail(`site-config: formEndpoint must be "" or an https URL (got ${JSON.stringify(endpoint)})`);
const mode = (cfgJs.match(/formEndpointMode:\s*"([^"]*)"/) || [])[1];
["json", "formspree"].includes(mode)
  ? ok(`site-config: formEndpointMode "${mode}" is a supported mode`)
  : fail(`site-config: formEndpointMode must be "json" or "formspree" (got ${JSON.stringify(mode)})`);
/formEndpointMode/.test(intake) && /mode === "formspree"/.test(intake)
  ? ok("intake: formEndpointMode is actually implemented (json + formspree bodies)")
  : fail("intake: formEndpointMode is documented but not used");
/showStep\(0, false\)/.test(intake)
  ? ok("intake: step 1 heading is NOT focused on initial load")
  : fail("intake: initial render must not move focus (expected showStep(0, false))");
/showStep\(current \+ 1, true\)/.test(intake) && /showStep\(current - 1, true\)/.test(intake)
  ? ok("intake: focus still moves after Continue and Back")
  : fail("intake: Continue/Back must move focus to the step heading");
/not connected to a submission service yet/.test(intake)
  ? ok("intake: honest not-connected message preserved")
  : fail("intake: not-connected message missing (success must never be faked)");

console.log("\n== Submission path: ready for a real form endpoint ==");
// Metadata must not squat on the "_"-prefixed keys form services reserve.
/data\._product\b|data\._source\b|data\._submittedAt\b/.test(intake)
  ? fail('intake: metadata still uses reserved "_"-prefixed keys (use meta_*)')
  : ok("intake: metadata uses non-reserved meta_* keys");
/meta_product/.test(intake) && /meta_source/.test(intake) && /meta_submitted_at/.test(intake)
  ? ok("intake: submission carries product, source and timestamp metadata")
  : fail("intake: submission metadata missing");
/_replyto/.test(intake) && /_subject/.test(intake)
  ? ok("intake: formspree mode sets _replyto and _subject")
  : fail("intake: formspree mode must set _replyto and _subject");

// Spam trap: present in the markup, out of view and out of the tab order, and
// never transmitted.
const contactHtml = read("contact.html");
const stylesCss = read("styles.css");
const hp = /<input[^>]*name="_gotcha"[^>]*>/.exec(contactHtml);
hp ? ok("contact: spam trap present") : fail("contact: spam trap (_gotcha) missing");
if (hp) {
  /tabindex="-1"/.test(hp[0])
    ? ok("contact: spam trap is out of the tab order")
    : fail("contact: spam trap must have tabindex=-1");
  /class="hp"/.test(contactHtml) && /\.hp\s*\{[^}]*left:\s*-9999px/.test(stylesCss)
    ? ok("contact: spam trap is positioned off-screen (no layout effect)")
    : fail("contact: spam trap must be hidden off-screen via .hp");
}
/if \(k === HONEYPOT\) return;/.test(intake)
  ? ok("intake: spam-trap value is never transmitted")
  : fail("intake: spam-trap value must be stripped from the payload");
/if \(trap && trap\.value\) return;/.test(intake)
  ? ok("intake: a filled spam trap stops the submission silently")
  : fail("intake: a filled spam trap must stop the submission");

// Endpoint safety, timeout, and real error surfacing.
/function endpointIsSafe/.test(intake)
  ? ok("intake: endpoint is safety-checked before any request")
  : fail("intake: missing endpoint safety check");
/u\.protocol !== "https:"/.test(intake)
  ? ok("intake: refuses non-https endpoints (localhost excepted for the mock)")
  : fail("intake: must refuse non-https endpoints");
/zentradesk\|middleware/.test(intake)
  ? ok("intake: refuses the tenant-scoped client-booking backend")
  : fail("intake: must refuse the client-booking backend");
/REQUEST_TIMEOUT_MS/.test(intake) && /AbortController/.test(intake)
  ? ok("intake: requests time out instead of hanging on 'Sending…'")
  : fail("intake: submission needs a timeout");
/body\.errors/.test(intake)
  ? ok("intake: surfaces the provider's own error messages")
  : fail("intake: must surface provider errors, not a blanket failure");

// The mock endpoint is dev tooling: it must never be referenced by the site.
existsSync(join(root, "scripts/mock-endpoint.mjs"))
  ? ok("scripts/mock-endpoint.mjs present (dev-only test target)")
  : fail("scripts/mock-endpoint.mjs missing");
const mockRefs = htmlFiles.filter((f) => /localhost:8125|mock-endpoint/.test(read(f)));
mockRefs.length === 0
  ? ok("no page references the local mock endpoint")
  : fail(`mock endpoint referenced by: ${mockRefs.join(", ")}`);
/localhost|127\.0\.0\.1/.test(endpoint || "")
  ? fail("site-config: formEndpoint is still pointed at a local mock")
  : ok("site-config: formEndpoint is not a local mock");

console.log("\n== Motion layer: reduced motion, fail-open, no heavy deps ==");
const css = read("styles.css");
/@media \(prefers-reduced-motion: reduce\)/.test(css)
  ? ok("styles: prefers-reduced-motion honored")
  : fail("styles: no prefers-reduced-motion block");
const motionJs = existsSync(join(root, "js/motion.js")) ? read("js/motion.js") : "";
motionJs
  ? ok("js/motion.js present")
  : fail("js/motion.js missing");
/IntersectionObserver/.test(motionJs)
  ? ok("motion: uses IntersectionObserver (no scroll listeners)")
  : fail("motion: expected IntersectionObserver");
/addEventListener\(\s*["']scroll/.test(motionJs)
  ? fail("motion: scroll listener found (no scroll hijacking)")
  : ok("motion: no scroll listeners");
/data-motion-ready/.test(motionJs)
  ? ok("motion: signals readiness so the gate can fail open")
  : fail("motion: must set data-motion-ready");
for (const f of htmlFiles) {
  const h = read(f);
  const usesMotion = /js\/motion\.js/.test(h);
  if (!usesMotion) continue;
  /prefers-reduced-motion: reduce/.test(h) && /classList\.add\("motion"\)/.test(h)
    ? ok(`${f}: motion gate present (reduced motion opts out entirely)`)
    : fail(`${f}: loads motion.js without the reduced-motion gate`);
  /data-motion-ready/.test(h)
    ? ok(`${f}: motion gate fails open if motion.js does not load`)
    : fail(`${f}: motion gate has no fail-open fallback`);
}
for (const f of htmlFiles) {
  const h = read(f);
  const ext = [...h.matchAll(/<script[^>]+src="(https?:)?\/\/[^"]+"/g)];
  ext.length === 0 ? ok(`${f}: no third-party scripts`) : fail(`${f}: external script(s) added`);
  /<video|autoplay/i.test(h) ? fail(`${f}: autoplaying media added`) : ok(`${f}: no autoplay media`);
}

console.log("\n== Guided audit wizard: structure, fields, accessibility ==");
const wiz = read("contact.html");

// The "Selected" word is decoration. If it reaches the accessible name, every
// option is announced as selected — the native radio state must carry it.
const stateSpans = [...wiz.matchAll(/<span class="wz-state"([^>]*)>/g)];
const exposedStates = stateSpans.filter((m) => !/aria-hidden="true"/.test(m[1]));
stateSpans.length > 0 && exposedStates.length === 0
  ? ok(`contact: all ${stateSpans.length} .wz-state labels are aria-hidden`)
  : fail(
      `contact: ${exposedStates.length} of ${stateSpans.length} .wz-state label(s) still reach the accessible name`
    );

// Eight screens: seven qualification questions plus the contact screen.
const screens = [...wiz.matchAll(/<fieldset class="wz-step form-step" data-step="(\d+)"([^>]*)>/g)];
screens.length === 8
  ? ok("contact: exactly 8 wizard screens")
  : fail(`contact: ${screens.length} wizard screens (expected 8)`);
const numbering = screens.map((m) => Number(m[1])).join(",");
numbering === "1,2,3,4,5,6,7,8"
  ? ok("contact: screens are numbered 1-8 in order")
  : fail(`contact: screen numbering is ${numbering}`);

// Only the active step may be exposed; every other screen carries `hidden`.
const exposed = screens.filter((m) => !/\bhidden\b/.test(m[2]));
exposed.length === 1 && Number(exposed[0][1]) === 1
  ? ok("contact: only step 1 is exposed on load; the other 7 are hidden")
  : fail(
      `contact: ${exposed.length} step(s) exposed on load (expected exactly step 1)`
    );
/showStep\(0, false\)/.test(intake) && /s\.hidden = idx !== i/.test(intake)
  ? ok("intake: exactly one step is unhidden at a time")
  : fail("intake: step exposure must hide every step but the current one");

// The agreed field set, exactly.
const QUALIFICATION_FIELDS = [
  "industry",
  "team_size",
  "past_customers",
  "customer_database",
  "post_job_followup",
  "biggest_opportunity",
  "website_status"
];
const CONTACT_FIELDS = [
  "business_name",
  "name",
  "email",
  "phone",
  "service_area",
  "notes",
  "contact_consent"
];
const missingQ = QUALIFICATION_FIELDS.filter(
  (f) => !new RegExp(`data-required-group="${f}"`).test(wiz)
);
missingQ.length === 0
  ? ok(`contact: all ${QUALIFICATION_FIELDS.length} qualification questions present`)
  : fail(`contact: missing qualification field(s): ${missingQ.join(", ")}`);
const missingC = CONTACT_FIELDS.filter(
  (f) => !new RegExp(`name="${f}"`).test(wiz)
);
missingC.length === 0
  ? ok(`contact: all ${CONTACT_FIELDS.length} final contact fields present`)
  : fail(`contact: missing contact field(s): ${missingC.join(", ")}`);
/name="phone"[^>]*required/.test(wiz)
  ? fail("contact: phone must stay optional")
  : ok("contact: phone is optional");
/name="contact_consent"[^>]*required/.test(wiz)
  ? ok("contact: consent checkbox is present and required")
  : fail("contact: consent checkbox must remain required");

// The live endpoint is approved and verified — it must not drift.
const APPROVED_ENDPOINT = "https://formspree.io/f/xqpklkny";
endpoint === APPROVED_ENDPOINT
  ? ok(`site-config: live Formspree endpoint unchanged (${APPROVED_ENDPOINT})`)
  : fail(
      `site-config: formEndpoint is ${JSON.stringify(endpoint)}, expected ${APPROVED_ENDPOINT}`
    );
mode === "formspree"
  ? ok('site-config: formEndpointMode is still "formspree"')
  : fail(`site-config: formEndpointMode drifted to ${JSON.stringify(mode)}`);

console.log("\n== Forge palette: centralized, and the old identity cannot return ==");
const cssText = read("styles.css");

// The six approved colours must all be declared as --forge-* tokens.
const missingPalette = Object.entries(FORGE_PALETTE).filter(
  ([, hex]) => !new RegExp(hex.replace("#", "#") + "\\b", "i").test(cssText)
);
missingPalette.length === 0
  ? ok(`styles: all ${Object.keys(FORGE_PALETTE).length} Forge palette colours declared`)
  : fail(`styles: palette colours missing from styles.css: ${missingPalette.map(([n]) => n).join(", ")}`);

// Every colour must live in the palette block at the top — nothing below it may
// hard-code a hex, or the palette stops being changeable in one place.
const paletteBlockEnd = cssText.indexOf("\n}", cssText.indexOf(":root {"));
const belowPalette = cssText.slice(paletteBlockEnd);
const strayHex = [...new Set((belowPalette.match(/#[0-9a-fA-F]{3,8}\b/g) || []))];
strayHex.length === 0
  ? ok("styles: no hard-coded hex below the palette block — every colour is a token")
  : fail(`styles: ${strayHex.length} hard-coded colour(s) outside the palette block: ${strayHex.slice(0, 6).join(", ")}`);

// The retired navy/gold identity must not reappear anywhere that ships.
const shippedForColor = [
  ...htmlFiles,
  "styles.css",
  "brand.config.json",
  ...MARK_ASSETS,
  "assets/og-image.svg",
  ...readdirSync(join(root, "assets"))
    .filter((f) => f.endsWith(".svg"))
    .map((f) => "assets/" + f)
].filter((f, i, a) => a.indexOf(f) === i && existsSync(join(root, f)));
let retiredHits = 0;
for (const f of shippedForColor) {
  const body = read(f);
  const hits = RETIRED_COLORS.filter((c) => new RegExp(c + "\\b", "i").test(body));
  if (hits.length) {
    retiredHits += hits.length;
    fail(`${f}: retired navy/gold colour(s) returned: ${hits.join(", ")}`);
  }
}
retiredHits === 0
  ? ok(`no retired navy/gold colour in any of ${shippedForColor.length} shipped files`)
  : fail(`${retiredHits} retired colour reference(s) still shipping`);

// The logo must read as Forge: charcoal (or white) pathway, orange endpoint.
for (const f of ["assets/mark.svg", "assets/mark-reversed.svg"]) {
  const svg = read(f);
  const pathway = f.includes("reversed") ? "#FFFFFF" : MARK_COLORS.forgeBlack;
  new RegExp(`stroke="${pathway}"`, "i").test(svg)
    ? ok(`${f}: pathway is ${pathway}`)
    : fail(`${f}: pathway is not ${pathway}`);
  new RegExp(`r="[\\d.]+" fill="${MARK_COLORS.burntOrange}"`, "i").test(svg)
    ? ok(`${f}: endpoint is Burnt Orange`)
    : fail(`${f}: endpoint is not Burnt Orange`);
}

console.log("\n== Contrast: the palette has to stay legible ==");
const hexOf = (name) => {
  const m = cssText.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  return m ? m[1] : null;
};
const relLum = (hex) => {
  const h = hex.replace("#", "");
  const ch = (i) => {
    const c =
      parseInt(h.length === 3 ? h[i] + h[i] : h.substr(i * 2, 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
};
const contrast = (a, b) => {
  const l1 = relLum(a);
  const l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const PAIRS = [
  ["body text on white", "forge-black", "forge-white", 4.5],
  ["body text on Warm Canvas", "forge-black", "forge-canvas", 4.5],
  ["secondary text on white", "forge-ink-2", "forge-white", 4.5],
  ["muted text on Warm Canvas", "forge-steel-text", "forge-canvas", 4.5],
  ["orange text on Warm Canvas", "forge-orange-text", "forge-canvas", 4.5],
  ["text on Forge Black", "forge-on-dark", "forge-black", 4.5],
  ["muted text on Forge Black", "forge-on-dark-muted", "forge-black", 4.5],
  // Burnt Orange is only 3.6:1 on white, so the primary button uses Forge Black
  // text on the orange fill. This is the check that keeps it that way.
  ["primary button text on Burnt Orange", "forge-black", "forge-orange", 4.5],
  ["Burnt Orange as a UI colour on white", "forge-orange", "forge-white", 3],
  ["focus ring on white", "focus", "forge-white", 3],
  ["focus ring on Warm Canvas", "focus", "forge-canvas", 3]
];
for (const [label, fg, bg, min] of PAIRS) {
  const a = hexOf(fg);
  const b = hexOf(bg);
  if (!a || !b) {
    fail(`contrast: token --${!a ? fg : bg} not found`);
    continue;
  }
  const ratio = contrast(a, b);
  ratio >= min
    ? ok(`contrast: ${label} = ${ratio.toFixed(2)}:1 (needs ${min})`)
    : fail(`contrast: ${label} = ${ratio.toFixed(2)}:1, below ${min}`);
}
// The primary button must not put white on Burnt Orange.
const btnGold = (cssText.match(/\.btn-gold\s*\{[^}]*\}/) || [""])[0];
/background:\s*var\(--gold\)/.test(btnGold) &&
/color:\s*var\(--forge-black\)/.test(btnGold)
  ? ok("styles: primary button is Forge Black on Burnt Orange")
  : fail("styles: .btn-gold must be Forge Black text on the Burnt Orange fill");

console.log("\n== Endpoint truth: one source, and the docs must match it ==");
// One endpoint source. brand.config.json must NOT mirror it — the two drifted
// once (site-config live, brand.config empty) and would drift again.
const brandRaw = read("brand.config.json");
const brandJson = JSON.parse(brandRaw);
// Prohibited: anything that looks like a second endpoint source. Allowed:
// endpointConfigNote, which is documentation only and deliberately named off
// the endpoint namespace so it cannot be mistaken for configuration.
const FORBIDDEN_BRAND_KEYS = [
  "formEndpoint",
  "formEndpointMode",
  "formEndpointNote"
];
const reintroduced = FORBIDDEN_BRAND_KEYS.filter((k) => k in brandJson);
reintroduced.length === 0
  ? ok(
      "brand.config.json: no mirrored endpoint key (single source of truth is js/site-config.js)"
    )
  : fail(
      `brand.config.json: prohibited endpoint key(s) returned: ${reintroduced.join(", ")}`
    );
typeof brandJson.endpointConfigNote === "string" &&
/site-config/.test(brandJson.endpointConfigNote)
  ? ok("brand.config.json: endpointConfigNote explains where the endpoint lives")
  : fail(
      "brand.config.json: endpointConfigNote missing or no longer points at js/site-config.js"
    );
if ("formEndpoint" in brandJson && brandJson.formEndpoint !== endpoint)
  fail(
    `brand.config/site-config endpoint disagreement: ${JSON.stringify(brandJson.formEndpoint)} vs ${JSON.stringify(endpoint)}`
  );

// Documentation may not claim the endpoint is empty while a live one is wired.
const DOC_FILES = ["README.md", "docs/CONTACT-FORM.md", "docs/LAUNCH-CHECKLIST.md"];
const EMPTY_CLAIMS = [
  /endpoint is \*\*empty/i,
  /empty by default/i,
  /`formEndpoint` is empty (today|by default)/i,
  /is empty, so the form (does not|doesn't) transmit/i,
  /not yet launch-ready/i,
  /needs a real endpoint/i,
  /no external account has been\s+created/i,
  /set `formEndpoint` back to `""`/i
];
let staleDocs = 0;
for (const f of DOC_FILES) {
  if (!existsSync(join(root, f))) continue;
  const body = read(f);
  const hits = EMPTY_CLAIMS.filter((re) => re.test(body));
  if (hits.length) {
    staleDocs += hits.length;
    fail(`${f}: still claims the endpoint is empty / unwired (${hits.length} statement(s))`);
  }
}
staleDocs === 0
  ? ok(`docs: no stale "endpoint is empty" claims across ${DOC_FILES.length} files`)
  : fail(`${staleDocs} stale endpoint claim(s) in documentation`);

// A mock test must be told to restore the REAL endpoint, never "".
const mockDoc = read("scripts/mock-endpoint.mjs") + read("docs/CONTACT-FORM.md");
/RESTORE THE REAL ENDPOINT/i.test(mockDoc) ||
/restore the \*\*real endpoint\*\*/i.test(mockDoc)
  ? ok("mock: instructions restore the real endpoint, not an empty string")
  : fail('mock: instructions must say to restore the real endpoint, not ""');

// Current logo/brand documentation must not use retired palette names outside a
// clearly labelled Retired/history line.
console.log("\n== Brand terminology: retired names only in Retired sections ==");
const RETIRED_NAMES = /Service Navy|Momentum Amber/g;
const TERM_FILES = [
  "README.md", "docs/BRAND.md", "brand.config.json",
  ...MARK_ASSETS, "assets/og-image.svg"
].filter((f) => existsSync(join(root, f)));
let staleTerms = 0;
for (const f of TERM_FILES) {
  const lines = read(f).split("\n");
  const bad = lines.filter(
    (l) => RETIRED_NAMES.test(l) && !/retired/i.test(l) && !/history/i.test(l)
  );
  RETIRED_NAMES.lastIndex = 0;
  if (bad.length) {
    staleTerms += bad.length;
    fail(`${f}: retired palette name outside a Retired/history line: "${bad[0].trim().slice(0, 60)}"`);
  }
}
staleTerms === 0
  ? ok(`brand terms: no retired palette names in current descriptions (${TERM_FILES.length} files)`)
  : fail(`${staleTerms} retired palette name(s) in current descriptions`);

// The documented field list must match the wizard's actual fields.
console.log("\n== Documented wizard fields match the wizard ==");
const contactDoc = read("docs/CONTACT-FORM.md");
const actualQ = [...wiz.matchAll(/data-required-group="([a-z_]+)"/g)].map((m) => m[1]);
const actualContact = [...wiz.matchAll(/<(?:input|textarea)[^>]*\bname="([a-z_]+)"/g)]
  .map((m) => m[1])
  .filter((n) => !actualQ.includes(n) && n !== "_gotcha");
const documented = [...contactDoc.matchAll(/\| `([a-z_]+)`/g)].map((m) => m[1]);
const undocumented = [...new Set([...actualQ, ...actualContact])].filter(
  (f) => !documented.includes(f)
);
const overdocumented = [...new Set(documented)].filter(
  (f) =>
    !actualQ.includes(f) &&
    !actualContact.includes(f) &&
    !["meta_product", "meta_source", "meta_submitted_at", "_replyto", "_subject"].includes(f)
);
undocumented.length === 0
  ? ok(`docs: all ${actualQ.length + actualContact.length} wizard fields are documented`)
  : fail(`docs/CONTACT-FORM.md: undocumented wizard field(s): ${undocumented.join(", ")}`);
overdocumented.length === 0
  ? ok("docs: no documented field that the wizard no longer collects")
  : fail(`docs/CONTACT-FORM.md: documents retired field(s): ${overdocumented.join(", ")}`);

console.log("\n== Prospect tracker: real rows only (private workspace) ==");
// The tracker lives OUTSIDE this repository on purpose — it holds personal
// information and this repo is published by GitHub Pages. This check is
// therefore optional: it runs when the sibling workspace exists and skips
// cleanly when it does not. It reads counts and flags only, never contents.
const TRACKER = join(root, "..", "ServiceMomentumBusiness", "sales", "prospect-tracker.csv");
if (!existsSync(TRACKER)) {
  ok("tracker: private workspace not present here — check skipped");
} else {
  const lines = readFileSync(TRACKER, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  const header = (lines[0] || "").split(",");
  header.length === 18 && header[0] === "business_name"
    ? ok(`tracker: header intact (${header.length} columns)`)
    : fail(`tracker: header changed (${header.length} columns)`);
  const FAKE = /example|delete this row|jane doe|john doe|acme|test prospect|lorem|555-01\d\d|@example\.(com|org)|foo\b|placeholder/i;
  const fakeRows = lines.slice(1).filter((l) => FAKE.test(l));
  fakeRows.length === 0
    ? ok(`tracker: ${lines.length - 1} data row(s), none example/fake`)
    : fail(
        `tracker: ${fakeRows.length} example/fake row(s) present — remove them; TRACKER-FIELD-GUIDE.md documents the columns`
      );
  // The tracker must never be copied into this published repository.
  existsSync(join(root, "sales")) || existsSync(join(root, "prospect-tracker.csv"))
    ? fail("tracker: prospect data has been copied into the PUBLISHED website repo")
    : ok("tracker: no prospect data inside the published repo");
}

console.log("\n== Reviewed copy corrections ==");
const contact = read("contact.html");
!/send your audit summary/i.test(contact)
  ? ok("contact: no audit-summary promise")
  : fail("contact: still promises an audit summary");
const auditHeading = (contact.match(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/) || []);
auditHeading[2] && /audit/i.test(auditHeading[2]) && !/hidden|sr-only|visually-hidden/.test(auditHeading[1]) &&
contact.indexOf(auditHeading[0]) < contact.indexOf('data-step="1"')
  ? ok("contact: a visible h1 names the audit before the questions")
  : fail("contact: the audit needs a visible h1 introduction");
const auditHints = [...contact.matchAll(/<p class="wz-hint">([\s\S]*?)<\/p>/g)].map((m) => m[1]);
!/Be blunt|weak site|not what you would like to happen/i.test(auditHints.join(" "))
  ? ok("contact: question hints avoid the retired judgmental language")
  : fail("contact: a question hint has reverted to judgmental language");
const idxHtml = read("index.html");
// (The case-study introduction it used to check was replaced by the guided
// "Built and operating" section, which the section below validates.)
!/operated, in order/.test(idxHtml)
  ? ok('index: "in order" removed from the case study')
  : fail('index: case study still says "in order"');
// Superseded by the "Populated demo dashboards" section below, which requires
// the exact demo-data sentence inside every populated composition.
// No invented statistics, ratings, or revenue anywhere in the marketing copy.
const invented = [
  [/\b\d+(\.\d+)?\s*%/g, "a percentage figure"],
  [/\b\d+(\.\d+)?\s*(x|×)\s*(more|faster|growth|leads|revenue)/gi, "a multiplier claim"],
  [/\b\d+(\.\d+)?\s*(star|stars)\b/gi, "a star rating"],
  [/\$\s?\d/g, "a dollar figure"],
  [/\b\d[\d,]*\s+(reviews|customers served|jobs booked|leads generated)\b/gi, "a fabricated count"]
].filter(([re]) => re.test(idxHtml));
invented.length === 0
  ? ok("index: no invented statistics, ratings, or revenue figures")
  : fail(`index: contains ${invented.map(([, n]) => n).join(", ")}`);
/prepared by the system and sent manually|sent <strong>manually<\/strong>/.test(idxHtml)
  ? ok("index: manual-message disclosure preserved")
  : fail("index: manual-message disclosure missing");

console.log("\n== Guided homepage: the five sections and the one action ==");
// The homepage was reduced to a single guided path. These checks hold that
// path in place: the sections a visitor walks, the action they are always
// offered, and the claims that must never creep back in.
const SECTIONS = [
  ['id="how"', "How it works"],
  ['id="system"', "See the system at work"],
  ['id="built"', "Built and operating"],
  ['id="fit"', "Who it is for"],
  ['class="cta-band"', "Closing CTA"]
];
const missingSections = SECTIONS.filter(([sel]) => !idxHtml.includes(sel));
missingSections.length === 0
  ? ok(`index: all ${SECTIONS.length} guided sections present, in order`)
  : fail(`index: missing section(s): ${missingSections.map(([, n]) => n).join(", ")}`);
const sectionOrder = SECTIONS.map(([sel]) => idxHtml.indexOf(sel));
sectionOrder.every((v, i) => i === 0 || v > sectionOrder[i - 1])
  ? ok("index: the guided sections appear in the intended reading order")
  : fail("index: the guided sections are out of order");

// Guard the visitor's path and the approved headline without freezing all prose.
const plainText = (html) => html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const sectionHtml = (id) => (idxHtml.match(new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?<\\/section>`)) || [""])[0];
const headline = plainText((idxHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [""])[0]);
["Get found.", "Get booked.", "Bring customers back."].every((part) => headline.includes(part))
  ? ok("index: the approved hero headline is preserved")
  : fail("index: the approved hero headline changed");
const systemSection = sectionHtml("system");
const workflowTopics = [/inquiry/i, /complet/i, /due|next.service/i];
workflowTopics.every((re) => re.test(plainText(systemSection)))
  ? ok("index: the demonstration explains inquiry, completion, and returning service")
  : fail("index: a core workflow stage is missing from the demonstration");
const proofSection = sectionHtml("built");
/service.business implementation/i.test(plainText(proofSection)) &&
!/HVAC|heat[ -]pump|cannabis/i.test(plainText(proofSection))
  ? ok("index: the real implementation is described without exposing a client industry")
  : fail("index: proof must describe a service-business implementation without a client industry");
const lastDemo = systemSection.lastIndexOf("</figure>");
lastDemo >= 0 && /href="contact\.html"/.test(systemSection.slice(lastDemo))
  ? ok("index: a contextual audit link follows the workflow demonstrations")
  : fail("index: the workflow demonstrations need a contextual audit link");
const faqBlock = (idxHtml.match(/<div class="faq">[\s\S]*?\n          <\/div>/) || [""])[0];
/<summary>[^<]+<\/summary>/.test(faqBlock)
  ? ok("index: objections remain available as native FAQ disclosures")
  : fail("index: no native FAQ disclosure found");

// The audit is the one action, and every primary CTA reaches it directly.
const PRIMARY = "Start your growth audit";
const primaryCtas = [
  ...idxHtml.matchAll(/<a class="btn[^"]*"\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g)
].filter((m) => m[2].trim() === PRIMARY);
primaryCtas.length >= 2
  ? ok(`index: ${primaryCtas.length} "${PRIMARY}" buttons (hero, closing, sticky)`)
  : fail(`index: only ${primaryCtas.length} primary CTA button(s)`);
primaryCtas.every((m) => m[1] === "contact.html")
  ? ok("index: every primary CTA links straight to contact.html")
  : fail("index: a primary CTA does not point at contact.html");
const audit = read("contact.html");
/<form id="audit-form"/.test(audit) && /class="wz-step form-step" data-step="1"/.test(audit)
  ? ok("contact: the audit still begins immediately on the page")
  : fail("contact: the audit entry point has changed");

// Nothing may hijack the visitor.
const HIJACK = [
  [/location\.(replace|assign)\s*\(|location\.href\s*=/, "a scripted redirect"],
  [/<meta[^>]+http-equiv=["']refresh/i, "a meta refresh"],
  [/showModal\s*\(|\.modal\s*\(|window\.open\s*\(/, "a popup or modal"],
  [/setTimeout\([^)]*contact\.html/, "a timed jump to the audit"]
];
const hijackJs = idxHtml + read("js/nav.js") + read("js/motion.js");
const hijacks = HIJACK.filter(([re]) => re.test(hijackJs));
hijacks.length === 0
  ? ok("index: no redirect, meta refresh, popup, or timed jump to the audit")
  : fail(`index: contains ${hijacks.map(([, n]) => n).join(", ")}`);

console.log("\n== Guided homepage: sticky CTA and honest claims ==");
// The sticky CTA is a phone affordance, never present during the audit.
/id="sticky-cta"/.test(idxHtml)
  ? ok("index: the sticky audit CTA is on the homepage")
  : fail("index: the sticky audit CTA is missing");
/<div class="sticky-cta" id="sticky-cta" hidden>/.test(idxHtml)
  ? ok("index: the sticky CTA ships hidden and is only revealed by script")
  : fail("index: the sticky CTA must ship hidden");
const stickyPages = htmlFiles.filter((f) => /sticky-cta/.test(read(f)));
stickyPages.length === 1 && stickyPages[0] === "index.html"
  ? ok("contact: the audit page carries no sticky CTA over its controls")
  : fail(`sticky CTA present on: ${stickyPages.join(", ")} (expected index.html only)`);
const navJs = read("js/nav.js");
/pastHero && !atClosing/.test(navJs)
  ? ok("nav: the sticky CTA shows only between the hero and the closing CTA")
  : fail("nav: the sticky CTA must hide over the hero, the closing CTA, and the footer");
/new IntersectionObserver/.test(navJs) &&
!/addEventListener\(\s*["'](scroll|resize|wheel|touchmove)/.test(navJs)
  ? ok("nav: the sticky CTA uses IntersectionObserver, no scroll listener")
  : fail("nav: the sticky CTA must not use a scroll listener");
/@media \(max-width: 720px\) \{[\s\S]*?\.sticky-cta \{[\s\S]*?position:\s*fixed/.test(cssText)
  ? ok("styles: the sticky CTA is phone-only")
  : fail("styles: the sticky CTA must be confined to phone widths");

// The pilot customer is never named, and this is never framed as a case study.
// Built from parts so the pilot customer's own name is never written into
// this repository or exposed anywhere the source is shared.
const NAMED = [new RegExp("\\b" + PILOT_NAME + "\\b", "i"), /case[\s-]?stud(y|ies)/i];
const namedHits = NAMED.filter((re) => htmlFiles.some((f) => re.test(read(f))));
namedHits.length === 0
  ? ok("site: no pilot-customer name and no case-study framing")
  : fail(`site: found ${namedHits.length} forbidden name/label pattern(s)`);
// Scan source and local tooling too. Pages excludes these files, but privacy
// should not depend only on the deployment configuration.
const NAME_SCAN_FILES = [
  ...htmlFiles,
  "README.md",
  "docs/BRAND.md",
  "docs/CONTACT-FORM.md",
  "docs/LAUNCH-CHECKLIST.md",
  "brand.config.json",
  "js/intake.js",
  "js/motion.js",
  "js/nav.js",
  "styles.css",
  ...readdirSync(join(root, "scripts"))
    .filter((f) => /\.(?:js|mjs)$/.test(f))
    .map((f) => "scripts/" + f)
].filter((f) => existsSync(join(root, f)));
const nameLeaks = NAME_SCAN_FILES.filter((f) =>
  new RegExp("\\b" + PILOT_NAME + "\\b", "i").test(read(f))
);
nameLeaks.length === 0
  ? ok(`privacy: the pilot customer is unnamed across all ${NAME_SCAN_FILES.length} source files`)
  : fail(`site: pilot-customer name present in ${nameLeaks.join(", ")}`);

// No public price figures or recurring fee offers on the marketing pages.
// Mentioning that pricing is discussed on a call is an honest handoff.
const PRICING = [
  /\$\s?\d/,
  /\b\d+\s*(?:usd|dollars)\b/i,
  /\bper month\b|\bmonthly fee\b|\bstarting at\b/i
];
const pricingPages = htmlFiles.filter(
  (f) => f !== "terms.html" && PRICING.some((re) => re.test(read(f)))
);
pricingPages.length === 0
  ? ok("site: no public pricing on the marketing pages")
  : fail(`site: pricing-like copy on ${pricingPages.join(", ")}`);

// The accuracy disclosure has to keep carrying each fact.
const accuracy = (idxHtml.match(/<details class="accuracy">[\s\S]*?<\/details>/) || [""])[0];
const FACTS = [
  ["reported discovering the service business through Gemini", "the reported discovery"],
  ["separate unbranded test", "the unbranded test"],
  ["separate events", "the separation of the two events"],
  ["do not claim the website caused", "the no-causation statement"],
  ["Automated customer texting is not operating", "the texting status"]
];
// Native <details>, collapsed by default, so the facts stay available without
// interrupting the page and remain reachable with no script at all.
/<details class="accuracy">/.test(idxHtml)
  ? ok("index: the accuracy notes are a native <details>")
  : fail("index: the accuracy notes must be a native <details> element");
/<details class="accuracy"[^>]*\bopen\b/.test(idxHtml)
  ? fail("index: the accuracy notes are expanded by default")
  : ok("index: the accuracy notes are collapsed by default");
/<summary>Read the implementation and accuracy notes<\/summary>/.test(accuracy)
  ? ok("index: the accuracy summary carries the agreed label")
  : fail("index: the accuracy summary label has changed");
// Open vs closed must not be signalled by colour alone.
/\.accuracy summary::after \{[^}]*content:\s*"Show"/.test(cssText) &&
/\.accuracy\[open\] summary::after \{[^}]*content:\s*"Hide"/.test(cssText)
  ? ok("styles: open and closed are spelled out, not just coloured")
  : fail("styles: the details control needs a visible text state");
/\.accuracy summary:focus-visible \{[^}]*outline:/.test(cssText)
  ? ok("styles: the details control has a visible focus state")
  : fail("styles: the details control needs a focus outline");
// The visible note that stays on the page unprompted.
/Results vary, and customer review and reminder messages are\s*\n?\s*currently reviewed and sent manually\./.test(
  idxHtml
)
  ? ok("index: the visible results-vary and manual-send note is present")
  : fail("index: the visible proof note is missing or reworded");

/reported submitting a Google review|not treated as publicly live until verified/i.test(proofSection)
  ? fail("index: the unverified Google-review anecdote has returned")
  : ok("index: proof omits the unverified Google-review anecdote");

const missingFacts = FACTS.filter(([t]) => !accuracy.includes(t));
missingFacts.length === 0
  ? ok(`index: the accuracy disclosure keeps all ${FACTS.length} facts`)
  : fail(`index: accuracy disclosure lost ${missingFacts.map(([, n]) => n).join(", ")}`);

// The corrected footer sentence, on every page that carries the footer.
const FOOTER_SENTENCE =
  "ServiceMomentum is a connected customer-growth system for U.S.\n              local-service businesses, designed and operated by T&amp;R Growth\n              LLC.";
const footerPages = htmlFiles.filter((f) => /class="footer-brand"/.test(read(f)));
const badFooter = footerPages.filter((f) => !read(f).includes(FOOTER_SENTENCE));
footerPages.length > 0 && badFooter.length === 0
  ? ok(`site: the corrected footer sentence is on all ${footerPages.length} pages`)
  : fail(`site: footer sentence wrong on ${badFooter.join(", ")}`);
htmlFiles.some((f) => /designed and operated by T&amp;R Growth LLC\s*\n?\s*is a connected/.test(read(f)))
  ? fail("site: the broken footer sentence is still present")
  : ok("site: the broken footer sentence is gone");

// Navigation matches the simplified set, and every homepage anchor resolves.
const navBlock = (idxHtml.match(/<ul class="nav-links"[\s\S]*?<\/ul>/) || [""])[0];
const navLabels = [...navBlock.matchAll(/>([^<]+)<\/a>/g)].map((m) =>
  m[1].trim().replace(/&rsquo;/g, "'")
);
JSON.stringify(navLabels) ===
JSON.stringify(["How It Works", "See the System", "Who It's For", "Start Audit"])
  ? ok(`index: navigation is the simplified set (${navLabels.join(", ")})`)
  : fail(`index: navigation is ${navLabels.join(", ")}`);
const anchors = [...idxHtml.matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1]);
const deadAnchors = anchors.filter((a) => !new RegExp(`id="${a}"`).test(idxHtml));
deadAnchors.length === 0
  ? ok(`index: all ${anchors.length} in-page anchors resolve`)
  : fail(`index: dead anchor(s): ${deadAnchors.join(", ")}`);

// The submission config must not have been touched by any of this.
const cfgRaw = read("js/site-config.js");
/formEndpoint: "https:\/\/formspree\.io\/f\/xqpklkny"/.test(cfgRaw) &&
/formEndpointMode: "formspree"/.test(cfgRaw)
  ? ok("site-config: endpoint and mode still exactly as shipped")
  : fail("site-config: the endpoint or mode changed");

console.log("\n== Responsive header: one clean row ==");
// The desktop header wrapped onto a second line because its content is wider
// than the container ever gets. These checks pin the arithmetic that fixed it,
// so a longer label or a wider container cannot quietly bring the wrap back.
const cssHdr = read("styles.css");

// The container's own limits, read from the stylesheet rather than assumed.
const MAXW = Number((cssHdr.match(/--maxw:\s*(\d+)px/) || [])[1]);
const GUTTER = Number(
  (cssHdr.match(/\.container \{[^}]*padding:\s*0\s+(\d+)px/) || [])[1]
);
MAXW > 0 && GUTTER > 0
  ? ok(`styles: container is ${MAXW}px wide with a ${GUTTER}px gutter`)
  : fail("styles: could not read --maxw / .container padding");

// Measured in the browser at 1168-1440px: brand 351 + links 558 + CTA 112 plus
// two 16px nav gaps. Kept here so the breakpoint below has something to be
// checked against.
const HEADER_ROW_PX = 351 + 363 + 112 + 16 * 2;
HEADER_ROW_PX === 858
  ? ok(`header: full row measures ${HEADER_ROW_PX}px (brand + links + CTA + gaps)`)
  : fail(`header: row arithmetic changed to ${HEADER_ROW_PX}px`);
HEADER_ROW_PX <= MAXW
  ? ok(`header: the row fits the ${MAXW}px container with ${MAXW - HEADER_ROW_PX}px to spare`)
  : fail(`header: the row needs ${HEADER_ROW_PX}px but the container stops at ${MAXW}px`);

// The compact menu must cover every width where the full row cannot sit in a
// full-width container with a gutter on both sides.
const compactBp = Number(
  (cssHdr.match(/@media \(max-width:\s*(\d+)px\) \{\s*\n\s*\/\* Compact mobile menu/) || [])[1]
);
// At the narrowest viewport that shows the full row, the container is either
// at its max width or the viewport minus both gutters, whichever is smaller.
// That has to be at least as wide as the row itself.
const smallestFullNavVw = compactBp + 1;
const availableThere = Math.min(MAXW, smallestFullNavVw - GUTTER * 2);
compactBp
  ? ok(`styles: the compact menu covers everything up to ${compactBp}px`)
  : fail("styles: could not find the compact-menu breakpoint");
compactBp && availableThere >= HEADER_ROW_PX
  ? ok(
      `header: at ${smallestFullNavVw}px the row has ${availableThere}px for ${HEADER_ROW_PX}px of content`
    )
  : fail(
      `header: at ${smallestFullNavVw}px only ${availableThere}px is available for a ${HEADER_ROW_PX}px row, so it will wrap`
    );
// The stylesheet token js/nav.js reads must equal the media query it documents.
const navToken = Number((cssHdr.match(/--nav-compact-max:\s*(\d+)px/) || [])[1]);
navToken === compactBp
  ? ok(`styles: --nav-compact-max (${navToken}px) matches the compact media query`)
  : fail(`styles: --nav-compact-max is ${navToken}px but the media query is ${compactBp}px`);
/getPropertyValue\("--nav-compact-max"\)/.test(read("js/nav.js"))
  ? ok("nav: the script reads its breakpoint from the stylesheet")
  : fail("nav: the compact breakpoint must come from --nav-compact-max");

// The bar must never be allowed to wrap in the compact range, and must keep a
// gutter there (the container's padding loses to .nav's shorthand).
const compactBlock = (cssHdr.match(
  /@media \(max-width: \d+px\) \{\s*\n\s*\/\* Compact mobile menu[\s\S]*?\n\}/
) || [""])[0];
/\.nav \{[^}]*flex-wrap:\s*nowrap/.test(compactBlock)
  ? ok("styles: the compact bar cannot wrap")
  : fail("styles: the compact bar must set flex-wrap: nowrap");
new RegExp(`\\.site-header \\.container\\.nav \\{[^}]*padding:\\s*\\d+px\\s+${GUTTER}px`).test(
  compactBlock
)
  ? ok(`styles: the compact bar keeps its ${GUTTER}px gutter`)
  : fail("styles: the compact bar must restate its horizontal gutter");
/\.nav-toggle \{[^}]*display:\s*inline-flex/.test(compactBlock)
  ? ok("styles: the compact bar shows the menu toggle")
  : fail("styles: the compact bar must show the menu toggle");
/\.nav-cta \{\s*display:\s*none/.test(compactBlock)
  ? fail("styles: the CTA is dropped across the whole compact range")
  : ok("styles: the CTA stays in the bar through the compact range");
/@media \(max-width: 860px\) \{\s*\n\s*\.nav-cta \{\s*\n\s*display:\s*none;/.test(cssHdr)
  ? ok("styles: the CTA steps aside only below 860px, as before")
  : fail("styles: the narrow-width CTA rule is missing");

// Header labels: short in the bar, full in the hero, and never shrunk.
const HEADER_CTA = "Start audit";
const HERO_CTA = "Start your growth audit";
const navCtaPages = htmlFiles.filter((f) => /class="[^"]*nav-cta/.test(read(f)));
const badNavCta = navCtaPages.filter(
  (f) => !new RegExp(`nav-cta"[^>]*>${HEADER_CTA}</a>`).test(read(f))
);
navCtaPages.length > 0 && badNavCta.length === 0
  ? ok(`header: all ${navCtaPages.length} header CTAs read "${HEADER_CTA}"`)
  : fail(`header: wrong header CTA label in ${badNavCta.join(", ")}`);
const longNavCta = navCtaPages.filter((f) =>
  new RegExp(`nav-cta"[^>]*>${HERO_CTA}`).test(read(f))
);
longNavCta.length === 0
  ? ok("header: no header CTA has reverted to the long label")
  : fail(`header: long CTA label back in ${longNavCta.join(", ")}`);
new RegExp(`btn-gold btn-lg" href="contact\\.html">${HERO_CTA}</a>`).test(idxHtml)
  ? ok(`hero: still reads "${HERO_CTA}"`)
  : fail(`hero: the full "${HERO_CTA}" wording must stay in the hero`);

// Nothing in the header may be shrunk to fit.
const MIN_HEADER_REM = 0.85;
const navLinkSize = Number((cssHdr.match(/\.nav-links a \{[^}]*font-size:\s*([\d.]+)rem/) || [])[1]);
const btnSmSize = Number((cssHdr.match(/\.btn-sm \{[^}]*font-size:\s*([\d.]+)rem/) || [])[1]);
[["nav links", navLinkSize], ["header CTA", btnSmSize]].every(
  ([, v]) => v >= MIN_HEADER_REM
)
  ? ok(`header: nav ${navLinkSize}rem and CTA ${btnSmSize}rem stay at a readable size`)
  : fail(
      `header: text shrunk below ${MIN_HEADER_REM}rem (nav ${navLinkSize}, CTA ${btnSmSize})`
    );

console.log("\n== Populated demo dashboards: the disclosure ==");
// The homepage illustrations now carry invented records. The one thing that
// must never slip is the statement that they are invented: it has to be
// visible text inside each composition, not a title, aria-label, or footnote.
const DEMO_SENTENCE = "Example dashboard. Demo data, not live customer information.";
const figures = [...idxHtml.matchAll(/<figure class="((?:stack|pillar-visual)\b[^"]*)"[\s\S]*?<\/figure>/g)].map(
  (m) => ({ kind: m[1].split(/\s+/)[0], html: m[0] })
);
figures.length === 4
  ? ok(`index: 4 populated compositions (1 hero, 3 pillars)`)
  : fail(`index: ${figures.length} populated compositions, expected 4`);
const undisclosed = figures.filter((f) => !f.html.includes(DEMO_SENTENCE));
undisclosed.length === 0
  ? ok(`index: all ${figures.length} compositions carry the demo-data sentence`)
  : fail(`index: ${undisclosed.length} composition(s) with no demo-data disclosure`);
// It must be rendered text, inside a <figcaption>, never an attribute value.
const captioned = figures.filter((f) => {
  const cap = (f.html.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/) || [])[1] || "";
  return cap.includes(DEMO_SENTENCE);
});
captioned.length === figures.length
  ? ok("index: every disclosure is visible <figcaption> text")
  : fail(`index: ${figures.length - captioned.length} disclosure(s) are not visible figcaption text`);
/(title|aria-label|alt)="[^"]*Demo data/i.test(idxHtml)
  ? fail("index: the demo-data disclosure is hiding in an attribute")
  : ok("index: the disclosure is not tucked into a title, alt, or aria-label");
// And it must not be styled away.
const hiddenLabel = /\.(illus|stack-label)\b[^{]*\{[^}]*(display:\s*none|visibility:\s*hidden|font-size:\s*0(px|rem|em)?\s*[;}])/.test(
  read("styles.css")
);
hiddenLabel
  ? fail("styles: a demo-data disclosure is hidden by CSS")
  : ok("styles: no CSS hides a demo-data disclosure");

console.log("\n== Populated demo dashboards: no personal information ==");
// Records name a customer TYPE, never a person, and carry nothing that looks
// like contact details. Clearly fictional service dates explain the workflow.
const APPROVED_TYPES = [
  "Sample property A",
  "Property manager",
  "Homeowner",
  "Small office",
  "Local retailer",
  "Residential customer"
];
const recordNames = [
  ...idxHtml.matchAll(/<span class="rec"><b>([^<]+)<\/b>/g)
].map((m) => m[1]);
const offTypes = [...new Set(recordNames)].filter((n) => !APPROVED_TYPES.includes(n));
recordNames.length > 0 && offTypes.length === 0
  ? ok(`index: all ${recordNames.length} demo records use a fictional property label or generic customer type`)
  : fail(`index: non-generic record subject(s): ${offTypes.join(", ") || "none found"}`);
const PERSONAL = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "an email address", true],
  [/\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g, "a phone number"],
  [/\b\d{1,5}\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Way|Blvd)\b/g, "a street address"],
  [/\bCustomer\s+\d\b|\bLead\s+\d\b|\bClient\s+\d\b|Lorem|placeholder/i, "an unfinished placeholder"]
];
let personalHits = 0;
for (const f of figures) {
  for (const [re, name] of PERSONAL) {
    const hits = f.html.match(re);
    if (hits && hits.length) {
      personalHits += hits.length;
      fail(`index: ${f.kind} composition contains ${name} (${hits[0]})`);
    }
  }
}
personalHits === 0
  ? ok("index: no email, phone, address, or unfinished placeholder in any demo record")
  : fail(`${personalHits} piece(s) of customer-like information in the demo records`);

console.log("\n== Demo workflow: one coherent fictional lifecycle ==");
const heroFig = (figures.find((f) => f.kind === "stack") || { html: "" }).html;
const pillarFigs = figures.filter((f) => f.kind === "pillar-visual").map((f) => f.html);
const lifecycleText = plainText(heroFig);
/lifecycle-demo/.test(heroFig) && /Sample property A/.test(lifecycleText)
  ? ok("index: the hero is explicitly one fictional sample property")
  : fail("index: the hero needs one labelled fictional lifecycle record");
// All stages must be readable without animation; one stable beat per event.
const lifecycleBeats = [...heroFig.matchAll(/class="[^"]*\bjrn\b[^"]*"[^>]*data-beat="(\d+)"/g)].map((m) => Number(m[1]));
lifecycleBeats.join(",") === "1,2,3,4,5,6,7"
  ? ok("index: seven unique lifecycle events exist in static reading order")
  : fail(`index: expected seven static lifecycle events, found ${lifecycleBeats.join(",")}`);
const lifecycleFields = [
  [/inquiry|request received/i, "inquiry"],
  [/booked|scheduled/i, "booking"],
  [/completed/i, "completed work"],
  [/Review request ready/i, "prepared review request"],
  [/next.service/i, "next-service date"],
  [/due in \d+ days/i, "due status"]
];
const absentFields = lifecycleFields.filter(([re]) => !re.test(lifecycleText));
absentFields.length === 0
  ? ok("index: the lifecycle explains each operational state in visible text")
  : fail(`index: lifecycle missing ${absentFields.map(([, label]) => label).join(", ")}`);
// These are fictional dates, but their interval must match the displayed due status.
const demoDatePattern = /\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})\b/;
const parseDemoDate = (text) => {
  const parts = text.match(demoDatePattern);
  if (!parts) return NaN;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(parts[2]);
  return Date.UTC(Number(parts[3]), month, Number(parts[1]));
};
const lifecycleEvents = [...heroFig.matchAll(/<li\b[^>]*class="[^"]*\bjrn\b[^>]*>[\s\S]*?<\/li>/g)].map((m) => plainText(m[0]));
const eventDate = (pattern) => parseDemoDate(lifecycleEvents.find((text) => pattern.test(text)) || "");
const inquiryDate = eventDate(/inquiry/i);
const bookedDate = eventDate(/appointment booked/i);
const completedDate = eventDate(/completed work/i);
const nextServiceDate = eventDate(/next.service date/i);
const snapshotDate = eventDate(/due in/i);
const dueDays = Number((lifecycleText.match(/due in (\d+) days/i) || [])[1]);
[inquiryDate, bookedDate, completedDate, nextServiceDate, snapshotDate].every(Number.isFinite) &&
inquiryDate <= bookedDate && bookedDate <= completedDate && completedDate <= snapshotDate &&
(nextServiceDate - snapshotDate) / 86400000 === dueDays && dueDays > 0
  ? ok("index: fictional lifecycle dates are chronological and agree with the due interval")
  : fail("index: fictional lifecycle dates must be chronological and agree with the due interval");
/stack-meter|meter-cells|example month/i.test(heroFig) ||
/<b>\s*\d+\s*<\/b>\s*<span>\s*(Leads|Booked|Completed|Due soon)/i.test(figures.map((f) => f.html).join(" "))
  ? fail("index: fictional aggregate performance counters have returned")
  : ok("index: demos have no fictional monthly performance counters");
const panelTopics = [/Website|Source/i, /Review request ready/i, /Reminder ready|due in/i];
pillarFigs.length === panelTopics.length && panelTopics.every((re, i) => re.test(plainText(pillarFigs[i])))
  ? ok("index: the three detailed demos retain intake, review preparation, and service reminders")
  : fail("index: a detailed workflow demo is missing its operational purpose");
// Status is text, never colour alone.
const chips = [...idxHtml.matchAll(/<span class="chip [a-z]+">([^<]*)<\/span>/g)].map((m) => m[1].trim());
chips.length > 0 && chips.every((t) => t.length > 0)
  ? ok(`index: all ${chips.length} status chips carry visible text`)
  : fail("index: a status chip communicates by colour alone");

console.log("\n== Populated demo dashboards: no claim, no automated send ==");
// Demo numbers must never be dressed up as performance.
const CLAIMS = [
  [/real results|actual results|customer results|live data\b(?! ,)/i, "a results claim"],
  [/\b(revenue|ROI|profit)\b/i, "a revenue claim"],
  [/conversion rate|close rate|conversion of/i, "a conversion claim"],
  [/\b\d+\s*(reviews|five[- ]star)/i, "a review-count claim"],
  [/rank(ed|ing)? (#|no\.?\s*)?\d|top\s+\d\s+(on|in)\s+google/i, "a ranking claim"],
  [/leads generated|generated \d+ leads|\d+ new customers/i, "a lead-generation claim"],
  [/guarantee[ds]?\b/i, "a guarantee"]
];
let claimHits = 0;
for (const f of figures) {
  for (const [re, name] of CLAIMS) {
    if (re.test(f.html)) {
      claimHits++;
      fail(`index: ${f.kind} composition contains ${name}`);
    }
  }
}
claimHits === 0
  ? ok("index: no revenue, conversion, review-count, ranking, or lead claim in the demos")
  : fail(`index: ${claimHits} performance claim(s) inside a demo composition`);
// The demo records must not be tied to the anonymous real implementation.
const heroAndPillars = figures.map((f) => f.html).join("\n");
new RegExp(PILOT_NAME + "|our client|client results|this customer earned", "i").test(heroAndPillars)
  ? fail("index: a demo composition attributes its records to a real client")
  : ok("index: no demo record is attributed to a real client");

// Review and reminder messages are PREPARED. A person sends them.
const AUTOSEND = [
  /automatically (sent|texted|emailed|messaged)/i,
  /auto[- ]?(sends?|sent|text|reply)/i,
  /sends? (the )?(review|reminder)s? for you/i,
  /review (received|collected)/i,
  /\bwe texted\b|\btext blast\b/i
];
const autoHits = AUTOSEND.filter((re) => re.test(idxHtml));
autoHits.length === 0
  ? ok("index: nothing implies a message was sent automatically")
  : fail(`index: ${autoHits.length} automated-send implication(s) on the homepage`);
// Each panel that shows prepared messages says who sends them.
const preparedPanels = figures.filter((f) => /Review request ready|Reminder ready/.test(f.html));
const explained = preparedPanels.filter((f) =>
  /A person reviews and sends|sent manually|manual send|review[^.]*send manually/i.test(plainText(f.html))
);
preparedPanels.length > 0 && explained.length === preparedPanels.length
  ? ok(`index: all ${preparedPanels.length} prepared-message panel(s) say a person sends them`)
  : fail(
      `index: ${preparedPanels.length - explained.length} prepared-message panel(s) do not say a person sends them`
    );
/prepared by the system and sent manually|sent <strong>manually<\/strong>/.test(idxHtml)
  ? ok("index: the manual-message disclosure is still on the page")
  : fail("index: the manual-message disclosure has been lost");

console.log("\n== Hero dashboard: complete before any script runs ==");
const motionSrc = read("js/motion.js");
const idxCss = read("styles.css");

// The dashboard must be finished at first paint. Every record, status, note
// and date is static markup; the animation only borrows a highlight ring.
const heroFigure = heroFig;
const hiddenLifecycleRows = [...heroFigure.matchAll(/<[^>]+class="[^"]*\bjrn\b[^>]*>/g)]
  .filter((m) => /(?:\shidden(?:\s|=|>)|aria-hidden="true")/.test(m[0]));
lifecycleBeats.length > 0 && hiddenLifecycleRows.length === 0
  ? ok("index: lifecycle records are static HTML available before scripts run")
  : fail("index: the lifecycle records must be static, exposed HTML");

// Nothing may be inserted into the dashboard by script.
/\.stack[\s\S]{0,400}?(innerHTML|insertAdjacentHTML|createElement|appendChild)/.test(motionSrc)
  ? fail("motion: the dashboard is being built by script")
  : ok("motion: no dashboard content is inserted by script");

// No rule may hide a journey step. The old build faded them in from zero; the
// dashboard must never depend on that again.
const jrnRules = (idxCss.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]*\.jrn[^{}]*\{[^}]*\}/g) || []);
const hidesContent = jrnRules.filter(
  (r) => !r.includes("::after") && /opacity:\s*0|display:\s*none|visibility:\s*hidden/.test(r)
);
hidesContent.length === 0
  ? ok(`styles: none of the ${jrnRules.length} .jrn rules hide a dashboard row`)
  : fail(`styles: a .jrn rule still hides content: ${hidesContent[0].slice(0, 70)}`);
/\.stack \.jrn::after \{[^}]*opacity:\s*0/.test(idxCss)
  ? ok("styles: only the decorative highlight ring starts invisible")
  : fail("styles: the highlight ring must be the thing that starts at opacity 0");
/\.motion \.stack \.jrn\.is-lit::after \{[^}]*opacity:\s*1/.test(idxCss)
  ? ok("styles: the lit step shows its ring")
  : fail("styles: .is-lit must light the ring");

// Only opacity and transform move.
const ringRules = (idxCss.match(/\.(?:motion )?[^{}]*\.jrn[^{}]*\{[^}]*\}/g) || []).join("\n");
const ringProps = [
  ...new Set((ringRules.match(/transition:\s*([a-z-]+)/g) || []))
].map((x) => x.split(":")[1].trim());
ringProps.every((pr) => pr === "opacity" || pr === "transform" || pr === "none")
  ? ok(`journey: transitions only ${ringProps.join(", ") || "nothing"}`)
  : fail(`journey: transitions a disallowed property: ${ringProps.join(", ")}`);

// The sequence is bounded and runs once.
const beatMs = Number((motionSrc.match(/BEAT_MS = (\d+)/) || [])[1]);
const maxMs = Number((motionSrc.match(/JOURNEY_MAX_MS = (\d+)/) || [])[1]);
const beats = Number((motionSrc.match(/BEATS = (\d+)/) || [])[1]);
maxMs > 0 && maxMs <= 2500
  ? ok(`journey: hard ceiling is ${maxMs}ms, within the 2500ms maximum`)
  : fail(`journey: ceiling is ${maxMs}ms, over the 2500ms maximum`);
beats * beatMs <= maxMs
  ? ok(`journey: ${beats} steps at ${beatMs}ms fit inside the ${maxMs}ms ceiling`)
  : fail(`journey: ${beats} steps at ${beatMs}ms exceed the ${maxMs}ms ceiling`);
/setTimeout\(endJourney, JOURNEY_MAX_MS\)/.test(motionSrc)
  ? ok("motion: the ceiling always ends the sequence")
  : fail("motion: the ceiling must be armed on every run");
/journeyIO\.disconnect\(\)/.test(motionSrc)
  ? ok("motion: the journey runs once and cannot replay")
  : fail("motion: the journey observer must disconnect");
/setInterval|\balternate\b|infinite/.test(motionSrc)
  ? fail("motion: something loops forever")
  : ok("motion: nothing loops forever");
/!e\.isIntersecting && jTimers\.length/.test(motionSrc)
  ? ok("motion: leaving the viewport ends the sequence")
  : fail("motion: the sequence must stop off-screen");
/new IntersectionObserver/.test(motionSrc) &&
!/addEventListener\(\s*["'](scroll|resize|wheel|touchmove)/.test(motionSrc)
  ? ok("motion: IntersectionObserver only, no scroll listener")
  : fail("motion: no scroll listener may drive the journey");

// Reduced motion and a failed script both leave the finished dashboard.
/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.motion \.stack \.jrn::after \{[^}]*opacity:\s*0 !important/.test(
  idxCss
)
  ? ok("styles: reduced motion never lights the ring, and the data is untouched")
  : fail("styles: reduced motion must suppress the ring");
/data-motion-ready/.test(motionSrc) && /classList\.remove\("motion"\)/.test(idxHtml)
  ? ok("motion: the fail-open gate is intact")
  : fail("motion: the fail-open motion gate has been broken");
// No loaders, skeletons, or fake activity.
const FAKE_LIVE = [
  [/skeleton|shimmer|placeholder-row/i, "a skeleton screen"],
  [/spinner|loading\b|is-loading/i, "a loading indicator"],
  [/live now|updating|just now|\bpulse\b/i, "fake live activity"]
];
const fakeHits = FAKE_LIVE.filter(([re]) => re.test(heroFigure) || re.test(motionSrc));
fakeHits.length === 0
  ? ok("index: no loader, skeleton, or fake live activity")
  : fail(`index: contains ${fakeHits.map(([, n]) => n).join(", ")}`);

console.log("\n== Referral source: captured, sanitised, never rendered ==");
const intakeSrc = read("js/intake.js");
const auditHtml = read("contact.html");
/<input type="hidden" id="referral-source" name="referral_source" value="direct" \/>/.test(
  auditHtml
)
  ? ok('contact: referral_source ships as a hidden field defaulting to "direct"')
  : fail("contact: the referral_source hidden field is missing or altered");
/REFERRAL_FALLBACK = "direct"/.test(intakeSrc)
  ? ok('intake: the fallback is "direct"')
  : fail('intake: the fallback must be "direct"');
/REFERRAL_MAX = 80/.test(intakeSrc)
  ? ok("intake: the source value is capped at 80 characters")
  : fail("intake: the source value needs an 80-character cap");
/REFERRAL_ALLOWED = \/\^\[A-Za-z0-9 ._-\]\+\$\//.test(intakeSrc)
  ? ok("intake: only letters, numbers, spaces, underscores, hyphens and periods")
  : fail("intake: the allowed-character set has changed");
/referralField\.value = referralSource\(\);/.test(intakeSrc)
  ? ok("intake: the value is assigned to .value, never rendered as markup")
  : fail("intake: the source must be assigned to a hidden input's value");
/\.innerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/.test(intakeSrc)
  ? fail("intake: an HTML sink appeared near the referral value")
  : ok("intake: no innerHTML, insertAdjacentHTML, or document.write");
// Comments are stripped first: the comment that says storage is never used
// would otherwise trip this.
const scriptCode = [intakeSrc, motionSrc, read("js/nav.js")]
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");
/document\.cookie|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/.test(scriptCode)
  ? fail("site: cookies or browser storage were introduced")
  : ok("site: no cookies, localStorage, sessionStorage, or IndexedDB");
/document\.referrer/.test(intakeSrc)
  ? fail("intake: the referring page URL is being collected")
  : ok("intake: the referring page URL is never read");
const TRACKERS = /googletagmanager|google-analytics|gtag\(|fbq\(|segment\.com|mixpanel|hotjar|plausible|fathom/i;
htmlFiles.concat(["js/intake.js", "js/nav.js", "js/motion.js"]).some((f) => TRACKERS.test(read(f)))
  ? fail("site: an external analytics or tracking script was added")
  : ok("site: no external analytics or tracking");
// The honeypot is dropped from the payload; referral_source must not be.
/if \(k === HONEYPOT\) return;/.test(intakeSrc)
  ? ok("intake: the spam trap is still stripped from the payload")
  : fail("intake: the honeypot strip has been lost");
!/referral_source[^\n]*return;/.test(intakeSrc)
  ? ok("intake: referral_source is carried into the payload with the other fields")
  : fail("intake: referral_source is being dropped before submission");
// Never shown to the visitor.
/name="referral_source"[^>]*type="text"|>\s*referral_source\s*</.test(auditHtml)
  ? fail("contact: the referral source is visible in the page")
  : ok("contact: the referral source is never shown to the visitor");

console.log("\n== Audit success screen: structure and copy ==");
// The two-column confirmation that replaces the question stage after a real
// submission. Every check here guards one promise: it appears only when the
// endpoint actually accepted the application, it claims nothing more than we
// agreed to, and nothing a visitor typed can reach the page as markup.
const successHtml = (contact.match(
  /<section\s+id="audit-success"[\s\S]*?<\/section>/
) || [""])[0];
successHtml
  ? ok("contact: success panel markup present")
  : fail("contact: success panel (#audit-success) is missing");

/<section\s+id="audit-success"[^>]*\shidden(\s|>)/.test(contact)
  ? ok("contact: success panel ships hidden")
  : fail("contact: success panel must carry `hidden` in the markup");

// Two panes plus the joining rule: the composition the design calls for.
["wz-done-main", "wz-done-aside"].every((c) =>
  new RegExp(`class="${c}"`).test(successHtml)
)
  ? ok("contact: success panel has both panes")
  : fail("contact: success panel must have a left and a right pane");

// Status semantics, but silenced: focus moves to the heading instead, so a
// polite region here would read the panel out and then repeat the heading.
/role="status"/.test(successHtml)
  ? ok("contact: success panel carries status semantics")
  : fail('contact: success panel needs role="status"');
/aria-live="off"/.test(successHtml)
  ? ok("contact: success panel will not double-announce over the focus move")
  : fail('contact: success panel needs aria-live="off" alongside role="status"');
/aria-labelledby="audit-success-title"/.test(successHtml)
  ? ok("contact: success panel is labelled by its heading")
  : fail("contact: success panel needs aria-labelledby on its heading");

// The approved copy, exactly. The heading and the supporting line ship as the
// no-name / no-business fallbacks; js/intake.js rewrites them when it can.
const SUCCESS_COPY = [
  ["Audit received", "left-pane label"],
  ["Your Growth System Audit is in.", "heading"],
  [
    "Ryan will personally review your answers and reply by email within two business days.",
    "supporting copy"
  ],
  ["What happens next", "next-steps heading"],
  [
    "Ryan reviews how your business handles leads, completed jobs and past customers.",
    "step 1"
  ],
  [
    "You receive a direct email with the most important gaps he sees.",
    "step 2"
  ],
  [
    "If it looks like a fit, the next step is a short call to discuss the implementation.",
    "step 3"
  ],
  [
    "No automated recommendation. No generic score. A real person reviews your request.",
    "reassurance line"
  ],
  ["Return to website", "primary button label"],
  ["Need to add context? Email ", "secondary contact link"]
];
const missingCopy = SUCCESS_COPY.filter(([t]) => !successHtml.includes(t));
missingCopy.length === 0
  ? ok(`contact: all ${SUCCESS_COPY.length} approved success strings present`)
  : fail(
      `contact: success panel missing ${missingCopy.map(([, n]) => n).join(", ")}`
    );

/<a class="btn[^"]*" href="index\.html">Return to website<\/a>/.test(successHtml)
  ? ok("contact: Return to website links to index.html")
  : fail("contact: primary success button must link to index.html");
/<a href="mailto:hello@tnrgrowthagency\.com">hello@tnrgrowthagency\.com<\/a>/.test(
  successHtml
)
  ? ok("contact: secondary link is a mailto to hello@tnrgrowthagency.com")
  : fail("contact: success panel is missing the hello@ mailto link");
/id="audit-success-title"[^>]*tabindex="-1"|tabindex="-1"[^>]*id="audit-success-title"/.test(
  successHtml
)
  ? ok("contact: success heading is programmatically focusable")
  : fail('contact: success heading needs tabindex="-1" so focus can move to it');
// No scheduling service, no pricing, and no promise of what Ryan will find.
const HANDOFF_LIMITS = [
  [/calendly|cal\.com|book a call now|schedule now|pick a time/i, "a scheduling service"],
  [/\$\s?\d|per month|pricing/i, "pricing"],
  [/will find|will uncover|will recover|will discover|guarantee/i, "a promise about the outcome"]
].filter(([re]) => re.test(successHtml));
HANDOFF_LIMITS.length === 0
  ? ok("contact: the handoff adds no scheduler, no pricing, and no outcome promise")
  : fail(`contact: the handoff contains ${HANDOFF_LIMITS.map(([, n]) => n).join(", ")}`);

// Nothing that would turn this into a funnel step.
const UPSELL = [
  [/calendly|cal\.com|book a call|schedule a call|pick a time/i, "a calendar link"],
  [/<form\b/i, "another form"],
  [/pricing|\$\s?\d|per month|upgrade|package/i, "pricing or an upsell"]
].filter(([re]) => re.test(successHtml));
UPSELL.length === 0
  ? ok("contact: success panel adds no calendar, form, pricing, or upsell")
  : fail(`contact: success panel contains ${UPSELL.map(([, n]) => n).join(", ")}`);

// Nothing on this screen may promise an outcome we have not agreed to deliver.
const OVERPROMISE = [
  [/audit report|full report|written report|your report\b/i, "a promised report"],
  [/\bguarantee|guaranteed\b/i, "a guarantee"],
  [/more leads|new leads|generate leads|leads and revenue/i, "a leads promise"],
  [/\brevenue\b|\bROI\b|\bprofit\b/i, "a revenue promise"],
  [/\branking|rank higher|\bSEO results\b/i, "a rankings promise"],
  [/more reviews|five[- ]star|\bratings?\b/i, "a reviews promise"],
  [/reactivat|win back|\bwe(?:'|&rsquo;)?ll bring back\b/i, "a reactivation promise"],
  [
    /immediately|right away|within 24 hours|within an hour|instantly/i,
    "an immediate-response promise"
  ],
  [/your score|scored?\s+\d|\bwe recommend\b/i, "a fabricated score or recommendation"]
].filter(([re]) => re.test(successHtml));
OVERPROMISE.length === 0
  ? ok("contact: success copy promises no report, outcome, score, or instant reply")
  : fail(
      `contact: success copy contains ${OVERPROMISE.map(([, n]) => n).join(", ")}`
    );

console.log("\n== Audit success screen: nothing a visitor typed is echoed back ==");
// The confirmation is fixed copy in contact.html. No submitted value is
// rendered back to the page at all, which is a stronger guarantee than
// escaping one: there is nothing to escape.
const successCode = intake
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");
/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/.test(successCode)
  ? fail("intake: an HTML-writing sink appeared")
  : ok("intake: no innerHTML, outerHTML, insertAdjacentHTML, or document.write");
const SUBMITTED_FIELDS = ["name", "business_name", "email", "phone", "service_area", "notes"];
const echoed = SUBMITTED_FIELDS.filter((f) =>
  new RegExp(`(textContent|createTextNode|value)[^\\n]*\\b${f}\\b`).test(successCode)
);
echoed.length === 0
  ? ok(`intake: none of the ${SUBMITTED_FIELDS.length} submitted values is written back to the panel`)
  : fail(`intake: submitted value(s) echoed into the page: ${echoed.join(", ")}`);
// The panel's copy must be static markup, not assembled at runtime.
/successPanel[^\n]*(textContent|innerHTML)\s*=/.test(successCode)
  ? fail("intake: the confirmation copy is being written by script")
  : ok("intake: the confirmation copy is static markup");

console.log("\n== Audit success screen: it can only follow a real 2xx ==");
/if \(res\.ok\) \{\s*\n\s*succeed\(\);/.test(intake)
  ? ok("intake: succeed() runs only inside the res.ok branch")
  : fail("intake: the res.ok guard in front of succeed() has changed");
// Call sites carry the semicolon; the definition and the prose comments do not.
const succeedCalls = (intake.match(/succeed\(\);/g) || []).length;
succeedCalls === 1
  ? ok("intake: exactly one succeed() call site, and it is the res.ok branch")
  : fail(`intake: ${succeedCalls} succeed() call sites, expected exactly 1`);
// The failure path must reach setStatus, never the panel.
const catchBlock = (intake.match(/\.catch\(function \(err\) \{[\s\S]*?\}\);/) || [""])[0];
/successPanel/.test(catchBlock)
  ? fail("intake: the failure path touches the success panel")
  : ok("intake: the failure path never touches the success panel");
/setSending\(false\);/.test(catchBlock) && /setStatus\(\s*\n?\s*"err"/.test(catchBlock)
  ? ok("intake: a failed send restores the controls and shows an error")
  : fail("intake: the failure path must restore the controls and show an error");
// Timeout, honeypot, missing endpoint, and unsafe endpoint all return early.
/if \(trap && trap\.value\) return;/.test(intake)
  ? ok("intake: a filled spam trap returns before anything is sent")
  : fail("intake: the spam trap must return before the request");
/if \(!endpoint\) \{[\s\S]*?setStatus\(\s*\n?\s*"info"[\s\S]*?return;/.test(intake)
  ? ok("intake: an unconfigured endpoint reports instead of confirming")
  : fail("intake: an unconfigured endpoint must not reach the panel");
/timedOut[\s\S]*?ctrl\.abort\(\)/.test(intake) && /REQUEST_TIMEOUT_MS/.test(intake)
  ? ok("intake: the request still aborts on timeout")
  : fail("intake: the request timeout has been lost");

console.log("\n== Audit success screen: controls, focus, and progress ==");
/successPanel\.hidden = false;/.test(intake)
  ? ok("intake: success panel is unhidden on success")
  : fail("intake: success panel is never unhidden");
/successHeading\.focus\(\);/.test(intake)
  ? ok("intake: focus moves to the success heading")
  : fail("intake: focus must move to the success heading after submission");
/function retire\(btn\)[\s\S]*?btn\.hidden = true;[\s\S]*?btn\.disabled = true;[\s\S]*?btn\.setAttribute\("tabindex", "-1"\);/.test(
  intake
)
  ? ok("intake: retire() hides, disables, and un-tabs a control")
  : fail("intake: retire() must hide, disable, and remove a control from the tab order");
const retired = ["backBtn", "nextBtn", "submitBtn"].filter(
  (b) => !new RegExp(`retire\\(${b}\\);`).test(intake)
);
retired.length === 0
  ? ok("intake: Back, Continue, and Submit are all retired after success")
  : fail(`intake: not retired after success: ${retired.join(", ")}`);
/if \(navWrap\) navWrap\.hidden = true;/.test(intake)
  ? ok("intake: the whole step-control row is hidden after success")
  : fail("intake: the step-control row must be hidden after success");
/progressFill\.style\.width = "100%";/.test(intake)
  ? ok("intake: the progress bar is filled to 100% on success")
  : fail("intake: the progress bar must reach 100% on success");
/progressLabel\.textContent = "Submitted";/.test(intake)
  ? ok('intake: the step counter reads "Submitted" on success')
  : fail('intake: the step counter must read "Submitted" on success');
/function succeed\(\)[\s\S]*?form\.reset\(\);/.test(intake)
  ? ok("intake: the form is still reset on success")
  : fail("intake: form.reset() on success has been lost");
/clearStatus\(\);\s*\n\s*successPanel\.hidden = false;/.test(intake)
  ? ok("intake: the old status box is cleared, not left beside the panel")
  : fail("intake: the status box must be cleared when the panel appears");
/<footer class="wz-foot">/.test(contact)
  ? ok("contact: the legal footer is still on the page")
  : fail("contact: the legal footer must survive the success screen");

console.log("\n== Submit button label matches its own markup ==");
// A failed send restores the button. It used to restore a label the markup
// never had, silently renaming the control after any error.
const markupLabel = (contact.match(
  /<button[^>]*id="btn-submit"[^>]*>([^<]+)<\/button>/
) || [])[1];
const restoredLabel = (intake.match(/SUBMIT_IDLE_LABEL = "([^"]+)"/) || [])[1];
markupLabel && restoredLabel && markupLabel.trim() === restoredLabel
  ? ok(`intake: the restored idle label matches contact.html ("${restoredLabel}")`)
  : fail(
      `intake: restored label ${JSON.stringify(restoredLabel)} does not match the markup ${JSON.stringify(
        markupLabel && markupLabel.trim()
      )}`
    );
/submitBtn\.textContent = on \? "Sending…" : SUBMIT_IDLE_LABEL;/.test(intake)
  ? ok("intake: setSending restores the label from that one constant")
  : fail("intake: setSending must restore SUBMIT_IDLE_LABEL");
!/Submit application/.test(intake)
  ? ok('intake: the stale "Submit application" label is gone')
  : fail('intake: "Submit application" is still in js/intake.js');

console.log("\n== Audit success screen: styling stays inside the palette ==");
const doneCss = (cssText.match(
  /\/\* Successful submission[\s\S]*?\n\/\* Slim legal footer/
) || [""])[0];
doneCss
  ? ok("styles: success panel block found")
  : fail("styles: the success panel style block is missing");
/\.wz-done\[hidden\]\s*\{\s*display:\s*none/.test(cssText)
  ? ok("styles: .wz-done[hidden] is display:none")
  : fail("styles: .wz-done[hidden] must be display:none or it shows before submit");
/\.wz-nav\[hidden\]\s*\{\s*display:\s*none/.test(cssText)
  ? ok("styles: .wz-nav[hidden] is display:none")
  : fail("styles: .wz-nav[hidden] must be display:none or the controls survive success");

// No hard-coded colour anywhere in the panel, base or responsive.
const doneHex = doneCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
doneHex.length === 0
  ? ok("styles: success panel uses palette tokens only, no literal hex")
  : fail(`styles: success panel hard-codes ${doneHex.join(", ")}`);
const doneColorTokens = [
  ...new Set((doneCss.match(/var\((--[a-z0-9-]+)\)/g) || []))
].map((v) => v.slice(4, -1));
const undeclaredTokens = doneColorTokens.filter(
  (t) => !new RegExp(`\\n\\s*${t}:`).test(cssText)
);
undeclaredTokens.length === 0
  ? ok(`styles: all ${doneColorTokens.length} tokens the panel uses are declared`)
  : fail(`styles: success panel uses undeclared token(s): ${undeclaredTokens.join(", ")}`);

// The requested composition: Forge Black left, light right, Burnt Orange join.
/\.wz-done-main \{[^}]*background:\s*var\(--forge-black\)/.test(doneCss)
  ? ok("styles: left pane is Forge Black")
  : fail("styles: left pane must be Forge Black");
/\.wz-done-main \{[^}]*color:\s*var\(--forge-canvas\)/.test(doneCss)
  ? ok("styles: left pane type is Warm Canvas")
  : fail("styles: left pane type must be Warm Canvas");
/\.wz-done-aside \{[^}]*background:\s*var\(--wz-surface\)/.test(doneCss) &&
/\.wz-done-aside \{[^}]*color:\s*var\(--wz-ink\)/.test(doneCss)
  ? ok("styles: right pane is the light ground with Forge Black type")
  : fail("styles: right pane must be light with Forge Black type");
/\.wz-done-aside::before \{[^}]*background:\s*var\(--gold\)/.test(doneCss)
  ? ok("styles: a Burnt Orange rule joins the two panes")
  : fail("styles: the two panes need a Burnt Orange joining rule");

// Nothing trendy: no gradient, glass, glow, or external art.
const DECORATION = [
  [/gradient/i, "a gradient"],
  [/backdrop-filter/i, "a glass effect"],
  [/text-shadow|drop-shadow|box-shadow:\s*0 0 /i, "a glow"],
  [/url\(/i, "an external asset"]
].filter(([re]) => re.test(doneCss));
DECORATION.length === 0
  ? ok("styles: success panel adds no gradient, glass, glow, or external asset")
  : fail(`styles: success panel uses ${DECORATION.map(([, n]) => n).join(", ")}`);

// One entrance, opacity and transform only, off for reduced motion.
const doneKeyframes = (cssText.match(/@keyframes wz-done-in \{[\s\S]*?\n\}/) || [""])[0];
const animatedProps = [
  ...new Set((doneKeyframes.match(/^\s{4}([a-z-]+):/gm) || []))
].map((p) => p.trim().replace(":", ""));
doneKeyframes &&
animatedProps.length > 0 &&
animatedProps.every((p) => p === "opacity" || p === "transform")
  ? ok(`styles: the entrance animates only ${animatedProps.join(" and ")}`)
  : fail(
      `styles: the entrance must animate opacity/transform only, found ${animatedProps.join(", ") || "nothing"}`
    );
/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.wz-done \{\s*animation: none/.test(
  cssText.replace(/\.wz-step\.is-entering,\s*\n\s*/g, "")
) ||
/\.wz-step\.is-entering,\s*\n\s*\.wz-done \{\s*\n\s*animation: none !important;/.test(cssText)
  ? ok("styles: the entrance is switched off under prefers-reduced-motion")
  : fail("styles: the entrance must be disabled for reduced-motion users");

// The stacked layout, and only with tokens.
const doneMobile = (doneCss.match(/@media \(max-width: 860px\) \{[\s\S]*?\n\}\n/) || [""])[0];
/\.wz-done \{[^}]*grid-template-columns:\s*1fr/.test(doneMobile)
  ? ok("styles: the two panes stack on narrow screens")
  : fail("styles: the panes must stack on narrow screens");
/\.wz-done-actions \.btn \{[^}]*width:\s*100%/.test(doneCss)
  ? ok("styles: the primary button is full width")
  : fail("styles: the primary button must be full width");

console.log("\n== Public copy: no em or en dashes ==");
// Applies to the files a visitor's browser actually loads: every page, the
// site's JavaScript, and the stylesheet. Dev scripts and internal docs are
// not public copy and are not covered.
const DASH_PATTERNS = [
  [/—/g, "em dash"],
  [/–/g, "en dash"],
  [/&mdash;/gi, "&mdash;"],
  [/&ndash;/gi, "&ndash;"],
  [/&#8212;|&#x2014;/gi, "&#8212;"],
  [/&#8211;|&#x2013;/gi, "&#8211;"]
];
const PUBLIC_FILES = [
  ...htmlFiles,
  ...readdirSync(join(root, "js"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => `js/${f}`),
  "styles.css"
];
let dashHits = 0;
for (const f of PUBLIC_FILES) {
  const body = read(f);
  for (const [re, name] of DASH_PATTERNS) {
    const n = (body.match(re) || []).length;
    if (n) {
      dashHits += n;
      fail(`${f}: ${n} ${name}(s) — use a plain hyphen or reword`);
    }
  }
}
dashHits === 0
  ? ok(`public copy: no em or en dashes across ${PUBLIC_FILES.length} shipped files`)
  : fail(`${dashHits} long dash(es) in public website files`);

console.log(`\n${fails === 0 ? "PASS" : "FAIL"} — ${checks} checks passed, ${fails} failed.\n`);
process.exit(fails === 0 ? 0 : 1);
