// npm run import
//
// Reads the photo folders in src/images/pieces/ and brings
// src/content/styles.json and src/content/pieces.json in line with them.
//
//   src/images/pieces/
//     1 Blackwork/            ← "1" is the order on the site, "Blackwork" the style's name
//       cover-back.jpg        ← "cover-" marks the photo on the home page tile
//       sleeve.jpg
//       sleeve-detail.jpg     ← "-detail" / "-healed": extra photos of "sleeve.jpg"
//
// Safe to run again and again: anything already written by hand (names, notes,
// prices, sizes, alt text, weight) is kept, and only missing fields get a
// [PLACEHOLDER]. Running it with no photo changes changes nothing.
// A photo that was renamed keeps its text: the command recognises it by its
// content (fingerprints in src/content/import-state.json).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = new URL('../src/images/pieces/', import.meta.url);
const CONTENT = new URL('../src/content/', import.meta.url);
const FILES = { styles: 'styles.json', pieces: 'pieces.json', state: 'import-state.json' };

const IMAGE = /\.(jpe?g|png|webp|avif)$/i;
const COVER = /^cover-/i;
const EXTRA = /-(detail|healed)$/i;
const SYSTEM = /^(\.|thumbs\.db$|desktop\.ini$)/i;
const natural = (a, z) => a.localeCompare(z, 'en', { numeric: true, sensitivity: 'base' });
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const isPlaceholder = (v) => typeof v === 'string' && /^\[[\s\S]*\]$/.test(v.trim());
const baseName = (file) => file.replace(IMAGE, '').replace(COVER, '');
const readJson = (name, fallback) => {
  const url = new URL(name, CONTENT);
  return fs.existsSync(url) ? JSON.parse(fs.readFileSync(url, 'utf8')) : fallback;
};
const fingerprint = (rel) => crypto.createHash('sha1').update(fs.readFileSync(new URL(encodeURI(rel), ROOT))).digest('hex').slice(0, 16);
const list = (items) => items.map((x) => `  - ${x}`).join('\n');

const oldStyles = readJson(FILES.styles, []);
const oldPieces = readJson(FILES.pieces, []);
const oldState = readJson(FILES.state, {});

const notes = { unused: [], lastFolders: [], noCover: [], skippedFolders: [] };
const stop = [];

// ---------- 1. What is on disk ----------
const folders = [];
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (SYSTEM.test(entry.name)) continue;
  if (!entry.isDirectory()) {
    notes.unused.push(`"${entry.name}" is not inside a style folder, so it was left out. Move it into one of the style folders.`);
    continue;
  }
  const m = entry.name.match(/^(\d+)\s+(.+)$/);
  if (!m) notes.lastFolders.push(`"${entry.name}" has no number at the start, so it goes after the numbered styles.`);
  folders.push({ dir: entry.name, order: m ? Number(m[1]) : Infinity, name: (m ? m[2] : entry.name).trim() });
}
folders.sort((a, z) => a.order - z.order || natural(a.name, z.name));

const styles = [];
const found = []; // { style, rel, file, slug, detail, healed }
for (const f of folders) {
  const slug = slugify(f.name);
  if (styles.some((s) => s.slug === slug)) {
    stop.push(`Two folders both make the style "${f.name}". Rename one of them.`);
    continue;
  }
  const files = [];
  for (const file of fs.readdirSync(new URL(encodeURI(f.dir) + '/', ROOT)).sort(natural)) {
    if (SYSTEM.test(file)) continue;
    if (!IMAGE.test(file)) notes.unused.push(`"${f.dir}/${file}" is not a photo (use .jpg, .png, .webp or .avif), so it was left out.`);
    else files.push(file);
  }
  const extras = files.filter((x) => EXTRA.test(baseName(x)));
  const main = files.filter((x) => !EXTRA.test(baseName(x)));
  if (!main.length) {
    notes.skippedFolders.push(`"${f.dir}" has no photos yet, so this style is not on the site.`);
    continue;
  }
  const covers = main.filter((x) => COVER.test(x));
  if (covers.length > 1) {
    stop.push(`"${f.dir}" has more than one cover photo (${covers.join(', ')}). Keep "cover-" on only one of them.`);
    continue;
  }
  const cover = covers[0] ?? main[0];
  if (!covers.length) notes.noCover.push(`"${f.dir}" has no photo starting with "cover-", so "${cover}" is used as the cover.`);
  const ordered = [cover, ...main.filter((x) => x !== cover)];
  for (const x of extras) {
    const parent = baseName(x).replace(EXTRA, '').toLowerCase();
    if (!main.some((y) => baseName(y).toLowerCase() === parent)) {
      notes.unused.push(`"${f.dir}/${x}" looks like an extra photo, but there is no main photo called "${baseName(x).replace(EXTRA, '')}" next to it, so it was left out.`);
    }
  }
  for (const file of ordered) {
    const extra = (kind) => extras.find((x) => baseName(x).toLowerCase() === `${baseName(file)}-${kind}`.toLowerCase());
    const d = extra('detail');
    const h = extra('healed');
    found.push({
      style: slug,
      rel: `${f.dir}/${file}`,
      file,
      slug: slugify(baseName(file)),
      detail: d ? `${f.dir}/${d}` : '',
      healed: h ? `${f.dir}/${h}` : '',
    });
  }
  styles.push({ slug, name: f.name, coverRel: `${f.dir}/${cover}` });
}

// Two photos with the same file name in different folders would get the same
// address; the second one gets its style added to the address.
const taken = new Set();
for (const p of found) {
  if (taken.has(p.slug)) p.slug = `${p.slug}-${p.style}`;
  taken.add(p.slug);
}

if (stop.length) {
  console.error(`\nNothing was changed, because:\n${list(stop)}\n`);
  process.exit(1);
}

// ---------- 2. Match photos to what was there before ----------
const oldBySlug = new Map(oldPieces.map((p) => [p.slug, p]));
const matched = new Set();
const renamed = [];
const state = {};
for (const p of found) {
  p.hash = fingerprint(p.rel);
  state[p.slug] = p.hash;
  if (oldBySlug.has(p.slug)) {
    p.old = oldBySlug.get(p.slug);
    matched.add(p.slug);
  }
}
// A photo with a new name but the same content is the same piece, renamed.
for (const p of found) {
  if (p.old) continue;
  const was = Object.keys(oldState).find((s) => oldState[s] === p.hash && oldBySlug.has(s) && !matched.has(s));
  if (!was) continue;
  p.old = oldBySlug.get(was);
  matched.add(was);
  renamed.push(`"${p.old.image}" is now "${p.rel}" — its text is kept; its page moves from /work/${was}/ to /work/${p.slug}/.`);
}

// ---------- 3. Build the new files ----------
const PIECE_KEYS = ['slug', 'name', 'style', 'image', 'imageDetail', 'imageHealed', 'alt', 'note', 'placement', 'sizeCm', 'sessions', 'hours', 'price', 'weight'];
const photoExists = (rel) => typeof rel === 'string' && rel !== '' && fs.existsSync(new URL(encodeURI(rel), ROOT));
// Keep a value unless it is missing or still a [PLACEHOLDER].
const keep = (old, key, fallback) => (old && key in old && !isPlaceholder(old[key]) ? old[key] : fallback);

const pieces = found.map((p) => {
  const o = p.old;
  const piece = {
    slug: p.slug,
    name: keep(o, 'name', `[NAME — ${p.file}]`),
    style: p.style,
    image: p.rel,
    imageDetail: p.detail || (photoExists(o?.imageDetail) ? o.imageDetail : ''),
    imageHealed: p.healed || (photoExists(o?.imageHealed) ? o.imageHealed : ''),
    alt: keep(o, 'alt', '[ALT — one sentence: what the tattoo shows and where it is on the body]'),
    note: keep(o, 'note', `[NOTE — ${p.file}: 1–2 sentences from the artist — what the client asked for, how it was drawn]`),
    placement: keep(o, 'placement', '[e.g. Forearm]'),
    sizeCm: keep(o, 'sizeCm', '[NUMBER]'),
    sessions: keep(o, 'sessions', '[NUMBER]'),
    hours: keep(o, 'hours', '[NUMBER]'),
    price: keep(o, 'price', '[NUMBER]'),
    weight: [1, 2, 3].includes(o?.weight) ? o.weight : 1,
  };
  // Any other field someone added by hand stays, after the standard ones.
  for (const [k, v] of Object.entries(o ?? {})) if (!PIECE_KEYS.includes(k)) piece[k] = v;
  return piece;
});

// A style keeps its texts when its folder is renamed: it is the old style that
// held most of the same pieces.
const oldStyleOf = (s) => {
  const same = oldStyles.find((x) => x.slug === s.slug);
  if (same) return same;
  const mine = found.filter((p) => p.style === s.slug && p.old).map((p) => p.old.style);
  const best = [...new Set(mine)].map((slug) => ({ slug, n: mine.filter((x) => x === slug).length })).sort((a, z) => z.n - a.n)[0];
  return best && best.n * 2 >= found.filter((p) => p.style === s.slug).length ? oldStyles.find((x) => x.slug === best.slug) : undefined;
};
const STYLE_KEYS = ['slug', 'name', 'description', 'priceFrom', 'typicalHours', 'coverPiece'];
const renamedStyles = [];
const oldOf = new Map(styles.map((s) => [s.slug, oldStyleOf(s)]));
const newStyles = styles.map((s) => {
  const o = oldOf.get(s.slug);
  if (o && o.slug !== s.slug) renamedStyles.push(`"${o.name}" is now "${s.name}" — its description and prices are kept; its page moves from /style/${o.slug}/ to /style/${s.slug}/.`);
  const style = {
    slug: s.slug,
    name: s.name,
    description: keep(o, 'description', `[${s.name}: 2 SENTENCES — what it looks like on skin, how it ages, who it suits]`),
    priceFrom: keep(o, 'priceFrom', '[NUMBER]'),
    typicalHours: keep(o, 'typicalHours', '[NUMBER]'),
    coverPiece: found.find((p) => p.rel === s.coverRel).slug,
  };
  for (const [k, v] of Object.entries(o ?? {})) if (!STYLE_KEYS.includes(k)) style[k] = v;
  return style;
});

// ---------- 4. Write, only if something changed ----------
const write = (name, data) => {
  const text = JSON.stringify(data, null, 2) + '\n';
  const url = new URL(name, CONTENT);
  if (fs.existsSync(url) && fs.readFileSync(url, 'utf8') === text) return false;
  fs.writeFileSync(url, text);
  return true;
};
const sortedState = Object.fromEntries(Object.entries(state).sort(([a], [z]) => a.localeCompare(z)));
const changed = [write(FILES.styles, newStyles) && FILES.styles, write(FILES.pieces, pieces) && FILES.pieces].filter(Boolean);
write(FILES.state, sortedState);

// ---------- 5. Tell the person what happened ----------
const added = found.filter((p) => !p.old).map((p) => `"${p.rel}" (new page /work/${p.slug}/)`);
const removed = oldPieces.filter((p) => !matched.has(p.slug)).map((p) => `"${p.image}" — its photo is gone, so its page /work/${p.slug}/ is removed${isPlaceholder(p.name) ? '' : ` (it was called "${p.name}")`}.`);
const kept = new Set([...oldOf.values()].filter(Boolean));
const newStylesList = styles.filter((s) => !oldOf.get(s.slug)).map((s) => `"${s.name}"`);
const goneStyles = oldStyles.filter((o) => !kept.has(o)).map((o) => `"${o.name}"`);
const todo = pieces.filter((p) => isPlaceholder(p.alt)).length;

const out = [];
out.push(`Found ${found.length} photo(s) in ${styles.length} style folder(s).`);
if (added.length) out.push(`Added ${added.length} piece(s):\n${list(added)}`);
if (removed.length) out.push(`Removed ${removed.length} piece(s):\n${list(removed)}`);
if (renamed.length) out.push(`Renamed ${renamed.length} photo(s):\n${list(renamed)}`);
if (newStylesList.length && oldStyles.length) out.push(`New style(s): ${newStylesList.join(', ')}.`);
if (renamedStyles.length) out.push(`Renamed style(s):\n${list(renamedStyles)}`);
if (goneStyles.length) out.push(`Style(s) no longer on the site: ${goneStyles.join(', ')}.`);
const warnings = [...notes.noCover, ...notes.lastFolders, ...notes.skippedFolders, ...notes.unused];
if (warnings.length) out.push(`Please check:\n${list(warnings)}`);
out.push(changed.length ? `Updated ${changed.join(' and ')}.` : 'Nothing changed.');
if (todo) out.push(`${todo} piece(s) still need a description of the photo ("alt" in pieces.json).`);
console.log('\n' + out.join('\n\n') + '\n');
