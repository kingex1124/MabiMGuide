const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { generate, normalizeUrl } = require('../scripts/build-seo.cjs');
test('static pages expose data, valid structured data, canonical links and a complete sitemap under a subdirectory', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mabim-seo-'));
  try {
    const base = 'https://example.test/guide/';
    const result = generate(temporary, { siteUrl: base, siteName: '測試 <網站>', googleAnalyticsId: 'G-YZX1C4M7C9' });
    assert.equal(result.pages, 663);
    const sitemap = fs.readFileSync(path.join(temporary, 'sitemap.xml'), 'utf8');
    assert.equal([...sitemap.matchAll(/<loc>/g)].length, result.pages);
    assert.ok([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].every(match => !match[1].includes('?')));
    const files = ['index.html', 'items.html', 'catalog.html', 'about.html', ...fs.readdirSync(path.join(temporary, 'item')).map(file => 'item/' + file)];
    for (const file of files) {
      const html = fs.readFileSync(path.join(temporary, file), 'utf8');
      const head = html.split('</head>')[0];
      assert.equal([...head.matchAll(/src="https:\/\/www.googletagmanager.com\/gtag\/js\?id=G-YZX1C4M7C9"/g)].length, 1, file);
      assert.equal([...head.matchAll(/gtag\('config', 'G-YZX1C4M7C9'\)/g)].length, 1, file);
      assert.equal([...html.matchAll(/<title>/g)].length, 1, file);
      assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1, file);
      assert.ok(html.includes(`href="${base}${file}"`), file);
      const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      assert.equal(graph['@context'], 'https://schema.org');
      assert.ok(sitemap.includes(`<loc>${base}${file}</loc>`));
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
        if (/^(https?:|#)/.test(href)) continue;
        const relative = path.resolve(path.dirname(path.join(temporary, file)), href.split('?')[0]);
        if (relative.endsWith('.html')) assert.ok(fs.existsSync(relative), `${file} -> ${href}`);
      }
    }
    const ingot = fs.readFileSync(path.join(temporary, 'item/item-0002.html'), 'utf8');
    assert.ok(ingot.includes('鐵礦石'));
    assert.ok(ingot.includes('item-0004.html'));
    assert.ok(ingot.includes('2026-09-25'));
    const robots = fs.readFileSync(path.join(temporary, 'robots.txt'), 'utf8');
    assert.ok(robots.includes('Disallow: /guide/Tool/'));
    assert.ok(robots.includes(`Sitemap: ${base}sitemap.xml`));
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
test('base URL rejects credentials, invalid protocols and parameters', () => {
  assert.equal(normalizeUrl('https://example.test/site'), 'https://example.test/site/');
  for (const value of ['file:///tmp/', 'https://user:password@example.test/', 'https://example.test/?q=x', 'https://example.test/#main']) assert.throws(() => normalizeUrl(value));
});
