// Builds the published page in dist/ from src/: the scripts as one minified module, the stylesheet
// minified into the page itself, and every local file the page names stamped with a hash of its
// contents, so that a new version is never served from an old cache. Images, video, fonts and the demo
// live only in dist/ and are left as they are.
//
//   node scripts/build.mjs           build once
//   node scripts/build.mjs --watch   build again whenever something in src/ changes
//   node scripts/build.mjs --check   fail if dist/ is not what src/ builds to (nothing is written)
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

const digest = data => createHash('sha256').update(data).digest('hex').slice(0, 10);

// `/portfolio/x.webp` → `/portfolio/x.webp?v=…`. Folders, missing files and stamped addresses stay as written.
async function stamp(url) {
  const file = url.split(/[?#]/)[0];
  if (file !== url || !file.startsWith('/') || file.startsWith('//') || file.endsWith('/')) return url;
  try { return `${file}?v=${digest(await readFile(path.join(dist, file)))}`; } catch { return url; }
}

// The shader is read by the GPU, not by people: in the published script its text keeps no comments or
// indentation. Only the literal text of template strings changes; the `${…}` inside them stay as written.
// Comments and quoted strings around them are stepped over. The scan always ends, and whatever it cannot
// make sense of (an unclosed quote, a quote inside a regular expression) is left as it is.
function tightenShaders(source) {
  const end = source.length;
  const tighten = text => text.replace(/\/\/[^\n]*/g, '').replace(/[ \t]+/g, ' ').replace(/ ?\n\s*/g, '\n');
  // One past the closing quote of the string opening at `at`, or the end of its line: strings do not span lines.
  const pastQuoted = at => {
    let i = at + 1;
    while (i < end && source[i] !== source[at] && source[i] !== '\n') i += source[i] === '\\' ? 2 : 1;
    return Math.min(end, i + 1);
  };
  // One past the `}` that closes the substitution opening at `at` (its `$`).
  const pastSubstitution = at => {
    let depth = 0, i = at + 1;
    for (; i < end; i += 1) {
      if (source[i] === "'" || source[i] === '"') i = pastQuoted(i) - 1;
      else if (source[i] === '{') depth += 1;
      else if (source[i] === '}' && --depth === 0) return i + 1;
    }
    return end;
  };
  let out = '', at = 0;
  while (at < end) {
    const char = source[at], next = source[at + 1];
    let to;
    if (char === '`') {
      let text = '';
      out += '`';
      at += 1;
      while (at < end && source[at] !== '`') {
        if (source[at] === '\\') { text += source.slice(at, at + 2); at += 2; }
        else if (source[at] === '$' && source[at + 1] === '{') {
          out += tighten(text);
          text = '';
          to = pastSubstitution(at);
          out += source.slice(at, to);
          at = to;
        } else { text += source[at]; at += 1; }
      }
      out += tighten(text) + (at < end ? '`' : '');
      at += 1;
      continue;
    }
    if (char === '/' && next === '/') { to = source.indexOf('\n', at); if (to < 0) to = end; }
    else if (char === '/' && next === '*') { to = source.indexOf('*/', at + 2); to = to < 0 ? end : to + 2; }
    else if (char === "'" || char === '"') to = pastQuoted(at);
    else to = at + 1;
    out += source.slice(at, to);
    at = to;
  }
  return out;
}
const shaders = {
  name: 'shaders',
  setup(build) {
    build.onLoad({ filter: /-glsl\.js$/ }, async ({ path: file }) => ({ contents: tightenShaders(await readFile(file, 'utf8')), loader: 'js' }));
  },
};

async function replace(text, pattern, change) {
  const found = [...text.matchAll(pattern)];
  const changed = await Promise.all(found.map(match => change(...match)));
  let at = 0, out = '';
  found.forEach((match, index) => { out += text.slice(at, match.index) + changed[index]; at = match.index + match[0].length; });
  return out + text.slice(at);
}

const checking = process.argv.includes('--check');
const stale = [];
async function output(file, contents) {
  const target = path.join(dist, file);
  if (!checking) return writeFile(target, contents);
  const current = await readFile(target).catch(() => null);
  if (!current || !current.equals(Buffer.from(contents))) stale.push(file);
}

async function run() {
  const started = performance.now();
  const script = await build({
    entryPoints: [path.join(src, 'portfolio/site.js')],
    bundle: true, format: 'esm', minify: true, target: 'es2022', legalComments: 'none', write: false, plugins: [shaders],
  });
  // The page names the script by a hash of what it will be, so the script is known before the page is written.
  const code = script.outputFiles[0].contents;
  await output('portfolio/app.js', code);

  const sheet = await transform(await readFile(path.join(src, 'portfolio/style.css'), 'utf8'), { loader: 'css', minify: true });
  const style = await replace(sheet.code.trim(), /url\(\s*["']?([^"')]+)["']?\s*\)/g, async (match, url) => `url(${await stamp(url)})`);

  let page = await readFile(path.join(src, 'index.html'), 'utf8');
  const sheetTag = '<link rel="stylesheet" href="/portfolio/style.css">';
  const scriptTag = '<script src="/portfolio/site.js" type="module"></script>';
  if (!page.includes(sheetTag) || !page.includes(scriptTag)) throw new Error('src/index.html no longer names style.css and site.js as the build expects');
  page = page.replace(sheetTag, () => `<style>${style}</style>`);
  page = page.replace(scriptTag, () => `<script type="module" src="/portfolio/app.js?v=${digest(code)}"></script>`);
  page = await replace(page, /<script>([\s\S]*?)<\/script>/g, async (match, code) => `<script>${(await transform(code, { minify: true })).code.trim()}</script>`);
  page = await replace(page, /\b(src|href|poster|data-src)="(\/[^"]*)"/g, async (match, name, url) => `${name}="${await stamp(url)}"`);
  // A list of candidates, each an address and its width.
  page = await replace(page, /\bsrcset="([^"]*)"/g, async (match, list) => {
    const candidates = await Promise.all(list.split(',').map(async candidate => {
      const [url, ...size] = candidate.trim().split(/\s+/);
      return [await stamp(url), ...size].join(' ');
    }));
    return `srcset="${candidates.join(', ')}"`;
  });
  // Indentation goes; a line break stays wherever there was one, so no two words ever touch.
  page = page.replace(/\n[ \t]+/g, '\n');
  await output('index.html', page);
  if (checking) {
    if (stale.length) { console.error(`dist/ is out of date (${stale.join(', ')}): run npm run build`); process.exitCode = 1; }
    else console.log('dist/ matches src/');
    return;
  }

  const size = file => readFile(path.join(dist, file)).then(data => `${file} ${(data.length / 1024).toFixed(1)} kB (${(gzipSync(data).length / 1024).toFixed(1)} kB gzip)`);
  console.log(`built in ${Math.round(performance.now() - started)} ms: ${(await Promise.all(['index.html', 'portfolio/app.js'].map(size))).join(', ')}`);
}

await run();
if (process.argv.includes('--watch')) {
  let timer;
  watch(src, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => run().catch(error => console.error(error.message)), 60);
  });
  console.log('watching src/ …');
}
