// Generates solid-colour stand-in photos (colours = dark --tile-* tokens)
// for every image referenced in pieces.json that doesn't exist yet.
// Real photos dropped into src/images/pieces/ are never overwritten.
import fs from 'node:fs';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const tiles = ['#1e1d1a', '#2b2926', '#151412', '#232120', '#171614', '#262421'];
const ratios = [[3, 4], [4, 5], [2, 3]];
const dir = new URL('../src/images/pieces/', import.meta.url);
const pieces = JSON.parse(fs.readFileSync(new URL('../src/content/pieces.json', import.meta.url)));

let made = 0;
pieces.forEach((p, i) => {
  [p.image, p.imageDetail, p.imageHealed].filter(Boolean).forEach((file, j) => {
    const out = new URL(file, dir);
    if (fs.existsSync(out)) return;
    const [w, h] = ratios[(i + j) % ratios.length];
    sharp({ create: { width: 1600, height: Math.round((1600 * h) / w), channels: 3, background: tiles[(i + j) % tiles.length] } })
      .jpeg({ quality: 90 })
      .toFile(fileURLToPath(out));
    made++;
  });
});
console.log(`Created ${made} placeholder image(s).`);
