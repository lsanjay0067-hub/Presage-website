import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Klaviyo partner badge opacity is driven by one CSS variable, currently hidden', async () => {
  const css = await read('styles.css');
  assert.match(css, /:root \{[^}]*--klaviyo-badge-opacity: 0;/);
  assert.match(css, /\.klaviyo-badge \{\s*opacity: var\(--klaviyo-badge-opacity\);\s*\}/);
  const html = await read('index.html');
  assert.match(html, /<img class="brand-name klaviyo-badge" src="\.\/Assets\/klaviyo-partner-badge-light\.png"/);
});
