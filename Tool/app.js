(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'mabim-workshop-v1';
  let data = WorkshopData.empty();
  let view = 'items';
  let editing = null;
  let batchMode = false;
  let batchRows = [];
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
    $('add-button-batch').textContent = `複數新增${label}`;
    $('add-bottom-button-batch').textContent = `複數新增${label}`;
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
        renderSummary();
      });
      label.append(checkbox, element('span', '', row.name), element('small', '', row.id));
      target.append(label);
    }
  }
  function renderSummary() {
    $('preview-name').textContent = $('record-name').value.trim() || '尚未填寫名稱';
    $('preview-description').textContent = $('record-description').value.trim() || '尚無說明';
    $('selection-summary').hidden = view !== 'items';
    $('tag-preview-note').hidden = view === 'items';
    for (const [kind, rows, selection] of [['tag', data.tags, selectedTags], ['component', data.items, selectedComponents]]) {
      const target = $(kind === 'tag' ? 'summary-tags' : 'summary-components');
      $(`summary-${kind}-count`).textContent = `${selection.size} 個`;
      target.replaceChildren();
      if (!selection.size) target.append(element('p', 'muted', kind === 'tag' ? '尚未選擇 Tag' : '尚未選擇組成素材'));
      for (const row of rows.filter(r => selection.has(r.id))) {
        const entry = element('div', 'summary-entry');
        const name = element('span', '', row.name);
        name.append(element('small', '', row.id));
        const remove = action('×', 'icon-button', () => {
          selection.delete(row.id);
          $('selected-tag-count').textContent = `${selectedTags.size} 個已選`;
          renderOptions(kind);
          renderSummary();
          $(kind === 'tag' ? 'summary-tags' : 'summary-components').focus();
        });
        remove.setAttribute('aria-label', `移除${kind === 'tag' ? ' Tag' : '組成素材'}：${row.name}`);
        entry.append(name, remove);
        target.append(entry);
      }
      target.tabIndex = -1;
    }
    for (const entry of batchRows) entry.renderPreview();
  }
  function addBatchRow() {
    const entry = {
      id: WorkshopData.generateId(view, [...data[view], { id: $('record-id').value }, ...batchRows]),
      components: new Set()
    };
    const card = element('section', 'batch-card');
    const heading = element('div', 'batch-heading');
    heading.append(element('h3', '', `新增${view === 'items' ? '道具' : ' Tag'} · ${entry.id}`), action('移除此筆', 'text-button danger', () => {
      batchRows = batchRows.filter(row => row !== entry);
      card.remove();
      $('batch-add').focus();
    }));
    const basics = element('div', 'editor-basics');
    const nameLabel = element('label', '', '名稱 *');
    entry.nameInput = element('input');
    entry.nameInput.required = true;
    entry.nameInput.maxLength = 200;
    entry.nameInput.placeholder = '輸入名稱';
    nameLabel.append(entry.nameInput);
    const descriptionLabel = element('label', '', '說明');
    entry.descriptionInput = element('textarea');
    entry.descriptionInput.maxLength = 10000;
    entry.descriptionInput.rows = 3;
    entry.descriptionInput.placeholder = '記錄用途、取得方式或其他備註…';
    descriptionLabel.append(entry.descriptionInput);
    basics.append(nameLabel, descriptionLabel);
    if (view === 'tags') {
      const preview = element('aside', 'editor-summary batch-preview');
      preview.setAttribute('aria-label', `${entry.id} 內容預覽`);
      const name = element('h4', 'batch-preview-name');
      const description = element('p', 'description batch-preview-description');
      preview.append(element('h3', 'editor-section-title', '內容預覽'), name, description);
      entry.renderPreview = () => {
        name.textContent = entry.nameInput.value.trim() || '尚未填寫名稱';
        description.textContent = entry.descriptionInput.value.trim() || '尚無說明';
      };
      for (const input of [entry.nameInput, entry.descriptionInput]) input.addEventListener('input', entry.renderPreview);
      const fields = element('div', 'batch-grid batch-tag-grid');
      fields.append(basics, preview);
      card.append(heading, fields);
      batchRows.push(entry);
      $('batch-rows').append(card);
      entry.renderPreview();
      entry.nameInput.focus();
      return;
    }
    basics.append(element('small', '', 'Tag 與第一筆相同，儲存時一併套用。'));
    const picker = element('div', 'batch-components');
    const searchLabel = element('label', 'field-label', '組成內容（選填，可複選）');
    const search = element('input');
    search.type = 'search';
    search.placeholder = '搜尋組成道具名稱或 ID…';
    search.setAttribute('aria-label', `${entry.id} 搜尋組成道具`);
    search.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
    const options = element('div', 'options');
    const count = element('small', '', '已選 0 個組成素材');
    const drawOptions = () => {
      const query = search.value.trim().toLocaleLowerCase();
      options.replaceChildren();
      const choices = data.items.filter(row => [row.id, row.name].some(value => value.toLocaleLowerCase().includes(query)));
      if (!choices.length) options.append(element('p', 'muted', '沒有符合的現有道具；組成內容可留空。'));
      for (const row of choices) {
        const label = element('label', 'option');
        const checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.checked = entry.components.has(row.id);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) entry.components.add(row.id); else entry.components.delete(row.id);
          count.textContent = `已選 ${entry.components.size} 個組成素材`;
          entry.renderPreview();
        });
        label.append(checkbox, element('span', '', row.name), element('small', '', row.id));
        options.append(label);
      }
    };
    search.addEventListener('input', drawOptions);
    picker.append(searchLabel, search, options, count);
    const preview = element('aside', 'editor-summary batch-preview');
    preview.setAttribute('aria-label', `${entry.id} 內容預覽`);
    const previewName = element('h4', 'batch-preview-name');
    const previewDescription = element('p', 'description batch-preview-description');
    const tagHeading = element('div', 'field-label');
    const tagList = element('div', 'summary-list');
    const componentHeading = element('div', 'field-label');
    const componentList = element('div', 'summary-list');
    componentList.tabIndex = -1;
    preview.append(element('h3', 'editor-section-title', '內容預覽'), previewName, previewDescription,
      tagHeading, tagList, element('small', '', 'Tag 與第一筆同步，請於第一筆調整。'),
      componentHeading, componentList, element('small', '', '搜尋不會清除已選內容，點選 × 可移除素材。'));
    entry.renderPreview = () => {
      previewName.textContent = entry.nameInput.value.trim() || '尚未填寫名稱';
      previewDescription.textContent = entry.descriptionInput.value.trim() || '尚無說明';
      tagHeading.replaceChildren(document.createTextNode('已選 Tag'), element('span', 'muted', `${selectedTags.size} 個`));
      componentHeading.replaceChildren(document.createTextNode('已選組成'), element('span', 'muted', `${entry.components.size} 個`));
      for (const [rows, selection, target, removable] of [[data.tags, selectedTags, tagList, false], [data.items, entry.components, componentList, true]]) {
        target.replaceChildren();
        if (!selection.size) target.append(element('p', 'muted', removable ? '尚未選擇組成素材' : '尚未選擇 Tag'));
        for (const row of rows.filter(r => selection.has(r.id))) {
          const item = element('div', 'summary-entry');
          const name = element('span', '', row.name);
          name.append(element('small', '', row.id));
          item.append(name);
          if (removable) {
            const remove = action('×', 'icon-button', () => {
              entry.components.delete(row.id);
              count.textContent = `已選 ${entry.components.size} 個組成素材`;
              drawOptions();
              entry.renderPreview();
              componentList.focus();
            });
            remove.setAttribute('aria-label', `${entry.id} 移除組成素材：${row.name}`);
            item.append(remove);
          }
          target.append(item);
        }
      }
    };
    entry.nameInput.addEventListener('input', entry.renderPreview);
    entry.descriptionInput.addEventListener('input', entry.renderPreview);
    const fields = element('div', 'batch-grid');
    fields.append(basics, picker, preview);
    card.append(heading, fields);
    batchRows.push(entry);
    $('batch-rows').append(card);
    drawOptions();
    entry.renderPreview();
    entry.nameInput.focus();
  }
  function openEditor(row, multiple = false) {
    batchMode = multiple && !row;
    batchRows = [];
    $('batch-rows').replaceChildren();
    $('batch-fields').hidden = !batchMode;
    $('batch-fields').setAttribute('aria-label', `複數新增${view === 'items' ? '道具' : ' Tag'}`);
    $('batch-note').textContent = view === 'items'
      ? '所有道具共用第一筆的 Tag；修改第一筆 Tag 時，會同步套用至整批資料。'
      : '按下加號追加 Tag，每筆自動產生流水號；全部驗證通過後一起儲存。';
    $('batch-add').textContent = `＋ 再新增一筆${view === 'items' ? '道具' : ' Tag'}`;
    editing = row ? row.id : null;
    $('record-form').reset();
    $('editor-title').textContent = `${row ? '編輯' : '新增'}${view === 'items' ? '道具' : ' Tag'}`;
    if (batchMode) $('editor-title').textContent = `複數新增${view === 'items' ? '道具' : ' Tag'}`;
    $('record-id').value = row?.id ?? WorkshopData.generateId(view, data[view]);
    $('record-id').readOnly = true;
    $('record-name').value = row?.name || '';
    $('record-description').value = row?.description || '';
    $('item-fields').hidden = view !== 'items';
    $('editor').classList.toggle('item-editor', view === 'items');
    $('form-error').hidden = true;
    $('tag-picker').open = window.matchMedia('(min-width: 1000px)').matches;
    selectedTags = new Set(row?.tags || []);
    selectedComponents = new Set(row?.components || []);
    $('selected-tag-count').textContent = `${selectedTags.size} 個已選`;
    renderOptions('tag');
    renderOptions('component');
    renderSummary();
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
      const pending = [row, ...(batchMode ? batchRows.map(entry => ({
        id: entry.id,
        name: entry.nameInput.value.trim(),
        description: entry.descriptionInput.value.trim(),
        ...(view === 'items' ? { tags: [...selectedTags], components: [...entry.components] } : {})
      })) : [])];
      const errors = [];
      pending.forEach((record, index) => {
        try {
          WorkshopData.validate({ ...data, [view]: [...data[view].filter(r => r.id !== editing), record] });
        } catch (error) { errors.push(`第 ${index + 1} 筆（${record.id}）：${error.message}`); }
      });
      if (errors.length) throw new Error(errors.join('\n'));
      const names = new Set(pending.map(record => record.name));
      WorkshopData.assertUniqueNames({
        [view]: [...data[view].filter(r => r.id !== editing && names.has(r.name.trim())), ...pending]
      });
      const next = { ...data, [view]: editing === null ? [...data[view], ...pending] : data[view].map(r => r.id === editing ? row : r) };
      commit(next);
      $('editor').close();
      notify(batchMode ? `已儲存 ${pending.length} 筆${view === 'items' ? '道具' : ' Tag'}` : '資料已儲存');
    } catch (error) {
      $('form-error').textContent = error.message;
      $('form-error').hidden = false;
      $('form-error').scrollIntoView({ block: 'center' });
    }
  });
  for (const kind of ['items', 'tags']) $(`${kind}-tab`).addEventListener('click', () => { view = kind; $('search').value = ''; render(); });
  $('add-button').addEventListener('click', () => openEditor());
  $('add-bottom-button').addEventListener('click', () => openEditor());
  for (const id of ['add-button-batch', 'add-bottom-button-batch']) $(id).addEventListener('click', () => openEditor(null, true));
  $('batch-add').addEventListener('click', addBatchRow);
  for (const id of ['record-name', 'record-description']) $(id).addEventListener('input', renderSummary);
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
