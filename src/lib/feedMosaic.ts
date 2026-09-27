// Hand-authored mosaics for a style's feed. Pieces are revealed 12 at a time;
// batch 1 uses pattern A, batch 2 B, batch 3 C, batch 4 A again, and so on.
//
// Units: desktop has 12 columns, mobile 6 (65px each on the 390px canvas).
// Rows are a quarter of a column on both, so a cell [x, y, w, h] is w columns
// wide and h/4 columns tall: its shape is 4w/h, and h = 5w is exactly 4:5.
// Every photo fills its cell (object-fit: cover), so every cell is kept close
// to 4:5, the shape of most tattoo photos: between 0.73 and 0.89.
//
// The desktop patterns were found by an exhaustive search over those shapes,
// then picked by the rules below; with cells this close to 4:5 there is no
// 12-cell pattern that also avoids every long seam, so the rules are:
// flush cells, one dominant cell, no seam running the full width or height,
// no four cells meeting at a point, no two seams one row apart, and no cell
// under 44px at 360px (mobile) or 1024px (desktop) wide.
// Phones are built from sections: two columns of staggered "bricks", one
// full-width 4:5 cell, and a row of three small cells; sections only meet at
// the full-width cell, so no seam crosses the screen in the middle of a section.

export type Cell = [x: number, y: number, w: number, h: number];
interface Pattern {
  h: number; // height in rows
  cells: Cell[]; // cells[0] is the cover slot in pattern A
}

const mirror = (p: Pattern): Pattern => ({ h: p.h, cells: p.cells.map(([x, y, w, h]) => [12 - x - w, y, w, h] as Cell) });
const flip = (p: Pattern): Pattern => ({ h: p.h, cells: p.cells.map(([x, y, w, h]) => [x, p.h - y - h, w, h] as Cell) });
const mirrorMobile = (p: Pattern): Pattern => ({ h: p.h, cells: p.cells.map(([x, y, w, h]) => [6 - x - w, y, w, h] as Cell) });
/** Height of the cover cell (4 columns tall at most, so it fits on the first screen: fold.ts). */
export const COVER_ROWS = 16;

// Desktop A exists with the cover slot under each quarter of the page, so the
// home tile's photo drops into a cell under the columns it came from.
// Cover and its neighbour, the dominant cell top right, small cells stepping
// down on the left, two medium cells bottom right.
const A0: Pattern = {
  h: 46,
  cells: [[0, 0, 3, 16], [3, 0, 3, 16], [6, 0, 6, 27], [0, 16, 2, 11], [2, 16, 2, 9], [4, 16, 2, 11], [2, 25, 2, 10], [0, 27, 2, 10], [4, 27, 4, 19], [8, 27, 4, 19], [2, 35, 2, 11], [0, 37, 2, 9]],
};
const A3: Pattern = { h: 46, cells: [[3, 0, 3, 16], [0, 0, 3, 16], ...A0.cells.slice(2)] };
const desktopA: Record<number, Pattern> = { 0: A0, 3: A3, 6: mirror(A3), 9: mirror(A0) };
// B and C are other patterns from the same search, turned over so the big
// cells sit lower down.
const desktopB: Pattern = flip({
  h: 46,
  cells: [[0, 0, 3, 16], [3, 0, 3, 16], [6, 0, 6, 27], [0, 16, 4, 20], [4, 16, 2, 11], [4, 27, 4, 19], [8, 27, 2, 9], [10, 27, 2, 9], [0, 36, 2, 10], [2, 36, 2, 10], [8, 36, 2, 10], [10, 36, 2, 10]],
});
const desktopC: Pattern = mirror(flip({
  h: 48,
  cells: [[0, 0, 3, 16], [3, 0, 3, 16], [6, 0, 6, 27], [0, 16, 4, 22], [4, 16, 2, 11], [4, 27, 4, 21], [8, 27, 2, 10], [10, 27, 2, 10], [8, 37, 2, 11], [10, 37, 2, 11], [0, 38, 2, 10], [2, 38, 2, 10]],
}));

// Phones. A: cover top left in two columns of bricks whose seams never line up,
// then the full-width dominant cell (390×487 at 390px), then three small cells.
const mobileA: Pattern = {
  h: 100,
  cells: [[0, 0, 3, 16], [3, 0, 3, 14], [3, 14, 3, 15], [0, 16, 3, 16], [3, 29, 3, 15], [0, 32, 3, 14], [3, 44, 3, 16], [0, 46, 3, 14], [0, 60, 6, 30], [0, 90, 2, 10], [2, 90, 2, 10], [4, 90, 2, 10]],
};
const mobile: Pattern[] = [mobileA, flip(mobileA), mirrorMobile(mobileA)];

// Short batches: a style with 1–5 pieces (or the last batch of a long feed)
// gets one of these instead of the first cells of a 12-cell pattern, which
// would leave holes. Same rules as the patterns, plus a flat bottom edge.
// Cover cells stay 16 rows tall like pattern A's, so the cover still fits on
// the first screen (fold.ts); that is also why 1–3 pieces on desktop are
// squares (4 columns × 16 rows), and why 1–2 can't span the full width: a
// wider cell would have to be taller or landscape.
const shortDesktop: Cell[][] = [
  [],
  [[4, 0, 4, 16]],
  [[2, 0, 4, 16], [6, 0, 4, 16]],
  [[0, 0, 4, 16], [4, 0, 4, 16], [8, 0, 4, 16]],
  [[0, 0, 3, 16], [3, 0, 3, 16], [6, 0, 3, 16], [9, 0, 3, 16]],
  [[0, 0, 3, 16], [3, 0, 6, 30], [9, 0, 3, 14], [0, 16, 3, 14], [9, 14, 3, 16]],
];
const shortMobile: Cell[][] = [
  [],
  [[1, 0, 4, 16]],
  [[0, 0, 3, 16], [3, 0, 3, 16]],
  [[0, 0, 3, 16], [3, 0, 3, 16], [0, 16, 6, 28]],
  [[0, 0, 3, 16], [3, 0, 3, 14], [3, 14, 3, 16], [0, 16, 3, 14]],
  [[0, 0, 3, 16], [3, 0, 3, 14], [3, 14, 3, 16], [0, 16, 3, 14], [0, 30, 6, 28]],
];
export const SHORT_MAX = shortDesktop.length - 1;

const pattern = (cells: Cell[]): Pattern => ({ h: Math.max(...cells.map(([, y, , h]) => y + h)), cells });
/**
 * Desktop short pattern for `n` pieces. With a cover, the cover cell (the
 * cover-height cell in the first row nearest the home tile's slot, mirrored if
 * that is closer) goes first, as pattern A's does.
 */
function shortPattern(n: number, slot: number | null): Pattern {
  const cells = shortDesktop[n];
  if (slot === null) return pattern(cells);
  const centre = slot + 1.5;
  const options = [cells, mirror(pattern(cells)).cells].flatMap((set) =>
    set.map((c, i) => ({ set, i, d: Math.abs(c[0] + c[2] / 2 - centre) })).filter(({ set, i }) => set[i][1] === 0 && set[i][3] === COVER_ROWS),
  );
  const best = options.reduce((a, o) => (o.d < a.d ? o : a));
  return pattern([best.set[best.i], ...best.set.filter((_, i) => i !== best.i)]);
}

/** Desktop cover slot (0, 3, 6 or 9) nearest the centre of the home tile [c1, c2) (1-based grid lines). */
export function coverSlot(c1: number, c2: number): number {
  const centre = (c1 + c2) / 2 - 1;
  return [0, 3, 6, 9].reduce((best, x) => (Math.abs(x + 1.5 - centre) < Math.abs(best + 1.5 - centre) ? x : best));
}

export interface Placement {
  c: number; // grid column line (1-based)
  w: number;
  r: number; // grid row line (1-based), batches stacked
  h: number;
}
export interface FeedCell<T> {
  item: T;
  desktop: Placement;
  mobile: Placement;
}

const area = ([, , w, h]: Cell) => w * h;
const clampWeight = (w: number) => (w >= 3 ? 3 : w <= 1 ? 1 : 2) as 1 | 2 | 3;
/** Reading order (top to bottom, then left to right), with the cover slot first in pattern A's first batch. */
const readingOrder = (cells: Cell[], coverFirst: boolean) =>
  cells.map((_, i) => i).sort((a, b) => (coverFirst ? Number(b === 0) - Number(a === 0) : 0) || cells[a][1] - cells[b][1] || cells[a][0] - cells[b][0]);

/**
 * Lays out `items` (feed order, cover first) batch by batch.
 * Within a batch the cover takes the cover slot; weight-3 pieces take the
 * largest remaining cells, weight-1 the smallest, weight-2 those in between,
 * on desktop and on mobile alike. A batch of 1–5 pieces uses a short pattern;
 * one of 6–11 uses the first cells of its pattern and ends ragged.
 * Returned in mobile reading order, which is also the prev/next order.
 */
export function layoutFeed<T>(items: T[], weightOf: (t: T) => number, slot: number, hasCover: boolean): FeedCell<T>[] {
  const out: FeedCell<T>[] = [];
  let dRow = 0;
  let mRow = 0;
  for (let b = 0; b * 12 < items.length; b++) {
    const batch = items.slice(b * 12, b * 12 + 12);
    const cover = hasCover && b === 0;
    const short = batch.length <= SHORT_MAX;
    const d = short ? shortPattern(batch.length, cover ? slot : null) : [desktopA[slot], desktopB, desktopC][b % 3];
    const m = short ? pattern(shortMobile[batch.length]) : mobile[b % 3];
    const dSel = readingOrder(d.cells, cover).slice(0, batch.length);
    const mSel = readingOrder(m.cells, cover).slice(0, batch.length);
    // Weight 3 pieces get the largest cells, weight 1 the smallest, weight 2
    // the ones in between; inside each weight the pieces fill their cells in
    // reading order, so on both layouts they read in the same order.
    const rest = batch.slice(cover ? 1 : 0);
    const counts = [3, 2, 1].map((w) => rest.filter((it) => clampWeight(weightOf(it)) === w).length);
    const groups = (p: Pattern, sel: number[]) => {
      const cells = sel.filter((i) => !(cover && i === 0));
      const bySize = [...cells].sort((a, z) => area(p.cells[z]) - area(p.cells[a]) || sel.indexOf(a) - sel.indexOf(z));
      const inReadingOrder = (ids: number[]) => ids.sort((a, z) => sel.indexOf(a) - sel.indexOf(z));
      return {
        3: inReadingOrder(bySize.slice(0, counts[0])),
        2: inReadingOrder(bySize.slice(counts[0], counts[0] + counts[1])),
        1: inReadingOrder(bySize.slice(counts[0] + counts[1])),
      } as Record<1 | 2 | 3, number[]>;
    };
    const dG = groups(d, dSel);
    const mG = groups(m, mSel);
    const placed: { item: T; di: number; mi: number }[] = cover ? [{ item: batch[0], di: 0, mi: 0 }] : [];
    for (const item of rest) {
      const w = clampWeight(weightOf(item));
      placed.push({ item, di: dG[w].shift()!, mi: mG[w].shift()! });
    }
    const toPlacement = ([x, y, w, h]: Cell, row: number): Placement => ({ c: x + 1, w, r: row + y + 1, h });
    placed
      .sort((a, z) => mSel.indexOf(a.mi) - mSel.indexOf(z.mi))
      .forEach(({ item, di, mi }) => out.push({ item, desktop: toPlacement(d.cells[di], dRow), mobile: toPlacement(m.cells[mi], mRow) }));
    dRow += d.h;
    mRow += m.h;
  }
  return out;
}
