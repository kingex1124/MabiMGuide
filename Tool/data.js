(function (root) {
  'use strict';
  function assertUniqueNames(input) {
    const duplicates = [];
    for (const [key, label] of [['tags', 'Tag'], ['items', '道具']]) {
      const groups = new Map();
      for (const row of input[key] || []) {
        const name = row.name.trim();
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(row.id);
      }
      for (const [name, ids] of groups) {
        if (ids.length > 1) duplicates.push(`${label}「${name}」：${ids.join('、')}`);
      }
    }
    if (duplicates.length) throw new Error(`發現重複名稱，請修改後再試：\n${duplicates.join('\n')}`);
  }
  function generateId(kind, rows) {
    const prefix = kind === 'tags' ? 'tag' : 'item';
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);
    let maximum = 0n;
    for (const row of rows) {
      const match = String(row.id).match(pattern);
      if (match) {
        const number = BigInt(match[1]);
        if (number > maximum) maximum = number;
      }
    }
    return `${prefix}-${String(maximum + 1n).padStart(4, '0')}`;
  }
  function validate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('JSON 最外層必須是物件。');
    if (input.version !== undefined && input.version !== 1) throw new Error('不支援此資料版本。');
    if (!Array.isArray(input.tags) || !Array.isArray(input.items)) throw new Error('JSON 必須包含 tags 與 items 陣列。');
    const normalize = (rows, kind) => {
      const ids = new Set();
      return rows.map((row, index) => {
        const label = `${kind} 第 ${index + 1} 筆`;
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${label} 格式錯誤。`);
        const id = typeof row.id === 'number' && Number.isFinite(row.id) ? String(row.id) : row.id;
        if (typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 100) throw new Error(`${label} 的 ID 必須是 1–100 字元，且前後不可有空白。`);
        if (ids.has(id)) throw new Error(`${kind} ID「${id}」重複。`);
        ids.add(id);
        if (typeof row.name !== 'string' || !row.name.trim() || row.name.trim().length > 200) throw new Error(`${label} 的名稱必須是 1–200 字元。`);
        if (row.description !== undefined && (typeof row.description !== 'string' || row.description.length > 10000)) throw new Error(`${label} 的說明必須是文字，最多 10000 字元。`);
        const clean = { id, name: row.name.trim(), description: row.description || '' };
        if (kind === '道具') {
          for (const key of ['tags', 'components']) {
            if (row[key] !== undefined && !Array.isArray(row[key])) throw new Error(`道具「${id}」的 ${key} 必須是陣列。`);
            clean[key] = (row[key] || []).map(value => {
              if (typeof value === 'number' && Number.isFinite(value)) return String(value);
              if (typeof value !== 'string' || !value.trim()) throw new Error(`道具「${id}」含有無效引用。`);
              return value;
            });
            clean[key] = [...new Set(clean[key])];
          }
        }
        return clean;
      });
    };
    const tags = normalize(input.tags, 'Tag');
    const items = normalize(input.items, '道具');
    const tagIds = new Set(tags.map(t => t.id));
    const byId = new Map(items.map(i => [i.id, i]));
    for (const item of items) {
      for (const id of item.tags) if (!tagIds.has(id)) throw new Error(`道具「${item.id}」引用不存在的 Tag「${id}」。`);
      for (const id of item.components) if (!byId.has(id)) throw new Error(`道具「${item.id}」引用不存在的組成道具「${id}」。`);
    }
    // Kahn's algorithm avoids call-stack limits on deeply nested recipes.
    const degree = new Map(items.map(i => [i.id, 0]));
    for (const item of items) for (const id of item.components) degree.set(id, degree.get(id) + 1);
    const queue = items.filter(i => degree.get(i.id) === 0).map(i => i.id);
    for (let n = 0; n < queue.length; n++) for (const id of byId.get(queue[n]).components) {
      degree.set(id, degree.get(id) - 1);
      if (degree.get(id) === 0) queue.push(id);
    }
    if (queue.length !== items.length) throw new Error('道具組成不可引用自己或形成循環。');
    return { version: 1, tags, items };
  }
  const api = { validate, generateId, assertUniqueNames, empty: () => ({ version: 1, tags: [], items: [] }) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorkshopData = api;
})(globalThis);
