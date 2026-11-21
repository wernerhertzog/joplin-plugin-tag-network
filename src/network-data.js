'use strict';

async function getAll(data, path, fields) {
  const items = [];
  let page = 1;
  let result;
  do {
    result = await data.get(path, { fields, limit: 100, page: page++ });
    items.push(...result.items);
  } while (result.has_more);
  return items;
}

// Count each note once for each tag and each unordered pair, even if an API
// response happens to contain duplicates. Include tags with no notes.
function buildNetwork(tags, notesByTag) {
  const noteTags = new Map();
  const nodes = tags.map((tag, i) => {
    const notes = new Set(notesByTag[i]);
    for (const noteId of notes) {
      if (!noteTags.has(noteId)) noteTags.set(noteId, []);
      noteTags.get(noteId).push(tag.id);
    }
    return { id: tag.id, title: tag.title, count: notes.size };
  });
  const pairs = new Map();
  for (const ids of noteTags.values()) {
    ids.sort();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const key = JSON.stringify([ids[i], ids[j]]);
      pairs.set(key, (pairs.get(key) || 0) + 1);
    }
  }
  const edges = Array.from(pairs, ([key, count]) => {
    const [source, target] = JSON.parse(key);
    return { source, target, count };
  });
  return { nodes, edges };
}

async function loadNetwork(data, progress = () => {}) {
  const tags = await getAll(data, ['tags'], ['id', 'title']);
  const notesByTag = new Array(tags.length);
  let next = 0;
  let done = 0;
  progress(done, tags.length);
  async function worker() {
    while (next < tags.length) {
      const index = next++;
      const notes = await getAll(data, ['tags', tags[index].id, 'notes'], ['id']);
      notesByTag[index] = notes.map(note => note.id);
      progress(++done, tags.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, tags.length) }, worker));
  return buildNetwork(tags, notesByTag);
}
module.exports = { getAll, buildNetwork, loadNetwork };
