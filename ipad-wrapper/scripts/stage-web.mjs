import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';

const source = new URL('../../web/', import.meta.url);
const destination = new URL('../www/', import.meta.url);
const assetDirectories = new Set(['css', 'js', 'vendor']);
const entries = await readdir(source, { withFileTypes: true });
const assets = entries.filter((entry) =>
  (entry.isFile() && entry.name.endsWith('.html')) ||
  (entry.isDirectory() && assetDirectories.has(entry.name))
);
if (!assets.some((entry) => entry.name === 'index.html')) {
  throw new Error('Missing web/index.html');
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await Promise.all(assets.map(({ name }) =>
  cp(new URL(name, source), new URL(name, destination), { recursive: true })
));

// The iPad app locks the page scale so pinches and double-taps while
// practicing don't zoom the page. The web version stays zoomable.
const viewportTag = /<meta\s+name="viewport"[^>]*>/;
const appViewportTag =
  '<meta name="viewport" content="width=device-width, initial-scale=1, ' +
  'maximum-scale=1, user-scalable=no">\n' +
  '  <style>html { touch-action: pan-x pan-y; }</style>';
await Promise.all(assets
  .filter((entry) => entry.isFile())
  .map(async ({ name }) => {
    const file = new URL(name, destination);
    const html = await readFile(file, 'utf8');
    if (!viewportTag.test(html)) {
      throw new Error(`Missing viewport meta tag in web/${name}`);
    }
    await writeFile(file, html.replace(viewportTag, appViewportTag));
  }));
