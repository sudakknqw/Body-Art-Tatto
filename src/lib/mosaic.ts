// Hand-authored home page mosaics, picked by the number of styles (4–8).
// Desktop: [colStart, colEnd, rowStart, rowEnd] on a 12 × 6 grid.
// Mobile:  [x, y, width, height] in px on a 390px-wide canvas of `height`;
//          rendered as percentages so it scales to any phone width.
// Tile 1 is always the hero.

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
      [6, 10, 1, 4],
      [10, 13, 1, 7],
      [6, 10, 4, 7],
    ],
    mobile: {
      height: 560,
      tiles: [
        [0, 0, 240, 300],
        [240, 0, 150, 180],
        [240, 180, 150, 380],
        [0, 300, 240, 260],
      ],
    },
  },
  5: {
    desktop: [
      [1, 6, 1, 7],
      [6, 10, 1, 4],
      [10, 13, 1, 5],
      [6, 10, 4, 7],
      [10, 13, 5, 7],
    ],
    mobile: {
      height: 600,
      tiles: [
        [0, 0, 240, 250],
        [240, 0, 150, 150],
        [240, 150, 150, 300],
        [0, 250, 240, 350],
        [240, 450, 150, 150],
      ],
    },
  },
  6: {
    desktop: [
      [1, 6, 1, 5],
      [6, 10, 1, 3],
      [10, 13, 1, 4],
      [6, 10, 3, 7],
      [10, 13, 4, 7],
      [1, 6, 5, 7],
    ],
    mobile: {
      height: 630,
      tiles: [
        [0, 0, 240, 230],
        [240, 0, 150, 150],
        [240, 150, 150, 210],
        [0, 230, 240, 130],
        [0, 360, 160, 270],
        [160, 360, 230, 270],
      ],
    },
  },
  7: {
    desktop: [
      [1, 6, 1, 5],
      [6, 10, 1, 3],
      [10, 13, 1, 4],
      [6, 10, 3, 5],
      [10, 13, 4, 7],
      [1, 4, 5, 7],
      [4, 10, 5, 7],
    ],
    mobile: {
      height: 700,
      tiles: [
        [0, 0, 240, 230],
        [240, 0, 150, 150],
        [240, 150, 150, 210],
        [0, 230, 240, 130],
        [0, 360, 160, 340],
        [160, 360, 230, 180],
        [160, 540, 230, 160],
      ],
    },
  },
  8: {
    desktop: [
      [1, 6, 1, 5],
      [6, 9, 1, 3],
      [9, 13, 1, 3],
      [6, 10, 3, 5],
      [10, 13, 3, 7],
      [1, 4, 5, 7],
      [4, 7, 5, 7],
      [7, 10, 5, 7],
    ],
    mobile: {
      height: 800,
      tiles: [
        [0, 0, 240, 230],
        [240, 0, 150, 150],
        [240, 150, 150, 210],
        [0, 230, 240, 130],
        [0, 360, 160, 240],
        [160, 360, 230, 180],
        [160, 540, 230, 260],
        [0, 600, 160, 200],
      ],
    },
  },
};
