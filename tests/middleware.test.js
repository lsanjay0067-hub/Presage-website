import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import middleware, { config, prefersMarkdown, MARKDOWN_PAGES } from '../middleware.js';

const root = new URL('../', import.meta.url);
const realFetch = globalThis.fetch;
let fetched;

beforeEach(() => {
  fetched = [];
  // Stand-in for Vercel serving the deployed static files.
  globalThis.fetch = async (url) => {
    fetched.push(new URL(url).pathname);
    try {
      return new Response(await readFile(new URL(`.${new URL(url).pathname}`, root)), { status: 200 });
    } catch {
      return new Response('not found', { status: 404 });
    }
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

const request = (path, accept, method = 'GET') =>
  new Request(`https://presageretention.com${path}`, { method, headers: accept ? { accept } : {} });

test('homepage returns Markdown for Accept: text/markdown', async () => {
  const res = await middleware(request('/', 'text/markdown'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(res.headers.get('vary'), 'Accept');
  const body = await res.text();
  assert.equal(body, await readFile(new URL('index.md', root), 'utf8'));
  assert.match(body, /^# Presage Retention/);
});

test('homepage falls through to HTML for browsers and Accept: text/html', async () => {
  for (const accept of [
    'text/html',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '*/*',
    undefined,
    'text/html, text/markdown;q=0.5',
    'text/markdown;q=0',
  ]) {
    assert.equal(await middleware(request('/', accept)), undefined, String(accept));
  }
  assert.deepEqual(fetched, []);
});

test('Accept negotiation honours q-values and wildcards', () => {
  assert.ok(prefersMarkdown('text/markdown'));
  assert.ok(prefersMarkdown('text/markdown, text/html;q=0.9'));
  assert.ok(prefersMarkdown('text/html;q=0.5, text/markdown'));
  assert.ok(prefersMarkdown('text/markdown, */*'));
  assert.ok(prefersMarkdown('TEXT/MARKDOWN; charset=utf-8'));
  assert.ok(!prefersMarkdown('text/*'));
  assert.ok(!prefersMarkdown('text/markdown;q=0.1, text/*;q=0.5'));
});

test('every Markdown page mirror exists and is served', async () => {
  for (const [path, source] of Object.entries(MARKDOWN_PAGES)) {
    const res = await middleware(request(path, 'text/markdown'));
    assert.equal(res.status, 200, path);
    assert.ok((await res.text()).length > 100, path);
    assert.equal(fetched.at(-1), source);
  }
  const res = await middleware(request('/privacy/', 'text/markdown'));
  assert.equal(res.status, 200);
});

test('unknown paths return a Markdown 404 that links to llms.txt and the sitemap', async () => {
  for (const path of ['/__ora-404-probe-gaa8xrfw', '/does/not/exist', '/missing.html']) {
    const res = await middleware(request(path, 'text/markdown'));
    assert.equal(res.status, 404, path);
    assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
    assert.equal(res.headers.get('vary'), 'Accept');
    const body = await res.text();
    assert.ok(body.length >= 20);
    assert.match(body, /^# 404/);
    assert.match(body, /https:\/\/presageretention\.com\/llms\.txt/);
    assert.match(body, /https:\/\/presageretention\.com\/sitemap\.xml/);
  }
  assert.deepEqual(fetched, []);
});

test('unknown paths for browsers fall through to the static 404 page', async () => {
  assert.equal(await middleware(request('/__ora-404-probe', 'text/html')), undefined);
});

test('HEAD gets headers without a body; other methods pass through', async () => {
  const res = await middleware(request('/', 'text/markdown', 'HEAD'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(await res.text(), '');
  assert.equal(await middleware(request('/', 'text/markdown', 'POST')), undefined);
});

test('falls back to HTML if the Markdown mirror cannot be fetched', async () => {
  globalThis.fetch = async () => new Response('', { status: 500 });
  assert.equal(await middleware(request('/', 'text/markdown')), undefined);
});

test('matcher skips static assets but covers pages and unknown paths', () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  for (const path of ['/', '/privacy.html', '/terms', '/__ora-404-probe-gaa8xrfw', '/a/b/c']) {
    assert.ok(matcher.test(path), path);
  }
  for (const path of ['/styles.css', '/script.js', '/Assets/Logo.png', '/llms.txt', '/index.md', '/sitemap.xml', '/robots.txt']) {
    assert.ok(!matcher.test(path), path);
  }
});
