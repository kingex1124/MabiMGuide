const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createIndex, search, branch } = require('../guide-data.js');
const data = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../Data/mabim-workshop.json'), 'utf8'));
const index = createIndex(data);
test('完整資料建立雙向索引，鐵礦石可製作鐵錠', () => {
  assert.equal(index.items.size, 659);
  const ore = data.items.find(item => item.name === '鐵礦石');
  const ingot = data.items.find(item => item.name === '鐵錠');
  assert.ok(index.uses.get(ore.id).includes(ingot.id));
  assert.ok(index.items.get(ingot.id).components.includes(ore.id));
  assert.ok(index.uses.get(ingot.id).length > 1);
  for (const item of index.items.values()) for (const component of item.components) assert.ok(index.uses.get(component).includes(item.id));
});
test('名稱、ID、說明搜尋與標籤 AND 交集', () => {
  assert.ok(search(index, ' 鐵錠 ').some(item => item.name === '鐵錠'));
  assert.equal(search(index, 'ITEM-0002')[0].id, 'item-0002');
  const fixture = createIndex({ tags: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], items: [{ id: '1', name: 'one', description: '說明搜尋', tags: ['a', 'b'] }, { id: '2', name: 'two', tags: ['a'] }] });
  assert.deepEqual(search(fixture, '說明').map(item => item.id), ['1']);
  assert.deepEqual(search(fixture, '', ['a', 'b']).map(item => item.id), ['1']);
  assert.equal(search(fixture, '不存在').length, 0);
});
test('多層、分支、共同成品與循環保護', () => {
  const fixture = createIndex({ tags: [], items: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', components: ['a'] }, { id: 'c', name: 'C', components: ['a'] }, { id: 'd', name: 'D', components: ['b', 'c'] }] });
  assert.deepEqual(branch(fixture, 'a', 'uses').children, ['b', 'c']);
  assert.deepEqual(branch(fixture, 'b', 'uses', ['a']).children, ['d']);
  assert.equal(branch(fixture, 'd', 'uses', ['a', 'c']).cycle, false);
  assert.deepEqual(branch(fixture, 'd', 'components').children, ['b', 'c']);
  const cycle = createIndex({ tags: [], items: [{ id: 'a', name: 'A', components: ['b'] }, { id: 'b', name: 'B', components: ['a'] }] });
  assert.equal(branch(cycle, 'a', 'uses', ['a', 'b']).cycle, true);
  assert.deepEqual(branch(cycle, 'a', 'uses', ['a', 'b']).children, []);
});
test('拒絕失效引用、重複 ID 與不正確格式', () => {
  assert.throws(() => createIndex({}));
  assert.throws(() => createIndex({ tags: [], items: [{ id: 'a', name: 'A', components: ['missing'] }] }));
  assert.throws(() => createIndex({ tags: [], items: [{ id: 'a', name: 'A', tags: ['missing'] }] }));
  assert.throws(() => createIndex({ tags: [], items: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] }));
});
