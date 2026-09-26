'use strict';
const $ = id => document.getElementById(id);
const state = { index: null, query: '', selected: [], sort: 'id', page: 1, detail: null, trail: [] };
const PAGE_SIZE = 24;
const isItemsPage = Boolean($('items-view'));
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function button(text, className, action) {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function route() {
  if (!isItemsPage) {
    // Keep previously shared single-page search links working.
    if (location.hash === '#items' || location.hash.startsWith('#items?')) {
      location.replace('items.html' + location.hash.slice('#items'.length));
    }
    return;
  }
  const params = new URLSearchParams(location.search);
  if ($('detail-dialog').open) $('detail-dialog').close();
  state.query = params.get('q') || '';
  state.selected = [...new Set(params.getAll('tag'))].filter(id => state.index?.tags.has(id));
  state.page = 1;
  $('query').value = state.query;
  if (state.index) { renderTags(); renderResults(); }
}
function syncUrl() {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  state.selected.forEach(id => params.append('tag', id));
  const url = new URL(location.href);
  url.search = params.toString();
  url.hash = '';
  history.replaceState(null, '', url.href);
}
function renderTags() {
  const list = $('tag-list');
  list.replaceChildren();
  const needle = $('tag-search').value.trim().toLocaleLowerCase();
  for (const tag of state.index.tags.values()) {
    if (!tag.name.toLocaleLowerCase().includes(needle)) continue;
    const label = el('label', 'tag-option');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = state.selected.includes(tag.id);
    checkbox.addEventListener('change', () => {
      state.selected = checkbox.checked ? [...state.selected, tag.id] : state.selected.filter(id => id !== tag.id);
      state.page = 1; syncUrl(); renderResults();
    });
    label.append(checkbox, el('span', '', tag.name), el('small', '', [...state.index.items.values()].filter(item => item.tags.includes(tag.id)).length));
    list.append(label);
  }
  if (!list.children.length) list.append(el('p', '', '找不到符合的標籤'));
}
function tagBadges(item) {
  const tags = el('div', 'item-tags');
  item.tags.forEach(id => tags.append(el('span', '', state.index.tags.get(id).name)));
  return tags;
}
function renderResults() {
  const selected = $('selected-tags'); selected.replaceChildren();
  state.selected.forEach((id, position) => {
    if (position) selected.append(el('span', 'tree-note', '&'));
    selected.append(button(state.index.tags.get(id).name + ' ×', 'chip', () => {
      state.selected = state.selected.filter(tag => tag !== id); state.page = 1;
      syncUrl(); renderTags(); renderResults();
    }));
  });
  const results = GuideData.search(state.index, state.query, state.selected, state.sort);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  $('result-count').textContent = `共 ${results.length} 件道具${state.selected.length ? ' · 符合全部已選標籤' : ''}`;
  const list = $('item-list'); list.replaceChildren();
  for (const item of results.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE)) {
    const card = button('', 'item-card', () => openDetail(item.id));
    card.setAttribute('aria-label', `查看${item.name}的明細`);
    card.append(el('span', 'item-id', item.id), el('h3', '', item.name), el('p', '', item.description || '尚無道具說明'), tagBadges(item));
    const foot = el('span', 'item-foot');
    foot.append(el('span', '', `${item.components.length} 種素材 · ${state.index.uses.get(item.id).length} 種直接用途`), el('span', '', '↗'));
    card.append(foot); list.append(card);
  }
  if (!results.length) {
    const empty = el('div', 'empty');
    empty.append(el('h3', '', '沒有找到符合的道具'), el('p', '', '試試其他關鍵字，或減少標籤條件。'), button('清除所有條件', 'button', () => {
      state.query = ''; state.selected = []; $('query').value = ''; $('tag-search').value = '';
      syncUrl(); renderTags(); renderResults();
    })); list.append(empty);
  }
  const pagination = $('pagination'); pagination.replaceChildren();
  if (results.length > PAGE_SIZE) {
    const change = offset => { state.page += offset; renderResults(); $('search-form').scrollIntoView({ block: 'start' }); };
    const prev = button('← 上一頁', '', () => change(-1)); prev.disabled = state.page === 1;
    const next = button('下一頁 →', '', () => change(1)); next.disabled = state.page === pages;
    pagination.append(prev, el('span', '', `${state.page} / ${pages}`), next);
  }
}
function treeNode(id, direction, ancestors) {
  const branch = GuideData.branch(state.index, id, direction, ancestors);
  const node = el('div', 'tree-node');
  if (branch.cycle) {
    node.append(el('small', '', `${branch.item.name} · 循環引用，停止展開`));
    return node;
  }
  if (!branch.children.length) {
    node.append(button(branch.item.name, 'node-link', () => openDetail(id, true)), el('small', '', direction === 'uses' ? '尚無後續用途紀錄' : '無組成素材紀錄'));
    return node;
  }
  const details = el('details');
  details.append(el('summary', '', `${branch.item.name} · ${branch.children.length} 種${direction === 'uses' ? '用途' : '素材'}`));
  let loaded = false;
  details.addEventListener('toggle', () => {
    if (!details.open || loaded) return;
    loaded = true;
    details.append(button('查看 ' + branch.item.name + ' 明細 ↗', 'node-link', () => openDetail(id, true)));
    const children = el('div', 'tree-children');
    branch.children.forEach(child => children.append(treeNode(child, direction, branch.path)));
    details.append(children);
  });
  node.append(details);
  return node;
}
function openDetail(id, nested = false, returning = false) {
  const item = state.index.items.get(id);
  if (!item) return;
  if (nested && state.detail) state.trail.push(state.detail);
  else if (!nested && !returning) state.trail = [];
  state.detail = id;
  const content = $('detail-content'); content.replaceChildren();
  if (state.trail.length) content.append(button('← 返回上一個道具', 'text-button detail-back', () => {
    const previous = state.trail.pop();
    openDetail(previous, false, true);
  }));
  const heading = el('div', 'detail-header');
  const title = el('h2', '', item.name); title.id = 'detail-title'; title.tabIndex = -1;
  heading.append(el('span', 'item-id', item.id), title, tagBadges(item), el('p', 'detail-description', item.description || '此道具尚無說明。'));
  content.append(heading);
  const columns = el('div', 'tree-columns');
  for (const direction of ['components', 'uses']) {
    const section = el('section', 'tree-section');
    section.append(el('h3', '', direction === 'uses' ? '可以製作什麼？' : '由哪些素材製成？'), el('p', '', direction === 'uses' ? '往下追蹤每一層成品，探索素材的後續用途。' : '展開配方，逐層查看製作所需的素材。'), el('div', 'tree-root', item.name));
    const branch = GuideData.branch(state.index, id, direction);
    const children = el('div', 'tree-children');
    branch.children.forEach(child => children.append(treeNode(child, direction, branch.path)));
    if (!branch.children.length) children.append(el('p', 'tree-note', direction === 'uses' ? '目前資料沒有記錄此道具的後續用途。' : '目前資料沒有記錄此道具的組成素材。'));
    section.append(children); columns.append(section);
  }
  content.append(columns, el('p', 'tree-note', '點擊箭頭展開下一層；點擊道具連結查看明細。資料未提供素材數量，僅顯示組成關係。'));
  const dialog = $('detail-dialog');
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  title.focus({ preventScroll: true });
}
function setData(data) {
  state.index = GuideData.createIndex(data);
  const stats = $('stats');
  if (stats) {
    stats.replaceChildren();
    const recipes = [...state.index.items.values()].filter(item => item.components.length).length;
    for (const [count, label] of [[state.index.items.size, '件收錄道具'], [state.index.tags.size, '種分類標籤'], [recipes, '筆製作關聯']]) {
      const entry = el('span'); entry.append(el('strong', '', count), document.createTextNode(label)); stats.append(entry);
    }
  }
  $('load-status').hidden = true; route();
}
function showLoadError() {
  const status = $('load-status'); status.hidden = false; status.replaceChildren();
  status.append(el('strong', '', '無法載入道具資料'), el('p', '', location.protocol === 'file:' ? '直接開啟 HTML 時，瀏覽器可能阻擋讀取 JSON。請選取專案內 Data/mabim-workshop.json，或使用靜態網站伺服器開啟。' : '請確認 Data/mabim-workshop.json 存在且格式正確，再重新載入；也可以手動選取資料檔。'));
  status.append(button('重新載入', 'button', loadData));
  const label = el('label', '', '選取道具 JSON ');
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    if (!input.files[0]) return;
    try { setData(JSON.parse(await input.files[0].text())); }
    catch { showLoadError(); $('load-status').append(el('p', '', '選取的檔案無法解析或資料不完整，請重新選取。')); }
  });
  label.append(input); status.append(label);
  if ($('stats')) $('stats').textContent = '道具資料尚未載入';
  if ($('result-count')) $('result-count').textContent = '請先載入道具資料';
}
async function loadData() {
  try {
    const response = await fetch('Data/mabim-workshop.json');
    if (!response.ok) throw new Error('載入失敗');
    setData(await response.json());
  } catch { showLoadError(); }
}
if (isItemsPage) {
  $('search-form').addEventListener('submit', event => {
    event.preventDefault(); state.query = $('query').value.trim(); state.page = 1; syncUrl();
    if (state.index) renderResults();
  });
  $('query').addEventListener('input', () => {
    state.query = $('query').value.trim(); state.page = 1; syncUrl();
    if (state.index) renderResults();
  });
  $('tag-search').addEventListener('input', () => { if (state.index) renderTags(); });
  $('clear-tags').addEventListener('click', () => {
    state.selected = []; state.page = 1; syncUrl();
    if (state.index) { renderTags(); renderResults(); }
  });
  $('sort').addEventListener('change', () => { state.sort = $('sort').value; state.page = 1; if (state.index) renderResults(); });
  $('close-detail').addEventListener('click', () => $('detail-dialog').close());
  $('detail-dialog').addEventListener('click', event => {
    const bounds = $('detail-dialog').getBoundingClientRect();
    if (event.target === $('detail-dialog') && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) $('detail-dialog').close();
  });
}
window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);
route(); loadData();
