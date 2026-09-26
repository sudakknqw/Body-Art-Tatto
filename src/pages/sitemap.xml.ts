import type { APIRoute } from 'astro';
import { sites, counterpart } from '../lib/content';

export const GET: APIRoute = ({ site: base }) => {
  const abs = (path: string) => new URL(path, base).href;
  const entries = sites.flatMap((s) => {
    const paths = [
      '/',
      '/artist/',
      '/info/',
      '/aftercare/',
      ...s.styles.map((x) => `/style/${x.slug}/`),
      ...s.pieces.map((x) => `/work/${x.slug}/`),
    ].map((p) => s.prefix + p);
    return paths.map((path) => {
      const other = counterpart(path, s.lang);
      const en = s.lang === 'en' ? path : other;
      const th = s.lang === 'th' ? path : other;
      const alternates =
        en && th
          ? [
              `<xhtml:link rel="alternate" hreflang="en" href="${abs(en)}"/>`,
              `<xhtml:link rel="alternate" hreflang="th" href="${abs(th)}"/>`,
              `<xhtml:link rel="alternate" hreflang="x-default" href="${abs(en)}"/>`,
            ].join('')
          : '';
      return `<url><loc>${abs(path)}</loc>${alternates}</url>`;
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
