(function (root) {
  'use strict';
  function createIndex(data) {
    if (!data || !Array.isArray(data.items) || !Array.isArray(data.tags)) throw new Error('資料格式不正確');
    const items = new Map(), tags = new Map(), uses = new Map();
    for (const tag of data.tags) {
      if (!tag || typeof tag.id !== 'string' || typeof tag.name !== 'string' || tags.has(tag.id)) throw new Error('標籤格式不正確');
      tags.set(tag.id, tag);
    }
    for (const item of data.items) {
      if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || items.has(item.id) || (item.description != null && typeof item.description !== 'string') || (item.tags != null && !Array.isArray(item.tags)) || (item.components != null && !Array.isArray(item.components))) throw new Error('道具格式不正確');
      items.set(item.id, { ...item, description: item.description || '', tags: [...new Set(item.tags || [])], components: [...new Set(item.components || [])] });
      uses.set(item.id, []);
    }
    for (const item of items.values()) {
      for (const id of item.tags) if (!tags.has(id)) throw new Error('道具引用了不存在的標籤');
      for (const id of item.components) {
        if (!items.has(id)) throw new Error('道具引用了不存在的素材');
        uses.get(id).push(item.id);
      }
    }
    return { items, tags, uses };
  }
  function search(index, query = '', selected = [], sort = 'id') {
    const needle = query.trim().toLocaleLowerCase();
    return [...index.items.values()].filter(item =>
      (!needle || [item.name, item.id, item.description].some(value => value.toLocaleLowerCase().includes(needle))) &&
      selected.every(tag => item.tags.includes(tag))
    ).sort((a, b) => a[sort === 'name' ? 'name' : 'id'].localeCompare(b[sort === 'name' ? 'name' : 'id'], 'zh-Hant', { numeric: true }));
  }
  function branch(index, id, direction, ancestors = []) {
    const cycle = ancestors.includes(id);
    return { item: index.items.get(id), cycle, children: cycle ? [] : (direction === 'uses' ? index.uses.get(id) : index.items.get(id)?.components) || [], path: [...ancestors, id] };
  }
  const api = { createIndex, search, branch };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GuideData = api;
})(globalThis);
