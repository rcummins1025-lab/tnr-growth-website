#!/usr/bin/env node
/**
 * apply-brand.mjs — change the working PRODUCT NAME in one command.
 *
 * The product name ("ServiceMomentum") is a WORKING name and is not legally
 * finalized. Because it is a single, unique token, renaming it is a safe,
 * literal, whole-word replacement across the site's HTML + JS + config + docs.
 *
 * Three name-derived forms are rewritten together, so nothing is left behind:
 *   1. the name itself           ServiceMomentum      -> NewName
 *   2. the lowercase slug        servicemomentum-site -> newname-site
 *   3. the uppercase wordmark    SERVICEMOMENTUM      -> NEWNAME  (og-image.svg)
 *
 * The brand SYMBOL needs no rewriting at all: assets/mark*.svg is drawn
 * geometry with no letterforms, and the product wordmark beside it is HTML
 * text (.brand-name), never baked into the artwork. That is deliberate — the
 * name is provisional, so nothing name-shaped is allowed into the graphics.
 *
 * Usage:
 *   node scripts/apply-brand.mjs --from "ServiceMomentum" --to "NewName"
 *   node scripts/apply-brand.mjs --to "NewName"     # --from defaults to the
 *                                                     current productName in
 *                                                     brand.config.json
 *   node scripts/apply-brand.mjs --check            # dry run, show counts only
 *
 * It does NOT touch the operational domain, email, or CNAME.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slugFor } from "./brand-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const check = args.includes("--check");

const cfgPath = join(root, "brand.config.json");
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const from = arg("--from") || cfg.productName;
const to = arg("--to");

if (!to && !check) {
  console.error('Missing --to "NewName" (or use --check for a dry run).');
  process.exit(1);
}
if (!from) {
  console.error("Could not determine the current product name (--from).");
  process.exit(1);
}

const slug = slugFor;

// Files that may contain the product name (name, slug, or badge initials).
const files = [
  ...readdirSync(root).filter((f) => f.endsWith(".html")),
  "js/site-config.js",
  "js/intake.js",
  "js/motion.js",
  "styles.css",
  "package.json",
  "README.md",
  "robots.txt",
  ...readdirSync(join(root, "assets")).filter((f) => f.endsWith(".svg")).map((f) => "assets/" + f),
  "favicon.svg",
  "brand.config.json",
  ...readdirSync(join(root, "docs")).filter((f) => f.endsWith(".md")).map((f) => "docs/" + f)
].filter((f) => existsSync(join(root, f)));

let total = 0;
for (const rel of files) {
  const p = join(root, rel);
  let src;
  try {
    src = readFileSync(p, "utf8");
  } catch {
    continue;
  }
  let out = src;
  let count = 0;

  const nameHits = out.split(from).length - 1;
  count += nameHits;
  if (to) out = out.split(from).join(to);

  // Lowercase slug (package name, _source values) and uppercase wordmark
  // (assets/og-image.svg) — same name, different casing.
  for (const variant of [slug, (n) => n.toUpperCase()]) {
    const f2 = variant(from);
    if (f2 === from) continue;
    const hits = out.split(f2).length - 1;
    count += hits;
    if (to) out = out.split(f2).join(variant(to));
  }

  if (!count) continue;
  total += count;
  console.log(`${rel}: ${count} occurrence(s)`);
  if (!check && to && out !== src) writeFileSync(p, out);
}

if (check) {
  console.log(
    `\nDry run: ${total} occurrence(s) of "${from}" / "${slug(from)}" / "${from.toUpperCase()}" across the site.`
  );
} else if (to) {
  // brand.config.json was rewritten as text above; re-read, then set derived fields.
  const next = JSON.parse(readFileSync(cfgPath, "utf8"));
  next.productName = to;
  writeFileSync(cfgPath, JSON.stringify(next, null, 2) + "\n");
  console.log(
    `\nRenamed "${from}" -> "${to}" in ${total} place(s); brand.config.json updated.`
  );
  console.log("The brand symbol is letter-free, so no artwork changed.");
  console.log(
    "Reminder: this is a WORKING name. Run domain + trademark checks before public launch."
  );
}
