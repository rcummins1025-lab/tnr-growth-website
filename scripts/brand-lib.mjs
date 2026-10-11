/**
 * brand-lib.mjs — shared, side-effect-free helpers for the Service Momentum brand.
 * Used by apply-brand.mjs (to rewrite) and validate.mjs (to verify).
 */

/** Lowercase, punctuation-free slug of a product name (e.g. "servicemomentum"). */
export const slugFor = (name) => name.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

/**
 * The SM logo's two colours, sampled from Service-Momentum-sm-mark.png:
 * the S in deep blue, the M in bright SM blue. White is the tile behind it.
 */
export const LOGO_COLORS = {
  s: "#2C5A9F",
  m: "#3285FC",
  tile: "#FFFFFF"
};

/**
 * The site palette, taken from the Service Momentum video ads (Remotion theme):
 * deep navy grounds, one bright blue accent, white type. styles.css must
 * declare each of these as a --sm-* token.
 */
export const SM_PALETTE = {
  navyDeep: "#050B1D",
  navy: "#0A1430",
  navyLift: "#13224A",
  blue: "#3B8CFF",
  white: "#FFFFFF",
  paper: "#F6F8FC",
  ink: "#0E1A36"
};

/**
 * Retired identities. None of these may reappear in a shipped file:
 * the first navy/gold palette, then the Forge charcoal/orange palette that
 * the ads-based palette replaced on 2026-10-11.
 */
export const RETIRED_COLORS = [
  // navy/gold (first identity)
  "#0d1f3c", "#0f2440", "#102a43", "#12294c", "#13294d", "#0e2140",
  "#d4a537", "#e0a526", "#8a6a1a", "#c6971f", "#f7edd3", "#ecd9a6",
  "#f5f8fc", "#e4e9f1", "#d3dbe8", "#5a6a82", "#33465f", "#2f6fd0",
  "#0b1c35", "#16325c", "#17315a", "#16305a", "#1d3f70", "#e9eff9",
  "#9fb2d0", "#3a2c07",
  // Forge (second identity)
  "#171a1f", "#d9653b", "#f4f0e6", "#5e7184", "#d8d6cf", "#a94a21", "#f7e4da"
];

/** Every file that draws the SM logo. All must be clean vector geometry. */
export const LOGO_ASSETS = ["assets/sm-logo.svg", "favicon.svg"];
