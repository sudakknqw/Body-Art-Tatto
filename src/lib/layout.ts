// Facts shared by the build and the browser script. No imports, so it is safe
// to bundle into src/scripts/site.ts.

/** URL prefix of each language's pages. */
export const PREFIX = { en: '', th: '/th' } as const;
export const isHomePath = (path: string) => Object.values(PREFIX).some((p) => path === `${p}/`);

/**
 * Breakpoints in px. CSS media queries can't read variables, so the stylesheets
 * repeat these numbers literally (search for "min-width: 768px" / "1024px").
 */
export const BP = { tablet: 768, desktop: 1024 } as const;

/**
 * Width of the photo column on a piece page, desktop, as a CSS length: 4/5 of
 * the screen height, so the full-height photo box is 4:5, kept between 560px
 * and 55% of the window (also --photo-col in global.css).
 */
export const PHOTO_COL = 'max(560px, min(80vh, 55vw))';
