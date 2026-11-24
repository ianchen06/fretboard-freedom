// Tests that each page's own script only dereferences elements the page has. A page script
// (js/*-app.js) that runs `$('x').addEventListener(...)` for an id the page doesn't have throws
// at load, and nothing after that line runs. Commit 9dd7e60 did this on the Daily session page
// (`$('mgMode')`, which session.html only had as data-name): the key menu stayed empty and
// rating, the plan and the settings were never wired up. Looked-up ids may also come from markup
// the script itself writes (`id="..."` in a template, or `el.id = '...'`). Guarded lookups
// (`if ($('x'))`, `$('x') && …`, `const el = $('x')`) aren't dereferences and are not checked.
// Run: node web/test/pages.test.js
'use strict';
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..');
let failures = 0;
let checked = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };

const read = (rel) => fs.readFileSync(path.join(WEB, rel), 'utf8');
const pages = fs.readdirSync(WEB).filter((f) => f.endsWith('.html'));

for (const page of pages) {
  const html = read(page);
  const scripts = [...html.matchAll(/<script[^>]+src="(js\/[^"?]+)/g)].map((m) => m[1]);
  for (const s of scripts) check(fs.existsSync(path.join(WEB, s)), `${page} loads ${s}, which exists`);
  const sources = scripts.filter((s) => fs.existsSync(path.join(WEB, s))).map((s) => [s, read(s)]);

  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, src] of sources) {
    for (const m of src.matchAll(/\bid="([A-Za-z][\w-]*)"/g)) ids.add(m[1]);
    for (const m of src.matchAll(/\.id\s*=\s*['"]([A-Za-z][\w-]*)['"]/g)) ids.add(m[1]);
  }

  // The page's own script: `$('id').something` or `$('id')[...]` is a dereference.
  for (const [s, src] of sources.filter(([s]) => /-app\.js$/.test(s))) {
    for (const m of src.matchAll(/\$\(\s*'([A-Za-z][\w-]*)'\s*\)\s*(?:\.|\[)/g)) {
      checked++;
      const line = src.slice(0, m.index).split('\n').length;
      check(ids.has(m[1]), `${s}:${line} dereferences #${m[1]}, which ${page} has`);
    }
  }
}

check(checked > 300, `checked a realistic number of lookups (${checked})`);
console.log(failures ? `${failures} failure(s)` : `all page tests passed (${checked} lookups on ${pages.length} pages)`);
process.exit(failures ? 1 : 0);
