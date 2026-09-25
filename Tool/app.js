(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'mabim-workshop-v1';
  let data = WorkshopData.empty();
  let view = 'items';
  let editing = null;
  let selectedTags = new Set();
  let selectedComponents = new Set();
  let toastTimer;
  let storageBlocked = false;
  const warning = message => { $('storage-warning').textContent = message; $('storage-warning').hidden = false; };
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) data = WorkshopData.validate(JSON.parse(saved));
  } catch (error) {
    storageBlocked = true;
    warning(`無法載入本機資料：${error.message}。原有儲存內容不會被覆寫；目前變更請使用 JSON 匯出備份。`);
  }
  function notify(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
  }
  function commit(next) {
    data = WorkshopData.validate(next);
    try {
      if (storageBlocked) throw new Error('原有資料讀取失敗，已保護原始內容');
      localStorage.setItem(KEY, JSON.stringify(data));
      $('save-status').textContent = `● 已儲存於本機 · ${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
      $('storage-warning').hidden = true;
    } catch (error) {
      warning(`變更目前只保留在此分頁，請在關閉前匯出 JSON。${error.message}`);
      $('save-status').textContent = '尚未保存至本機，請匯出備份';
    }
    render();
  }
  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function action(text, className, callback) {
    const button = element('button', className, text);
    button.type = 'button';
    button.addEventListener('click', callback);
    return button;
  }
  function render() {
    $('item-count').textContent = data.items.length;
    $('tag-count').textContent = data.tags.length;
    $('recipe-count').textContent = data.items.filter(i => i.components.length).length;
    const filter = $('tag-filter').value;
    $('tag-filter').replaceChildren(new Option('所有 Tag', ''), ...data.tags.map(t => new Option(t.name, t.id)));
    $('tag-filter').value = data.tags.some(t => t.id === filter) ? filter : '';
    $('tag-filter').parentElement.hidden = view === 'tags';
    for (const kind of ['items', 'tags']) {
      $(`${kind}-tab`).classList.toggle('active', view === kind);
      $(`${kind}-tab`).setAttribute('aria-pressed', String(view === kind));
    }
    const label = view === 'items' ? '道具' : 'Tag';
    $('add-button').textContent = `＋ 新增${label}`;
    $('add-bottom-button').textContent = `＋ 新增${label}`;
    $('search').placeholder = `搜尋${label}名稱、ID 或說明…`;
    const query = $('search').value.trim().toLocaleLowerCase();
    const rows = data[view].filter(row => [row.id, row.name, row.description].some(s => s.toLocaleLowerCase().includes(query)) && (view !== 'items' || !$('tag-filter').value || row.tags.includes($('tag-filter').value)));
    $('result-count').textContent = `共 ${rows.length} 筆`;
    $('records').replaceChildren();
    const tagMap = new Map(data.tags.map(t => [t.id, t.name]));
    const itemMap = new Map(data.items.map(i => [i.id, i.name]));
    if (!rows.length) {
      const empty = element('div', 'empty');
      const hasData = data[view].length > 0;
      empty.append(element('div', 'empty-symbol', '▧'), element('h3', '', hasData ? '沒有符合的資料' : `從第一${view === 'items' ? '件道具' : '個 Tag'}開始`), element('p', '', hasData ? '試試其他關鍵字，或調整分類篩選。' : view === 'items' ? '先建立素材，再將素材組合成道具。也可以匯入既有的 JSON 資料。' : '用 Tag 分類素材、裝備或消耗品，讓道具更容易找到。'));
      empty.append(action(hasData ? '清除篩選' : `＋ 新增${label}`, 'button', () => {
        if (hasData) { $('search').value = ''; $('tag-filter').value = ''; render(); }
        else openEditor();
      }));
      $('records').append(empty);
    }
    for (const row of rows) {
      const card = element('article', 'card');
      const top = element('div', 'card-top');
      const heading = element('div');
      heading.append(element('h3', '', row.name), element('div', 'record-id', row.id));
      top.append(element('span', 'item-symbol', view === 'items' ? '▧' : '#'), heading);
      card.append(top, element('p', 'description', row.description || '尚無說明'));
      if (view === 'items') {
        const chips = element('div', 'chips');
        for (const id of row.tags) chips.append(element('span', 'chip', tagMap.get(id)));
        if (!row.tags.length) chips.append(element('span', 'muted', '未分類'));
        const components = element('div', 'components');
        components.append(element('strong', '', '組成內容'), document.createTextNode(row.components.length ? row.components.map(id => itemMap.get(id)).join(' ＋ ') : '無組成配方'));
        card.append(chips, components);
      } else card.append(element('div', 'components', `${data.items.filter(i => i.tags.includes(row.id)).length} 件道具使用此 Tag`));
      const actions = element('div', 'card-actions');
      actions.append(action('編輯', 'text-button', () => openEditor(row)), action('刪除', 'text-button danger', () => deleteRecord(row)));
      card.append(actions);
      $('records').append(card);
    }
  }
  function renderOptions(kind) {
    const isTag = kind === 'tag';
    const selection = isTag ? selectedTags : selectedComponents;
    const query = $(`${kind}-search`).value.trim().toLocaleLowerCase();
    const choices = (isTag ? data.tags : data.items).filter(row => (isTag || row.id !== editing) && [row.id, row.name].some(s => s.toLocaleLowerCase().includes(query)));
    const target = $(`${kind}-options`);
    target.replaceChildren();
    if (!choices.length) target.append(element('p', 'muted', query ? '找不到符合的選項。' : isTag ? '尚無 Tag，請先至 Tag 管理新增。' : '尚無其他道具，請先建立素材；此欄可留空。'));
    for (const row of choices) {
      const label = element('label', 'option');
      const checkbox = element('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selection.has(row.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selection.add(row.id); else selection.delete(row.id);
        $('selected-tag-count').textContent = `${selectedTags.size} 個已選`;
      });
      label.append(checkbox, element('span', '', row.name), element('small', '', row.id));
      target.append(label);
    }
  }
  function openEditor(row) {
    editing = row ? row.id : null;
    $('record-form').reset();
    $('editor-title').textContent = `${row ? '編輯' : '新增'}${view === 'items' ? '道具' : ' Tag'}`;
    $('record-id').value = row?.id ?? WorkshopData.generateId(view, data[view]);
    $('record-id').readOnly = true;
    $('record-name').value = row?.name || '';
    $('record-description').value = row?.description || '';
    $('item-fields').hidden = view !== 'items';
    $('form-error').hidden = true;
    $('tag-picker').open = false;
    selectedTags = new Set(row?.tags || []);
    selectedComponents = new Set(row?.components || []);
    $('selected-tag-count').textContent = `${selectedTags.size} 個已選`;
    renderOptions('tag');
    renderOptions('component');
    $('editor').showModal();
    $('record-name').focus();
  }
  function confirmAction(title, message, label) {
    $('confirm-title').textContent = title;
    $('confirm-message').textContent = message;
    $('confirm-ok').textContent = label;
    return new Promise(resolve => {
      $('confirm-dialog').returnValue = '';
      $('confirm-dialog').addEventListener('close', () => resolve($('confirm-dialog').returnValue === 'yes'), { once: true });
      $('confirm-dialog').showModal();
      $('confirm-cancel').focus();
    });
  }
  async function deleteRecord(row) {
    const kind = view;
    const field = kind === 'items' ? 'components' : 'tags';
    const uses = data.items.filter(i => i[field].includes(row.id));
    if (kind === 'items' && uses.length) {
      await confirmAction('道具仍被使用', `「${row.name}」是下列道具的組成素材：\n${uses.map(i => i.name).join('、')}\n請先編輯這些道具，移除此素材後再刪除。`, '知道了');
      return;
    }
    if (!await confirmAction('刪除資料', `確定刪除「${row.name}」？${uses.length ? `\n同時會從 ${uses.length} 件道具移除此 Tag。` : ''}\n此操作無法復原。`, '確認刪除')) return;
    const next = { ...data, [kind]: data[kind].filter(r => r.id !== row.id) };
    if (kind === 'tags') next.items = data.items.map(i => ({ ...i, tags: i.tags.filter(id => id !== row.id) }));
    commit(next);
    notify('資料已刪除');
  }
  $('record-form').addEventListener('submit', event => {
    event.preventDefault();
    const row = { id: editing ?? $('record-id').value, name: $('record-name').value.trim(), description: $('record-description').value.trim() };
    if (view === 'items') Object.assign(row, { tags: [...selectedTags], components: [...selectedComponents] });
    try {
      WorkshopData.assertUniqueNames({
        [view]: [...data[view].filter(r => r.id !== editing && r.name.trim() === row.name), row]
      });
      const next = { ...data, [view]: editing === null ? [...data[view], row] : data[view].map(r => r.id === editing ? row : r) };
      commit(next);
      $('editor').close();
      notify('資料已儲存');
    } catch (error) { $('form-error').textContent = error.message; $('form-error').hidden = false; }
  });
  for (const kind of ['items', 'tags']) $(`${kind}-tab`).addEventListener('click', () => { view = kind; $('search').value = ''; render(); });
  $('add-button').addEventListener('click', () => openEditor());
  $('add-bottom-button').addEventListener('click', () => openEditor());
  $('search').addEventListener('input', render);
  $('tag-filter').addEventListener('change', render);
  for (const kind of ['tag', 'component']) $(`${kind}-search`).addEventListener('input', () => renderOptions(kind));
  for (const id of ['close-editor', 'cancel-editor']) $(id).addEventListener('click', () => $('editor').close());
  $('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close('no'));
  $('confirm-ok').addEventListener('click', () => $('confirm-dialog').close('yes'));
  // Search fields inside the editor must not submit the record on Enter.
  for (const id of ['tag-search', 'component-search']) $(id).addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
  $('import-button').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async () => {
    const file = $('import-file').files[0];
    $('import-file').value = '';
    if (!file) return;
    $('import-button').disabled = true;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('檔案超過 10 MB，請縮小後再匯入。');
      const incoming = WorkshopData.validate(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
      try {
        WorkshopData.assertUniqueNames(incoming);
      } catch (error) {
        window.alert(`無法匯入，現有資料未變更。\n${error.message}`);
        return;
      }
      if (!await confirmAction('匯入 JSON 資料', `已檢查「${file.name}」：\n${incoming.tags.length} 個 Tag、${incoming.items.length} 件道具。\n\n將取代目前 ${data.tags.length} 個 Tag、${data.items.length} 件道具。建議先取消並匯出現有資料備份。`, '確認取代並匯入')) return;
      $('search').value = '';
      $('tag-filter').value = '';
      commit(incoming);
      notify('JSON 資料已匯入');
    } catch (error) {
      await confirmAction('無法匯入資料', `現有資料未變更。\n${error.message}`, '知道了');
    } finally { $('import-button').disabled = false; }
  });
  $('export-button').addEventListener('click', () => {
    const compareIds = new Intl.Collator('en', { numeric: true }).compare;
    const payload = {
      ...data,
      tags: [...data.tags].sort((a, b) => compareIds(a.id, b.id)),
      items: data.items.map(item => ({
        ...item,
        tags: [...item.tags].sort(compareIds),
        components: [...item.components].sort(compareIds)
      })),
      exportedAt: new Date().toISOString()
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = element('a');
    link.href = url;
    link.download = `mabim-workshop-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('已匯出 JSON');
  });
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) {
      storageBlocked = true;
      warning('其他分頁已變更本機資料。本分頁停止自動儲存以避免覆寫；請先匯出本分頁資料，再重新整理載入最新版本。');
    }
  });
  render();
})();
