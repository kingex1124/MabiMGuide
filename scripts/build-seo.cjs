// Generates plain HTML from the same dataset used by the interactive guide.
const fs = require('node:fs');
const path = require('node:path');
const { createIndex } = require('../guide-data.js');
const root = path.resolve(__dirname, '..');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
function normalizeUrl(value) {
  if (!value) return '';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('siteUrl 必須是沒有參數或帳密的 HTTP(S) 網站根目錄網址');
  return url.href.replace(/\/+$/, '') + '/';
}
function generate(target = root, config = JSON.parse(fs.readFileSync(path.join(root, 'seo.config.json'), 'utf8'))) {
  const base = normalizeUrl(config.siteUrl);
  const data = JSON.parse(fs.readFileSync(path.join(root, 'Data/mabim-workshop.json'), 'utf8'));
  const index = createIndex(data);
  const absolute = file => base ? new URL(file, base).href : undefined;
  const write = (file, content) => { fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true }); fs.writeFileSync(path.join(target, file), content); };
  const itemFile = id => `item/${encodeURIComponent(id)}.html`;
  const date = data.exportedAt && !Number.isNaN(Date.parse(data.exportedAt)) ? new Date(data.exportedAt).toISOString() : null;
  const sourceNote = prefix => `<aside class="source-note"><h2>資料來源與適用範圍</h2><p>本頁根據本站維護的 <a href="${prefix}Data/mabim-workshop.json">道具資料集</a>整理。${date ? `資料匯出時間：<time datetime="${date}">${date.slice(0, 10)}（UTC）</time>。` : ''}這是資料快照日期，並非遊戲版本或逐筆驗證日期。</p><p>本站為非官方玩家工具。資料未提供素材數量、取得地點或完整遊戲版本資訊；未記錄的用途不代表遊戲中不存在。內容以遊戲內資訊為準。<a href="${prefix}about.html">查看資料整理方式</a></p></aside>`;
  function metadata(file, title, description, type = 'WebPage', entity) {
    const url = absolute(file);
    const graph = [{ '@type': 'WebSite', '@id': absolute('index.html#website'), name: config.siteName, url: absolute('index.html'), inLanguage: 'zh-Hant' }, { '@type': type, '@id': url, url, name: title, description, inLanguage: 'zh-Hant', isPartOf: base ? { '@id': absolute('index.html#website') } : undefined, mainEntity: entity }];
    if (base && file !== 'index.html') graph.push({ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '首頁', item: absolute('index.html') }, ...(file.startsWith('item/') ? [{ '@type': 'ListItem', position: 2, name: '道具目錄', item: absolute('catalog.html') }] : []), { '@type': 'ListItem', position: file.startsWith('item/') ? 3 : 2, name: title.split('｜')[0], item: url }] });
    return `<!-- SEO:START -->
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#315d46">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="${escape(config.siteName)}">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">
  ${url ? `<link rel="canonical" href="${escape(url)}">\n  <meta property="og:url" content="${escape(url)}">` : '<!-- 正式網址尚未設定；設定 seo.config.json 後重新產生 canonical 與 sitemap。 -->'}
  <script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': graph })}</script>
  <!-- SEO:END -->`;
  }
  function page(file, title, description, body, type, entity) {
    const prefix = file.startsWith('item/') ? '../' : '';
    return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${metadata(file, title, description, type, entity)}<link rel="stylesheet" href="${prefix}styles.css"></head>
<body><a class="skip" href="#main">跳至主要內容</a><header class="header"><a class="brand" href="${prefix}index.html">瑪奇 M <small>冒險手札</small></a><nav aria-label="主要選單"><a href="${prefix}index.html">首頁</a><a href="${prefix}items.html">道具查詢</a></nav></header><main id="main" class="reference-page"><nav class="breadcrumbs" aria-label="麵包屑"><a href="${prefix}index.html">首頁</a> / <a href="${prefix}catalog.html">道具目錄</a></nav>${body}</main><footer><a href="${prefix}about.html">關於本站與資料來源</a><a href="${prefix}catalog.html">完整道具目錄</a><p>非官方玩家工具 · 以遊戲內資訊為準</p></footer></body></html>\n`;
  }
  const filenames = ['index.html', 'items.html', 'catalog.html', 'about.html'];
  const itemLinks = (ids, prefix) => ids.map(id => `<li><a href="${prefix}${itemFile(id)}">${escape(index.items.get(id).name)}</a> <small>${escape(id)}</small></li>`).join('\n');
  for (const item of index.items.values()) {
    const file = itemFile(item.id); filenames.push(file);
    const uses = index.uses.get(item.id);
    const materials = item.components.map(id => index.items.get(id).name);
    const useNames = uses.map(id => index.items.get(id).name);
    const title = `${item.name}｜素材、製作配方與用途｜${config.siteName}`;
    const summary = `${item.name}（${item.id}）${materials.length ? `由${materials.join('、')}製成` : '目前未記錄組成素材'}；${uses.length ? `可用於製作${useNames.slice(0, 4).join('、')}${uses.length > 4 ? `等 ${uses.length} 種道具` : ''}` : '目前未記錄後續用途'}。`;
    const description = [...summary].slice(0, 155).join('');
    const body = `<article><p class="eyebrow">ITEM REFERENCE · ${escape(item.id)}</p><h1>${escape(item.name)}</h1><p class="reference-summary">${escape(summary)}</p><p class="detail-description">${escape(item.description || '目前資料未提供此道具的額外說明。')}</p><dl><dt>道具 ID</dt><dd>${escape(item.id)}</dd><dt>分類標籤</dt><dd>${escape(item.tags.map(id => index.tags.get(id).name).join('、') || '未分類')}</dd></dl><div class="reference-columns"><section><h2>${escape(item.name)}由哪些素材製成？</h2>${materials.length ? `<ul>${itemLinks(item.components, '../')}</ul>` : '<p>目前資料未記錄組成素材。</p>'}</section><section><h2>${escape(item.name)}可以製作什麼？</h2>${uses.length ? `<ul>${itemLinks(uses, '../')}</ul>` : '<p>目前資料未記錄後續用途。</p>'}</section></div><p>點選素材或成品連結，可繼續追蹤上一層來源與下一層用途。</p><a class="button primary" href="../items.html?q=${encodeURIComponent(item.id)}">在查詢工具中展開關聯樹 ↗</a>${sourceNote('../')}</article>`;
    write(file, page(file, title, description, body, 'WebPage', { '@type': 'Thing', name: item.name, identifier: item.id, description: summary, url: absolute(file) }));
  }
  write('catalog.html', page('catalog.html', `完整道具目錄｜${config.siteName}`, `瀏覽 ${index.items.size} 件瑪奇 M 道具，查看道具 ID、製作素材及直接用途，並沿著道具連結追蹤製作關聯。`, `<h1>完整道具目錄</h1><p>收錄 ${index.items.size} 件道具。每件道具有獨立的資料頁，無需執行 JavaScript 即可閱讀素材與用途。</p><p><a class="text-link" href="items.html">使用關鍵字與標籤搜尋 →</a></p><ul class="reference-list">${itemLinks([...index.items.keys()], '')}</ul>${sourceNote('')}`, 'CollectionPage'));
  write('about.html', page('about.html', `關於本站與資料來源｜${config.siteName}`, '了解瑪奇 M 冒險手札的資料來源、配方整理方式、使用限制，以及素材與用途關聯的解讀方法。', `<h1>關於本站與資料來源</h1><section><h2>這是什麼網站？</h2><p>瑪奇 M 冒險手札是繁體中文的非官方玩家道具工具，提供名稱、ID、說明搜尋與多標籤篩選。</p><h2>素材與用途如何整理？</h2><p>每件道具的組成素材來自道具資料集的 components 欄位。用途則反向查找哪些道具引用了這件素材，沒有另行推測配方。道具可能同時出現在多條製作路徑中。</p><h2>多選標籤怎麼查詢？</h2><p>標籤以 AND（且）串接，道具必須同時包含所有選取的標籤才會出現在結果中。</p><h2>沒有列出配方，代表不能製作嗎？</h2><p>不代表。沒有列出素材或用途，只表示本站目前沒有記錄；請以遊戲內資訊為準。</p><h2>資料的可信範圍</h2><p>此資料集由本站維護，未附逐筆官方出處或驗證紀錄，並非官方完整資料庫。本站不聲稱涵蓋最新遊戲更新；引用時請保留道具 ID、資料快照日期與頁面網址。</p></section>${sourceNote('')}`, 'AboutPage'));
  for (const [file, title, description, type] of [
    ['index.html', `瑪奇 M 攻略與道具圖鑑｜${config.siteName}`, '瑪奇 M 非官方繁體中文道具攻略：查詢素材、武器與防具，追溯製作配方，探索道具的後續用途與多層關聯。', 'WebPage'],
    ['items.html', `瑪奇 M 道具查詢｜名稱、ID、標籤與製作用途｜${config.siteName}`, '依道具名稱、ID、說明及多選標籤搜尋瑪奇 M 道具。查看組成素材與後續製作用途，逐層展開雙向關聯樹。', 'CollectionPage']
  ]) {
    let html = fs.readFileSync(path.join(root, file), 'utf8');
    html = html.replace(/^[ \t]*<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->\s*/gm, '').replace(/<title>[\s\S]*?<\/title>\s*/g, '').replace(/<meta name="description"[^>]*>\s*/g, '');
    html = html.replace('</head>', `  ${metadata(file, title, description, type)}\n</head>`);
    html = html.replace(/<!-- REFERENCE:START -->[\s\S]*?<!-- REFERENCE:END -->\s*/g, '');
    const section = `<section class="reference-intro"><h2>瑪奇 M 道具與製作指南</h2><p>本站收錄 ${index.items.size} 件道具與 ${index.tags.size} 種標籤，可依名稱、ID 或說明搜尋。多選標籤採 AND 交集；道具明細分別顯示製作所需素材與可製作的後續成品。</p><p><a href="catalog.html">瀏覽完整道具目錄</a> · <a href="about.html">資料來源與整理方式</a> · <a href="item/item-0002.html">鐵錠的素材與用途</a></p><noscript><p>互動搜尋需要 JavaScript；您仍可透過完整道具目錄閱讀每件道具的靜態資料頁。</p></noscript></section>`;
    html = html.replace('</main>', `<!-- REFERENCE:START -->${section}<!-- REFERENCE:END -->\n  </main>`);
    write(file, html);
  }
  const prefix = base ? new URL(base).pathname : '/';
  write('robots.txt', `# Public guide pages and assets may be crawled.\nUser-agent: *\nAllow: /\nDisallow: ${prefix}Tool/\nDisallow: ${prefix}tests/\nDisallow: ${prefix}scripts/\n${base ? `\nSitemap: ${absolute('sitemap.xml')}\n` : '# Set siteUrl in seo.config.json and regenerate before publishing.\n'}`);
  if (base) write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${filenames.map(file => `  <url><loc>${escape(absolute(file))}</loc></url>`).join('\n')}\n</urlset>\n`);
  const ref = file => absolute(file) || file;
  write('llms.txt', `# ${config.siteName}\n\n> 瑪奇 M 非官方繁體中文道具指南。素材和用途由同一份資料集產生，並非官方或保證最新的配方清單。\n\n## 主要內容\n- [道具目錄](${ref('catalog.html')}): 每件道具的固定 HTML 連結。\n- [搜尋工具](${ref('items.html')}): 名稱、ID、說明與多標籤交集搜尋。\n- [來源與限制](${ref('about.html')}): 資料整理方法與引用範圍。\n- [原始資料](${ref('Data/mabim-workshop.json')}): ${index.items.size} 件道具、${index.tags.size} 個標籤。\n\n## 資料解讀\ncomponents 是素材 ID；用途是反向引用，未提供數量、取得地點或逐筆官方出處。空陣列僅表示尚未記錄。${date ? `資料匯出時間為 ${date}，不代表遊戲更新時間。` : ''}\n`);
  return { pages: filenames.length, configured: Boolean(base) };
}
if (require.main === module) {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'seo.config.json'), 'utf8'));
  if (process.env.SITE_URL) config.siteUrl = process.env.SITE_URL;
  const result = generate(root, config);
  console.log(`Generated ${result.pages} HTML pages. ${result.configured ? 'Canonical URLs and sitemap ready.' : 'Set seo.config.json siteUrl to generate canonical URLs and sitemap.xml.'}`);
}
module.exports = { generate, normalizeUrl };
