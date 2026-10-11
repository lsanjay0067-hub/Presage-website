import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const SITE = 'https://presageretention.com';
// Map a site URL onto the file Vercel serves for it.
const fileFor = (url) => {
  const { pathname } = new URL(url);
  return pathname === '/' ? 'index.html' : pathname.slice(1);
};

test('llms.txt follows the llmstxt.org structure and has when-to-use guidance', async () => {
  const text = await read('llms.txt');
  const lines = text.split('\n');
  assert.match(lines[0], /^# \S/, 'starts with an H1');
  assert.equal(text.match(/^# /gm).length, 1, 'exactly one H1');
  assert.match(lines[2], /^> \S/, 'summary blockquote follows the H1');
  assert.match(text, /^## When to use Presage$/m);
  assert.match(text, /^## How an agent should engage$/m);
  assert.match(text, /^## Optional$/m);
  const links = [...text.matchAll(/\[[^\]]+\]\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);
  assert.ok(links.length >= 4);
  for (const link of links.filter((l) => l.startsWith(SITE))) {
    await access(new URL(fileFor(link), root));
  }
});

test('sitemap.xml is a valid urlset listing every indexable page', async () => {
  const xml = await read('sitemap.xml');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<\/urlset>\n$/);
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g)];
  assert.equal(entries.length, (xml.match(/<url>/g) || []).length, 'every <url> has loc and lastmod');
  const locs = entries.map((e) => e[1]);
  assert.deepEqual(locs.sort(), [`${SITE}/`, `${SITE}/privacy.html`, `${SITE}/terms.html`]);
  for (const [, loc, lastmod] of entries) {
    assert.match(lastmod, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(lastmod)));
    await access(new URL(fileFor(loc), root));
  }
});

test('robots.txt points to the sitemap', async () => {
  assert.match(await read('robots.txt'), new RegExp(`^Sitemap: ${SITE}/sitemap\\.xml$`, 'm'));
});

test('HTML pages declare canonical URLs and their Markdown alternates', async () => {
  for (const [file, path] of [['index.html', '/'], ['privacy.html', '/privacy.html'], ['terms.html', '/terms.html']]) {
    const html = await read(file);
    assert.ok(html.includes(`<link rel="canonical" href="${SITE}${path}">`), file);
    const md = html.match(/<link rel="alternate" type="text\/markdown" href="([^"]+)"/)[1];
    await access(new URL(md.slice(1), root));
  }
});

test('homepage names the brand with its product in title and structured data', async () => {
  const html = await read('index.html');
  assert.match(html, /<title>Presage Retention \| Email &amp; SMS retention studio for ecommerce brands<\/title>/);
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.name, 'Presage Retention');
  assert.equal(data.url, `${SITE}/`);
});

test('static 404 page links to the sitemap and llms.txt with root-relative assets', async () => {
  const html = await read('404.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /href="\/sitemap\.xml"/);
  assert.match(html, /href="\/llms\.txt"/);
  assert.ok(!/(?:href|src)="\.?\/?(?:Assets|styles\.css|script\.js)/.test(html.replace(/(?:href|src)="\/(?:Assets|styles\.css|script\.js)/g, '')));
});

test('vercel.json is valid and sends Vary: Accept', async () => {
  const config = JSON.parse(await read('vercel.json'));
  const all = config.headers.find((h) => h.source === '/(.*)');
  assert.deepEqual(all.headers, [{ key: 'Vary', value: 'Accept' }]);
});
