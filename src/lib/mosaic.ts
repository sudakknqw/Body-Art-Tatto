// Hand-authored home page mosaics, picked by the number of styles (4–8).
// Desktop: [colStart, colEnd, rowStart, rowEnd] on a 12 × 6 grid.
// Mobile:  [x, y, width, height] in px on a 390px-wide canvas of `height`;
//          rendered as percentages so it scales to any phone width.
// Tile 1 is always the hero.
//
// Every tile is kept close to the shape of the feed cell its cover photo lands
// in (4:5), so tapping a tile reads as the same photo opening up, not a
// different crop: no wide strips. Desktop: the hero fills the full height on the
// left and the others sit in two rows beside it, their seams offset so no four
// tiles meet at a point. Phones are built from a few blocks:
//   block  a 234×390 tile beside two 156×195 tiles (or mirrored)
//   row2   two 195×244 tiles        row3   three 130×163 tiles
//   mixed  234×244 and 156×244      full   one 390×440 tile

import { BP } from './layout';

type Desk = [number, number, number, number];
type Mob = [number, number, number, number];

export interface MosaicLayout {
  desktop: Desk[];
  mobile: { height: number; tiles: Mob[] };
}

export const MOBILE_WIDTH = 390;

/**
 * `sizes` for tile i of a mosaic with `count` tiles. The feed's cover cell
 * uses the same string, so both pick the same file and the photo that
 * morphs between the two pages is already downloaded.
 */
export function tileSizes(i: number, count: number): string {
  const [c1, c2] = layouts[count].desktop[i];
  const w = layouts[count].mobile.tiles[i][2];
  return `(min-width: ${BP.desktop}px) ${Math.round(((c2 - c1) / 12) * 100)}vw, ${Math.round((w / MOBILE_WIDTH) * 100)}vw`;
}

export const layouts: Record<number, MosaicLayout> = {
  4: {
    desktop: [
      [1, 6, 1, 7],
      [6, 10, 1, 7],
      [10, 13, 1, 4],
      [10, 13, 4, 7],
    ],
    // full + row3
    mobile: { height: 603, tiles: [[0, 0, 390, 440], [0, 440, 130, 163], [130, 440, 130, 163], [260, 440, 130, 163]] },
  },
  5: {
    desktop: [
      [1, 6, 1, 7],
      [6, 9, 1, 4],
      [9, 13, 1, 4],
      [6, 10, 4, 7],
      [10, 13, 4, 7],
    ],
    // block + row2
    mobile: { height: 634, tiles: [[0, 0, 234, 390], [234, 0, 156, 195], [234, 195, 156, 195], [0, 390, 195, 244], [195, 390, 195, 244]] },
  },
  6: {
    desktop: [
      [1, 6, 1, 7],
      [6, 9, 1, 4],
      [9, 11, 1, 4],
      [11, 13, 1, 4],
      [6, 10, 4, 7],
      [10, 13, 4, 7],
    ],
    // block + row3
    mobile: { height: 553, tiles: [[0, 0, 234, 390], [234, 0, 156, 195], [234, 195, 156, 195], [0, 390, 130, 163], [130, 390, 130, 163], [260, 390, 130, 163]] },
  },
  7: {
    desktop: [
      [1, 6, 1, 7],
      [6, 9, 1, 4],
      [9, 11, 1, 4],
      [11, 13, 1, 4],
      [6, 8, 4, 7],
      [8, 10, 4, 7],
      [10, 13, 4, 7],
    ],
    // block + row2 + mixed (mirrored)
    mobile: { height: 878, tiles: [[0, 0, 234, 390], [234, 0, 156, 195], [234, 195, 156, 195], [0, 390, 195, 244], [195, 390, 195, 244], [0, 634, 156, 244], [156, 634, 234, 244]] },
  },
  8: {
    desktop: [
      [1, 5, 1, 7],
      [5, 7, 1, 4],
      [7, 9, 1, 4],
      [9, 11, 1, 4],
      [11, 13, 1, 4],
      [5, 8, 4, 7],
      [8, 10, 4, 7],
      [10, 13, 4, 7],
    ],
    // block + row2 + block (mirrored)
    mobile: { height: 1024, tiles: [[0, 0, 234, 390], [234, 0, 156, 195], [234, 195, 156, 195], [0, 390, 195, 244], [195, 390, 195, 244], [156, 634, 234, 390], [0, 634, 156, 195], [0, 829, 156, 195]] },
  },
};
