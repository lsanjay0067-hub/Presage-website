import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const PAGES = ['index.html', 'privacy.html', 'terms.html', '404.html'];

test('every page links the dark search icons, and the files exist', async () => {
  for (const page of PAGES) {
    const html = await read(page);
    for (const href of ['/favicon.ico', '/Assets/icon-96.png', '/Assets/icon-192.png', '/Assets/apple-touch-icon.png']) {
      assert.ok(html.includes(`href="${href}"`), `${page} links ${href}`);
      await access(new URL(href.slice(1), root));
    }
  }
});

test('nav and footer use the Process and System labels', async () => {
  for (const page of PAGES) {
    const html = await read(page);
    assert.ok(!html.includes('>The method</a>'), page);
    assert.ok(!html.includes('>How it works</a>'), page);
    assert.equal((html.match(/>Process<\/a>/g) || []).length, 2, page);
    assert.equal((html.match(/>System<\/a>/g) || []).length, 2, page);
  }
});

test('footer closes with the oversized wordmark below the legal row', async () => {
  for (const page of PAGES) {
    const html = await read(page);
    const bottom = html.indexOf('class="footer-bottom"');
    const wordmark = html.indexOf('class="footer-wordmark"');
    assert.ok(bottom > 0 && wordmark > bottom, page);
  }
});

test('homepage has eight FAQs mirrored in FAQPage structured data', async () => {
  const html = await read('index.html');
  const questions = [...html.matchAll(/<button class="faq-question"[^>]*>\s*<span[^>]*><\/span>\s*<span>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.equal(questions.length, 8);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const faq = blocks.find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq, 'FAQPage JSON-LD present');
  const decode = (s) => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');
  assert.deepEqual(faq.mainEntity.map((q) => q.name), questions.map(decode));
});

test('hero: headline, normal-case note, and partner logos under it', async () => {
  const html = await read('index.html');
  assert.match(html, /<h1[^>]*><span>Product into rituals<\/span>/);
  const note = html.indexOf('class="hero-note');
  const partners = html.indexOf('class="hero-partners');
  assert.ok(note > 0 && partners > note);
  assert.ok(!html.includes('class="platforms'));
  const css = await read('styles.css');
  const noteRule = css.match(/\.hero-note \{[^}]*\}/)[0];
  assert.ok(!noteRule.includes('uppercase'));
});

test('Calendly is not loaded up front; script.js loads it on demand', async () => {
  const html = await read('index.html');
  assert.ok(!html.includes('assets.calendly.com/assets/external/widget.js'));
  assert.match(html, /<script src="script\.js" defer><\/script>/);
  const js = await read('script.js');
  assert.match(js, /assets\.calendly\.com\/assets\/external\/widget\.js/);
});

test('every image the homepage references exists', async () => {
  const html = await read('index.html');
  const srcs = new Set([...html.matchAll(/(?:src|href)="\.?\/?(Assets\/[^"]+)"/g)].map((m) => m[1]));
  assert.ok(srcs.size > 10);
  for (const src of srcs) await access(new URL(src, root));
});
