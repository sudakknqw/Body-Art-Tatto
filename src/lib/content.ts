// Loads the JSON content, validates it, and joins pieces to their photos.
// A problem that would break the site throws, which stops `npm run build`
// with the message below; one that only looks worse prints a warning.
import type { ImageMetadata } from 'astro';
import studioEn from '../content/studio.json';
import stylesEn from '../content/styles.json';
import piecesEn from '../content/pieces.json';
import copyEn from '../content/copy.json';
import { checkFold } from './fold';
import { layouts } from './mosaic';
import { coverSlot, layoutFeed, type FeedCell } from './feedMosaic';
import { PREFIX } from './layout';

export type Lang = 'en' | 'th';
export type Copy = typeof copyEn;

export interface Style {
  slug: string;
  name: string;
  description: string;
  priceFrom: string;
  typicalHours: string;
  coverPiece: string;
}

export interface Piece {
  slug: string;
  name: string;
  style: string;
  image: string;
  imageDetail: string;
  imageHealed: string;
  alt: string;
  note: string;
  placement: string;
  sizeCm: string;
  sessions: string;
  hours: string;
  price: string;
  weight: 1 | 2 | 3;
  photo: ImageMetadata;
  photoDetail?: ImageMetadata;
  photoHealed?: ImageMetadata;
}

export type Studio = typeof studioEn;

export interface Site {
  lang: Lang;
  prefix: string; // PREFIX in layout.ts
  studio: Studio;
  styles: Style[];
  pieces: Piece[];
  copy: Copy;
}

class ContentError extends Error {
  constructor(file: string, message: string) {
    super(`\n\n  ✖ Content problem in src/content/${file}\n    ${message}\n`);
    this.name = 'ContentError';
  }
}
const contentWarning = (file: string, message: string) =>
  console.warn(`\n  ⚠ Content warning in src/content/${file}\n    ${message}\n`);

// Photos live in one folder per style, e.g. src/images/pieces/1 Blackwork/Blackwork1.jpg;
// pieces.json names them by that path ("1 Blackwork/Blackwork1.jpg").
const photos = import.meta.glob<ImageMetadata>('../images/pieces/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG}', {
  eager: true,
  import: 'default',
});
const photoByPath = new Map(Object.entries(photos).map(([path, img]) => [path.slice('../images/pieces/'.length), img]));

function findPhoto(file: string, where: string): ImageMetadata {
  const img = photoByPath.get(file);
  if (!img) {
    throw new ContentError('pieces.json', `${where} points to "${file}", but there is no such file in src/images/pieces/ (the path includes the style folder).`);
  }
  return img;
}

const isFilled = (v: unknown) => typeof v === 'string' && v.trim() !== '';

// ---------- English (the source of truth) ----------

if (!isFilled(studioEn.whatsapp)) {
  throw new ContentError('studio.json', '"whatsapp" is empty. Every booking button opens WhatsApp — use digits only, e.g. 66812345678.');
}
if (!isFilled(studioEn.addressShort)) {
  throw new ContentError('studio.json', '"addressShort" is empty. It goes into the page titles, e.g. "Ari, Bangkok".');
}

const styles: Style[] = stylesEn.map((s, i) => {
  if (!isFilled(s.slug)) throw new ContentError('styles.json', `Style #${i + 1} has no "slug".`);
  if (!isFilled(s.name)) throw new ContentError('styles.json', `Style "${s.slug}" has no "name".`);
  return { ...s };
});
if (styles.length < 4 || styles.length > 8) {
  throw new ContentError('styles.json', `There are ${styles.length} styles. The home page mosaic is designed for 4 to 8.`);
}
const styleSlugs = new Set(styles.map((s) => s.slug));
if (styleSlugs.size !== styles.length) throw new ContentError('styles.json', 'Two styles have the same "slug".');

const seen = new Set<string>();
const pieces: Piece[] = piecesEn.map((p, i) => {
  const where = `Piece "${p.slug || `#${i + 1}`}"`;
  if (!isFilled(p.slug)) throw new ContentError('pieces.json', `Piece #${i + 1} has no "slug".`);
  if (seen.has(p.slug)) throw new ContentError('pieces.json', `Two pieces have the slug "${p.slug}".`);
  seen.add(p.slug);
  if (!styleSlugs.has(p.style)) {
    throw new ContentError(
      'pieces.json',
      `${where} has style "${p.style}", which is not a slug in styles.json. Use one of: ${[...styleSlugs].join(', ')}.`,
    );
  }
  if (!isFilled(p.alt)) {
    throw new ContentError('pieces.json', `${where} has no "alt" text. Describe what the tattoo shows and where it is placed.`);
  }
  if (!isFilled(p.image)) throw new ContentError('pieces.json', `${where} has no "image".`);
  const weight = [1, 2, 3].includes(Number(p.weight)) ? (Number(p.weight) as 1 | 2 | 3) : 1;
  return {
    ...p,
    imageDetail: p.imageDetail ?? '',
    imageHealed: p.imageHealed ?? '',
    price: p.price ?? '',
    weight,
    photo: findPhoto(p.image, `${where} "image"`),
    photoDetail: isFilled(p.imageDetail) ? findPhoto(p.imageDetail, `${where} "imageDetail"`) : undefined,
    photoHealed: isFilled(p.imageHealed) ? findPhoto(p.imageHealed, `${where} "imageHealed"`) : undefined,
  };
});

for (const s of styles) {
  if (!isFilled(s.coverPiece)) continue;
  const cover = pieces.find((p) => p.slug === s.coverPiece);
  if (!cover) throw new ContentError('styles.json', `Style "${s.slug}" has coverPiece "${s.coverPiece}", but no piece has that slug.`);
}

const en: Site = { lang: 'en', prefix: PREFIX.en, studio: studioEn, styles, pieces, copy: copyEn };

// ---------- Thai (optional; only built when every Thai file exists) ----------

const thFiles = import.meta.glob<unknown>('../content/*.th.json', { eager: true, import: 'default' });
const thFile = (name: string) => thFiles[`../content/${name}.th.json`] as any;
const thNeeded = ['studio', 'styles', 'pieces', 'copy'];
const thMissing = thNeeded.filter((n) => !thFile(n));

/** Keys in `en` that `th` lacks, as paths like "nav.work" or "steps[2].title". */
function missingKeys(en: unknown, th: unknown, path = ''): string[] {
  if (Array.isArray(en)) {
    if (!Array.isArray(th)) return [path];
    return th.flatMap((t, i) => missingKeys(en[Math.min(i, en.length - 1)], t, `${path}[${i}]`));
  }
  if (!en || typeof en !== 'object') return [];
  if (!th || typeof th !== 'object') return [path];
  return Object.entries(en).flatMap(([k, v]) => {
    const at = path ? `${path}.${k}` : k;
    return k in th ? missingKeys(v, (th as Record<string, unknown>)[k], at) : [at];
  });
}

function buildThai(): Site | null {
  if (thMissing.length) {
    if (thMissing.length < thNeeded.length) {
      console.warn(`[content] Thai pages skipped — missing: ${thMissing.map((n) => `${n}.th.json`).join(', ')}`);
    }
    return null;
  }
  const studioTh = { ...studioEn, ...thFile('studio') } as Studio;
  const stylesTh = thFile('styles') as Partial<Style>[];
  const piecesTh = thFile('pieces') as Partial<Piece>[];
  const copyTh = thFile('copy') as Copy;
  // Every interface text is used on every page, so copy.th.json must have all of them.
  const noText = missingKeys(copyEn, copyTh);
  if (noText.length) {
    throw new ContentError(
      'copy.th.json',
      `${noText.length} text(s) that copy.json has are missing: ${noText.slice(0, 8).join(', ')}${noText.length > 8 ? ', …' : ''}. ` +
        'Copy them over from copy.json and translate them.',
    );
  }

  // A style or piece appears in Thai only once it has been translated.
  const thStyles: Style[] = [];
  for (const s of styles) {
    const t = stylesTh.find((x) => x.slug === s.slug);
    if (t && isFilled(t.name) && isFilled(t.description)) thStyles.push({ ...s, name: t.name!, description: t.description! });
  }
  const thStyleSlugs = new Set(thStyles.map((s) => s.slug));
  const thPieces: Piece[] = [];
  for (const p of pieces) {
    const t = piecesTh.find((x) => x.slug === p.slug);
    if (!thStyleSlugs.has(p.style) || !t) continue;
    if (!isFilled(t.name) || !isFilled(t.alt)) continue;
    thPieces.push({ ...p, name: t.name!, alt: t.alt!, note: t.note ?? '', placement: t.placement ?? '' });
  }
  const skipped = pieces.length - thPieces.length;
  if (skipped) console.warn(`[content] ${skipped} piece(s) not yet in pieces.th.json — left out of the Thai pages.`);
  if (thStyles.length < 4) {
    console.warn('[content] Thai pages skipped — fewer than 4 styles are translated in styles.th.json.');
    return null;
  }
  return { lang: 'th', prefix: PREFIX.th, studio: studioTh, styles: thStyles, pieces: thPieces, copy: copyTh };
}

const th = buildThai();

export const sites: Site[] = th ? [en, th] : [en];
export const site = (lang: Lang): Site => (lang === 'th' && th ? th : en);

// Count remaining [PLACEHOLDER] values so nobody launches with them by accident.
const placeholders = JSON.stringify([studioEn, stylesEn, piecesEn, copyEn]).match(/"\[[^"]*\]"/g)?.length ?? 0;
if (placeholders) console.warn(`[content] ${placeholders} field(s) in the English content are still [PLACEHOLDERS].`);

// ---------- Helpers used across pages ----------

export const langParam = (lang: Lang) => (lang === 'th' ? 'th' : undefined);

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''));
}

export function piecesOf(s: Site, style: string): Piece[] {
  return s.pieces.filter((p) => p.style === style);
}

/**
 * The one piece that is both the style's home tile photo and the first cell
 * of its feed: `coverPiece` if it belongs to the style, otherwise the
 * highest-weight piece (the first one on a tie).
 */
export function coverOf(s: Site, style: Style): Piece | undefined {
  const own = piecesOf(s, style.slug);
  return own.find((p) => p.slug === style.coverPiece) ?? [...own].sort((a, b) => b.weight - a.weight)[0];
}

/**
 * The feed as laid out: every piece with its desktop and mobile cell, in the
 * order they are read on a phone (cover first). This is also the page order
 * and the prev/next order on piece pages. Patterns: src/lib/feedMosaic.ts.
 */
export function feedCells(s: Site, style: Style): FeedCell<Piece>[] {
  const cover = coverOf(s, style);
  if (!cover) return [];
  const pieces = [cover, ...piecesOf(s, style.slug).filter((p) => p !== cover)];
  const [c1, c2] = layouts[s.styles.length].desktop[s.styles.indexOf(style)];
  return layoutFeed(pieces, (p) => p.weight, coverSlot(c1, c2), true);
}

export function feedOf(s: Site, style: Style): Piece[] {
  return feedCells(s, style).map((c) => c.item);
}

/** The same pieces in the order they are read on desktop (cover first). */
export function feedOfDesktop(s: Site, style: Style): Piece[] {
  const [cover, ...rest] = feedCells(s, style);
  if (!cover) return [];
  rest.sort((a, z) => a.desktop.r - z.desktop.r || a.desktop.c - z.desktop.c);
  return [cover, ...rest].map((c) => c.item);
}

// Check every style in every language: the home tile's photo is the feed's
// cover cell (an error), and that cell is fully visible without scrolling at
// every viewport in fold.ts (a warning, printed on every build).
for (const s of sites) {
  const file = s.lang === 'th' ? 'styles.th.json' : 'styles.json';
  for (const style of s.styles) {
    const cover = coverOf(s, style);
    if (!cover) continue;
    const first = feedCells(s, style)[0];
    if (first.item !== cover || first.mobile.r !== 1 || first.desktop.r !== 1) {
      throw new ContentError(file, `Style "${style.slug}": the home tile shows "${cover.slug}" but the feed's cover cell holds "${first.item.slug}".`);
    }
    const head = {
      title: style.name,
      description: style.description,
      figures: [
        [s.copy.pieceCount, String(piecesOf(s, style.slug).length)],
        [s.copy.priceFrom, `${style.priceFrom} ${s.copy.thb}`],
        [s.copy.typicalHours, `${style.typicalHours} ${s.copy.hoursShort}`],
      ],
    };
    const low = checkFold(head, { mobile: first.mobile.h, desktop: first.desktop.h }).filter((r) => !r.ok);
    if (low.length) {
      contentWarning(
        file,
        `Style "${style.slug}": its cover photo "${cover.slug}" does not fit on the first screen at ${low.map((r) => r.where).join(', ')} ` +
          `(it ends at ${Math.round(low[0].bottom)}px, the screen at ${low[0].fold}px), so the home → style animation lands partly off screen.\n` +
          `    The page still works. To fix it, shorten the style's name or description (about 200 characters at most).`,
      );
    }
  }
}

export function whatsappHref(studio: Studio, message: string): string {
  return `https://wa.me/${studio.whatsapp}?text=${encodeURIComponent(message)}`;
}

/** `tel:` link and display text (spaces kept together) for the studio phone. */
export function phoneLink(studio: Studio) {
  return { href: `tel:${studio.phone.replace(/[^\d+]/g, '')}`, text: studio.phone.replace(/ /g, ' ') };
}

/** "5.0 on Google · 1029 reviews" */
export function ratingText(s: Site): string {
  return fill(s.copy.rating, { rating: s.studio.googleRating.toFixed(1), count: s.studio.googleReviews });
}

/** Path of the same page in the other language, or null if it isn't built. */
export function counterpart(path: string, from: Lang): string | null {
  if (!th) return null;
  const bare = from === 'th' ? path.slice(PREFIX.th.length) : path;
  const target = from === 'th' ? en : th;
  const style = bare.match(/^\/style\/([^/]+)\/$/);
  if (style && !target.styles.some((s) => s.slug === style[1])) return null;
  const work = bare.match(/^\/work\/([^/]+)\/$/);
  if (work && !target.pieces.some((p) => p.slug === work[1])) return null;
  return from === 'th' ? bare : `${PREFIX.th}${bare}`;
}
