// Hand-authored mosaics for a style's feed. Pieces are revealed 12 at a time;
// batch 1 uses pattern A, batch 2 B, batch 3 C, batch 4 A again, and so on.
//
// Units: desktop has 12 columns, mobile 6 (65px each on the 390px canvas).
// Rows are half a column tall on both, so a cell [x, y, w, h] is
// w columns wide and h/2 columns tall: h = 2w is square, h = 3w is 2:3.
// Every cell is portrait or square (mobile A's full-width cell is a square).
//
// Rules the patterns were checked against (see README → "Feed mosaic"):
// flush cells, one dominant cell (never top-left, where the home hero is),
// no seam that runs on across several cells on both sides, and no cell under
// 44px at 360px (mobile) or 1024px (desktop) wide.

export type Cell = [x: number, y: number, w: number, h: number];
interface Pattern {
  h: number; // height in rows
  cells: Cell[]; // cells[0] is the cover slot in pattern A
}

const mirror = (p: Pattern): Pattern => ({ h: p.h, cells: p.cells.map(([x, y, w, h]) => [12 - x - w, y, w, h] as Cell) });

// Desktop A exists with the cover slot under each third-ish of the page, so the
// home tile's photo drops into a cell under the columns it came from.
const A0: Pattern = {
  h: 21,
  cells: [[0, 0, 3, 8], [3, 0, 3, 9], [6, 0, 2, 5], [8, 0, 2, 6], [10, 0, 2, 5], [6, 5, 2, 4], [10, 5, 2, 6], [8, 6, 2, 5], [0, 8, 3, 7], [3, 9, 5, 12], [8, 11, 4, 10], [0, 15, 3, 6]],
};
const A3: Pattern = {
  h: 22,
  cells: [[3, 0, 3, 8], [0, 0, 3, 9], [6, 0, 2, 4], [8, 0, 2, 6], [10, 0, 2, 5], [6, 4, 2, 4], [10, 5, 2, 6], [8, 6, 2, 5], [3, 8, 5, 14], [0, 9, 3, 6], [8, 11, 4, 11], [0, 15, 3, 7]],
};
const desktopA: Record<number, Pattern> = { 0: A0, 3: A3, 6: mirror(A3), 9: mirror(A0) };
const desktopB: Pattern = {
  h: 21,
  cells: [[0, 0, 3, 9], [3, 0, 2, 4], [5, 0, 3, 7], [8, 0, 4, 11], [3, 4, 2, 5], [5, 7, 3, 6], [0, 9, 5, 12], [8, 11, 2, 5], [10, 11, 2, 6], [5, 13, 3, 8], [8, 16, 2, 5], [10, 17, 2, 4]],
};
const desktopC: Pattern = {
  h: 22,
  cells: [[0, 0, 3, 6], [3, 0, 2, 5], [5, 0, 2, 6], [7, 0, 5, 13], [3, 5, 2, 5], [0, 6, 3, 7], [5, 6, 2, 4], [3, 10, 4, 12], [0, 13, 3, 9], [7, 13, 2, 4], [9, 13, 3, 9], [7, 17, 2, 5]],
};

const mobile: Pattern[] = [
  // A: cover top-left, bricks beside it, a full-width square, three narrow columns
  { h: 38, cells: [[0, 0, 3, 8], [3, 0, 3, 6], [3, 6, 3, 8], [0, 8, 3, 6], [0, 14, 6, 12], [0, 26, 2, 6], [2, 26, 2, 4], [4, 26, 2, 6], [2, 30, 2, 4], [0, 32, 2, 6], [4, 32, 2, 6], [2, 34, 2, 4]] },
  // B: tall cell top-right, dominant lower-left
  { h: 29, cells: [[0, 0, 2, 4], [2, 0, 4, 10], [0, 4, 2, 5], [0, 9, 2, 4], [2, 10, 2, 4], [4, 10, 2, 5], [0, 13, 2, 5], [2, 14, 2, 4], [4, 15, 2, 5], [0, 18, 4, 11], [4, 20, 2, 4], [4, 24, 2, 5]] },
  // C: big cells zig-zag left, right, right
  { h: 30, cells: [[0, 0, 4, 8], [4, 0, 2, 5], [4, 5, 2, 4], [0, 8, 2, 4], [2, 8, 2, 5], [4, 9, 2, 4], [0, 12, 2, 5], [2, 13, 4, 9], [0, 17, 2, 4], [0, 21, 2, 5], [2, 22, 4, 8], [0, 26, 2, 4]] },
];

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
 * on desktop and on mobile alike. A short batch uses the first cells of its
 * pattern and ends ragged.
 * Returned in mobile reading order, which is also the prev/next order.
 */
export function layoutFeed<T>(items: T[], weightOf: (t: T) => number, slot: number, hasCover: boolean): FeedCell<T>[] {
  const out: FeedCell<T>[] = [];
  let dRow = 0;
  let mRow = 0;
  for (let b = 0; b * 12 < items.length; b++) {
    const batch = items.slice(b * 12, b * 12 + 12);
    const d = [desktopA[slot], desktopB, desktopC][b % 3];
    const m = mobile[b % 3];
    const cover = hasCover && b === 0;
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
