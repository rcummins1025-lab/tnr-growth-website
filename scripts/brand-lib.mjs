/**
 * brand-lib.mjs — shared, side-effect-free helpers for the working brand.
 * Used by apply-brand.mjs (to rewrite) and validate.mjs (to verify).
 */

/** Lowercase, punctuation-free slug of a product name (e.g. "acmeworks"). */
export const slugFor = (name) => name.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

/**
 * The brand symbol's approved palette. The mark is drawn geometry in exactly
 * these colours — a Forge Black pathway, one Burnt Orange endpoint, and white
 * for the reversed variant. `currentColor` is how the one-colour variant
 * inherits. Anything else in a mark asset is drift, and validate.mjs fails.
 */
export const MARK_COLORS = {
  forgeBlack: "#171A1F",
  burntOrange: "#D9653B",
  reversedNeutral: "#FFFFFF"
};

/**
 * The full approved Forge palette. Every colour that ships must be one of
 * these, a documented derivation of one, or a functional status colour.
 */
export const FORGE_PALETTE = {
  forgeBlack: "#171A1F",
  warmCanvas: "#F4F0E6",
  burntOrange: "#D9653B",
  steelBlueGray: "#5E7184",
  concrete: "#D8D6CF",
  white: "#FFFFFF"
};

/**
 * Retired navy/gold values. These must never reappear in a shipped file —
 * that is how a palette silently rots back to the old identity.
 */
export const RETIRED_COLORS = [
  "#0d1f3c", "#0f2440", "#102a43", "#12294c", "#13294d", "#0e2140",
  "#d4a537", "#e0a526", "#8a6a1a", "#c6971f", "#f7edd3", "#ecd9a6",
  "#f5f8fc", "#e4e9f1", "#d3dbe8", "#5a6a82", "#33465f", "#2f6fd0",
  "#0b1c35", "#16325c", "#17315a", "#16305a", "#1d3f70", "#e9eff9",
  "#9fb2d0", "#3a2c07"
];
export const APPROVED_MARK_PAINTS = new Set(
  [...Object.values(MARK_COLORS).map((c) => c.toLowerCase()), "currentcolor", "none"]
);

/** Every file that draws the symbol. All must be clean, drawn SVG. */
export const MARK_ASSETS = [
  "assets/mark.svg",
  "assets/mark-mono.svg",
  "assets/mark-reversed.svg",
  "favicon.svg"
];

/** Markup patterns that would reintroduce letter-based initials in the lockup. */
export const INITIALS_BADGE_RE = /<span[^>]*class="brand-badge"|data-brand="initials"/g;
