// Build-time check that a style's cover piece — the first cell of its feed —
// is fully visible without scrolling when the feed page opens, so the
// home tile → feed transition always lands on screen. A miss prints a warning
// (src/lib/content.ts); the page itself still works.
//
// There is no browser at build time, so this is a model of the feed page
// header, using the same numbers as the CSS in StyleFeed.astro and global.css.
// It was calibrated against Chrome and matches it to the pixel; text width is
// estimated slightly generously so the check errs on the safe side.
// If you change those styles, update the numbers here.

import { BP } from './layout';

/** Viewports the cover cell must fit in without scrolling. */
export const MOBILE = [360, 390, 430].map((w) => ({ w, h: 844 }));
export const DESKTOP = [1024, 1280, 1440, 1680, 1920].map((w) => ({ w, h: 900 }));
/** Feed rows are a quarter of a column tall; on desktop they stop growing at this height (StyleFeed.astro). */
export const DESKTOP_ROW_MAX = 36;

const HEADER = 56;
const BAR = 80; // mobile booking bar covers the bottom of the screen
const CHAR = 0.52; // average glyph width in em (measured 0.47–0.48 for Space Grotesk)
const CH = 0.641; // width of "0" in em, for the 62ch description limit

const lines = (text: string, px: number, width: number) =>
  Math.max(1, Math.ceil((text.length * CHAR * px) / (width * 0.92)));

export interface Head {
  title: string;
  description: string;
  figures: string[][]; // [label, value] × 3
}

/** Height from the top of the page to the top of the feed. */
function feedTop(w: number, head: Head): number {
  const desktop = w >= BP.desktop;
  const pad = w >= BP.tablet ? 40 : 16;
  const h1px = w >= BP.tablet ? 42 : 34;
  const inner = w - pad * 2;
  const descMax = 62 * CH * 16;
  let col = inner;
  let figures = 0;
  if (desktop) {
    // Figures sit to the right of the title and description.
    const figW = head.figures.reduce((s, [dt, dd]) => s + Math.max(dt.length * CHAR * 13, dd.length * CHAR * 22), 0) + 60;
    col = inner - 56 - figW;
  } else {
    // Figures sit under the description and may wrap inside their third of the width.
    const each = (inner - 60) / 3;
    figures = 22 + Math.max(...head.figures.map(([dt, dd]) => lines(dt, 13, each) * 19.5 + lines(dd, 22, each) * 33));
  }
  const h1 = lines(head.title, h1px, col) * h1px * 1.15;
  const desc = lines(head.description, 16, Math.min(col, descMax)) * 24;
  return HEADER + 18 + 44 + 8 + h1 + 12 + desc + figures + 22;
}

/**
 * Whether a feed cell whose top is on row `r` (1-based) shows on the first
 * screen of every checked phone and desktop. Those photos load with the page;
 * the others wait, and the browser script loads the ones that are on the first
 * screen of the device at hand right away (StyleFeed.astro, Photo.astro).
 */
export function onFirstScreen(head: Head, r: { mobile: number; desktop: number }): boolean {
  return (
    MOBILE.every(({ w, h }) => feedTop(w, head) + (r.mobile - 1) * (w / 24) < h - BAR) &&
    DESKTOP.every(({ w, h }) => feedTop(w, head) + (r.desktop - 1) * Math.min(w / 48, DESKTOP_ROW_MAX) < h)
  );
}

export interface FoldResult {
  ok: boolean;
  where: string;
  bottom: number;
  fold: number;
}

/**
 * Bottom edge of the cover cell at every checked viewport. `rows` is the
 * cover's height in quarter-column rows on each layout (feedMosaic.ts).
 */
export function checkFold(head: Head, rows: { mobile: number; desktop: number }): FoldResult[] {
  const mobile = MOBILE.map(({ w, h }) => {
    const bottom = feedTop(w, head) + rows.mobile * (w / 24);
    return { ok: bottom <= h - BAR, where: `${w}×${h}`, bottom, fold: h - BAR };
  });
  const desktop = DESKTOP.map(({ w, h }) => {
    const bottom = feedTop(w, head) + rows.desktop * Math.min(w / 48, DESKTOP_ROW_MAX);
    return { ok: bottom <= h, where: `${w}×${h}`, bottom, fold: h };
  });
  return [...mobile, ...desktop];
}
