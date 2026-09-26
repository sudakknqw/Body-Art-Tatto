# Body Art Tattoo — website

Static site for Body Art Tattoo, Ari, Bangkok. Astro, plain CSS, almost no JavaScript. Every booking button opens WhatsApp.

## Run it locally

Needs Node 22.12 or newer (the current Astro release doesn't support Node 20).

```bash
npm install
npm run dev        # http://localhost:4321, reloads on save
npm run build      # production build into dist/
npm run preview    # serve dist/ locally
npm run check:html # validate the built HTML
```

## Where things live

| Path | What |
|---|---|
| `src/content/studio.json` | Name, address, hours, phone, WhatsApp, prices, Google rating, domain (`siteUrl`). `addressShort` (e.g. "Ari, Bangkok") goes into every page title |
| `src/content/styles.json` | The 4–8 style tiles on the home page, in display order |
| `src/content/pieces.json` | Every tattoo shown on the site |
| `src/content/copy.json` | Button labels, page titles, Info and Aftercare text |
| `src/content/*.th.json` | Thai versions of the four files above — not there yet; see "Thai pages" |
| `src/images/pieces/` | Tattoo photos, one folder per style: `1 Blackwork/`, `2 Ornamental/`… (originals; the build makes the small versions) |
| `src/scripts/site.ts` | Everything that runs in the browser: page changes without reloads (Astro ClientRouter), transitions, "Show more". The site works fully without it. |

## Add a piece

1. Put the photo in its style's folder in `src/images/pieces/`, e.g. `3 Japanese/koi-forearm.jpg`. Use the original file, at least 1600 px wide.
2. Add an entry to `src/content/pieces.json` (copy an existing one and change it):

```json
{
  "slug": "koi-forearm",
  "name": "Koi on forearm",
  "style": "japanese",
  "image": "3 Japanese/koi-forearm.jpg",
  "imageDetail": "",
  "imageHealed": "",
  "alt": "Red and black koi swimming up the inner forearm",
  "note": "The client wanted movement, so the koi follows the wrist.",
  "placement": "Forearm",
  "sizeCm": "18",
  "sessions": "2",
  "hours": "7",
  "price": "",
  "weight": 2
}
```

- `slug` becomes the address: `/work/koi-forearm/`. Lowercase, dashes, no spaces, never reused.
- `style` must be a `slug` from `styles.json`.
- `image` is the path inside `src/images/pieces/`, folder included. `imageDetail` / `imageHealed` the same.
- `alt` is required: say what the tattoo shows and where it is.
- `weight`: 3 = large in the grid, 2 = medium, 1 = small (default).
- `imageDetail` / `imageHealed`: optional extra photos; leave `""` if none.
- `price`: leave `""` to hide it.
- Each style's feed starts with its cover photo. The rest are placed 12 at a time: heavier pieces take the bigger cells, and pieces of the same weight keep their order from the file.

If something is wrong (missing photo, missing alt, unknown style), `npm run build` stops and tells you which piece and what to fix.

Once the Thai site is on, add the same `slug` to `pieces.th.json` with Thai `name`, `alt`, `note`, `placement`. A piece without a Thai entry just doesn't appear on the Thai pages.

## Add or remove a style

Edit `src/content/styles.json`. Each style needs `slug`, `name`, `description`, `priceFrom`, `typicalHours` and `coverPiece`. The home page has a hand-made mosaic for 4, 5, 6, 7 and 8 styles and picks one by count. The first style is the big tile. Add the style to `styles.th.json` too if the Thai site is on.

`coverPiece` is the slug of the photo shown on the home tile. The same photo is the first one in that style's feed: tapping the tile makes it grow into place there. Leave it `""` (or if it names a piece from another style) and the style's highest-`weight` piece is used.

The cover should be fully visible without scrolling when the feed opens, on phones (360–430px wide, 844px tall) and on desktop (1024–1920px wide, 900px tall), so the tile → feed animation lands on screen. Every build checks this and prints a warning such as *"its cover photo … does not fit on the first screen at 360×844"* when a long style name or description pushes it down. The site still builds and works; shorten the text (a description of about 200 characters fits).

## Feed mosaic

A style's feed is laid out with hand-drawn mosaics in `src/lib/feedMosaic.ts`: three patterns (A, B, C) for desktop and three for phones, used in turn for each batch of 12 pieces that "Show more" reveals. You don't need to touch them to add pieces: `weight` decides the cell size (3 gets the largest cells of its batch, 1 the smallest). Desktop pattern A has four versions, so the cover cell sits under the home tile it came from.

A style with only 1–5 pieces (or a last batch of 1–5) gets a small layout of its own instead, so an underfilled style never shows holes: 3–5 pieces fill the full width with a flat bottom edge; 1–2 pieces sit centred as squares, because a cell wide enough to fill the row would be too tall for the cover to fit on the first screen. A last batch of 6–11 uses the first cells of its pattern and ends with a ragged edge.

On desktop, `src/scripts/site.ts` puts the pieces in the desktop mosaic's order in the page (row by row), so Tab and screen readers follow what is on screen; the HTML itself is in phone order.

## Thai pages

The `/th/` pages are built only when all four files exist in `src/content/`. Right now there are none, so the site is English only: no `/th/` pages, no language link, no `hreflang`, nothing Thai in the sitemap. When a real translation arrives, drop the four files in and build — nothing else changes:

- `copy.th.json`: a copy of `copy.json` with every value translated. The build stops and lists any text that is missing.
- `studio.th.json`: only the fields that need Thai, e.g. `artist`, `tagline`, `about`, `address`, `addressShort`, `bts`, `hours`, `deposit`. Everything else comes from `studio.json`.
- `styles.th.json`: `[{ "slug", "name", "description" }]` per style.
- `pieces.th.json`: `[{ "slug", "name", "alt", "note", "placement" }]` per piece.

A style or piece without a Thai entry is left out of the Thai pages (the build says how many). If fewer than 4 styles are translated, the Thai site is skipped. Nothing falls back to English.

## Placeholders

Every `[BRACKETED]` value is waiting for real content. The build prints how many are left. `CONTENT.md` lists what to ask the studio for. The photos in `src/images/pieces/` are real; `npm run placeholders` only makes solid-colour stand-ins for images that `pieces.json` names but that don't exist yet (it never overwrites a photo).

The first build after adding many photos is slow (72 photos: about 6 minutes), because every photo is encoded in 5 widths × 3 formats. Later builds reuse `node_modules/.astro` and take seconds.

## Deploy (Netlify)

1. Put the project in a Git repository (GitHub, GitLab or Bitbucket).
2. In Netlify: **Add new site → Import an existing project**, pick the repo. `netlify.toml` already sets the build command (`npm run build`), the publish folder (`dist`), Node 22 and cache headers.
3. Set the real domain in `src/content/studio.json` → `siteUrl` (used for canonical URLs, the sitemap and share previews), then connect the same domain in Netlify → Domain settings.
4. After that, every push to the main branch redeploys the site.

After launch, submit `https://yourdomain/sitemap.xml` in Google Search Console, and add the website link to the Google Business profile.
