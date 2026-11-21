'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildNetwork, getAll, loadNetwork } = require('../src/network-data');

test('counts unique notes and co-occurrences, including unused tags', () => {
  const tags = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }, { id: 'd', title: 'D' }];
  const result = buildNetwork(tags, [['1', '1', '2'], ['1', '2', '3'], ['2', '3'], []]);
  assert.deepEqual(result.nodes.map(n => n.count), [2, 3, 2, 0]);
  assert.deepEqual(result.edges, [
    { source: 'a', target: 'b', count: 2 },
    { source: 'a', target: 'c', count: 1 },
    { source: 'b', target: 'c', count: 2 },
  ]);
});

test('retrieves every page of tags and notes', async () => {
  const calls = [];
  const data = { async get(path, options) {
    calls.push([path, options.page]);
    if (path.length === 1) return options.page === 1
      ? { items: [{ id: 'a', title: 'A' }], has_more: true }
      : { items: [{ id: 'b', title: 'B' }], has_more: false };
    if (path[1] === 'a') return options.page === 1
      ? { items: [{ id: 'n1' }], has_more: true }
      : { items: [{ id: 'n2' }], has_more: false };
    return { items: [{ id: 'n2' }], has_more: false };
  }};
  const progress = [];
  const network = await loadNetwork(data, (done, total) => progress.push([done, total]));
  assert.deepEqual(network.nodes.map(n => n.count), [2, 1]);
  assert.deepEqual(network.edges, [{ source: 'a', target: 'b', count: 1 }]);
  assert.deepEqual(progress[0], [0, 2]);
  assert.deepEqual(progress.at(-1), [2, 2]);
  assert.equal(calls.length, 5);
});

test('handles an empty library', async () => {
  const data = { get: async () => ({ items: [], has_more: false }) };
  assert.deepEqual(await getAll(data, ['tags'], ['id']), []);
  assert.deepEqual(await loadNetwork(data), { nodes: [], edges: [] });
});

test('propagates failures so the UI can keep previous results', async () => {
  await assert.rejects(loadNetwork({ get: async () => { throw new Error('offline'); } }), /offline/);
});
