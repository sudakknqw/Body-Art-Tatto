// @ts-check
import { defineConfig } from 'astro/config';
import fs from 'node:fs';

// Check the content files first, so a typo names the file it is in.
const contentDir = new URL('./src/content/', import.meta.url);
for (const file of fs.readdirSync(contentDir).filter((f) => f.endsWith('.json'))) {
  try {
    JSON.parse(fs.readFileSync(new URL(file, contentDir), 'utf8'));
  } catch (e) {
    throw new Error(`\n\n  ✖ src/content/${file} is not valid JSON: ${e instanceof Error ? e.message : e}\n`);
  }
}

// The public domain lives in src/content/studio.json ("siteUrl").
const { siteUrl } = JSON.parse(fs.readFileSync(new URL('studio.json', contentDir), 'utf8'));

export default defineConfig({
  site: siteUrl,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  image: { service: { entrypoint: 'astro/assets/services/sharp' } },
  devToolbar: { enabled: false },
});
