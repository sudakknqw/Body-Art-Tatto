import type { APIRoute } from 'astro';
import studio from '../content/studio.json';

// While "hideFromSearch" is true in studio.json (the demo), search engines are
// asked to stay away entirely; every page also carries a robots noindex tag.
export const GET: APIRoute = ({ site }) =>
  new Response(
    studio.hideFromSearch
      ? 'User-agent: *\nDisallow: /\n'
      : `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
