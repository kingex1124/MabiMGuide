const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, empty, assertUniqueNames } = require('../data.js');
const sample = require('../sample-data.json');
test('duplicate names report every group and ID across both record types', () => {
  assert.throws(() => assertUniqueNames({
    tags: [{ id: 't1', name: '素材' }, { id: 't2', name: ' 素材 ' }],
    items: [{ id: 'i1', name: '木材' }, { id: 'i2', name: '木材' }, { id: 'i3', name: '鐵' }, { id: 'i4', name: '鐵' }]
  }), error => ['Tag「素材」：t1、t2', '道具「木材」：i1、i2', '道具「鐵」：i3、i4'].every(message => error.message.includes(message)));
});
test('name checks allow separate types, distinct case, and unchanged single records', () => {
  assert.doesNotThrow(() => assertUniqueNames({ tags: [{ id: 't1', name: '素材' }], items: [{ id: 'i1', name: '素材' }, { id: 'i2', name: 'Wood' }, { id: 'i3', name: 'wood' }] }));
  assert.doesNotThrow(() => assertUniqueNames(empty()));
});
test('sample and JSON round trip preserve all records', () => {
  const data = validate(sample);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(data))), data);
  assert.equal(data.items[2].components.length, 2);
  assert.deepEqual(validate(empty()), empty());
});
test('optional fields, numeric IDs, and duplicate references normalize', () => {
  const data = validate({ tags: [{ id: 1, name: '素材' }], items: [{ id: 2, name: '木', tags: [1, '1'] }, { id: 3, name: '柄', components: [2] }] });
  assert.deepEqual(data.items[0], { id: '2', name: '木', description: '', tags: ['1'], components: [] });
  assert.deepEqual(data.items[1].components, ['2']);
});
test('invalid shapes and fields are rejected', () => {
  for (const value of [null, [], {}, { version: 2, tags: [], items: [] }, { tags: {}, items: [] }]) assert.throws(() => validate(value));
  for (const row of [null, [], { id: '', name: 'x' }, { id: ' x', name: 'x' }, { id: 'x', name: ' ' }, { id: 'x', name: 'x', description: 7 }, { id: 'x', name: 'x', tags: 'a' }, { id: 'x', name: 'x', components: [null] }]) assert.throws(() => validate({ tags: [], items: [row] }));
});
test('duplicate IDs including numeric collisions are rejected', () => {
  assert.throws(() => validate({ tags: [], items: [{ id: 1, name: 'a' }, { id: '1', name: 'b' }] }), /重複/);
  assert.throws(() => validate({ tags: [{ id: 'a', name: 'a' }, { id: 'a', name: 'b' }], items: [] }), /重複/);
});
test('missing tag or component references are rejected', () => {
  for (const key of ['tags', 'components']) assert.throws(() => validate({ tags: [], items: [{ id: 'a', name: 'a', [key]: ['missing'] }] }), /不存在/);
});
test('self references and indirect cycles are rejected', () => {
  assert.throws(() => validate({ tags: [], items: [{ id: 'a', name: 'a', components: ['a'] }] }), /循環/);
  assert.throws(() => validate({ tags: [], items: [{ id: 'a', name: 'a', components: ['b'] }, { id: 'b', name: 'b', components: ['c'] }, { id: 'c', name: 'c', components: ['a'] }] }), /循環/);
});
test('shared materials and deep recipes are allowed without recursion limits', () => {
  const items = Array.from({ length: 12000 }, (_, n) => ({ id: String(n), name: `item ${n}`, components: n ? [String(n - 1)] : [] }));
  items.push({ id: 'shared', name: 'shared', components: ['0', '1'] });
  assert.equal(validate({ tags: [], items }).items.length, 12001);
});
test('validation never mutates original data and keeps special IDs safe', () => {
  const input = { tags: [{ id: '__proto__', name: '<img onerror=alert(1)>' }], items: [{ id: 'constructor', name: 'x', tags: ['__proto__'] }] };
  const original = JSON.stringify(input);
  assert.equal(validate(input).tags[0].name, '<img onerror=alert(1)>');
  assert.equal(JSON.stringify(input), original);
});
