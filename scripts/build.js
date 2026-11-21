'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const publish = path.join(root, 'publish');
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(publish, { recursive: true });
const data = fs.readFileSync(path.join(root, 'src/network-data.js'), 'utf8').replace('module.exports = { getAll, buildNetwork, loadNetwork };', '');
const main = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8').replace("const { loadNetwork } = require('./network-data');", '');
fs.writeFileSync(path.join(dist, 'index.js'), `${data}\n${main}`);
for (const file of ['network.css', 'layout.js', 'webview.js', 'manifest.json']) fs.copyFileSync(path.join(root, 'src', file), path.join(dist, file));
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json')));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
if (manifest.version !== pkg.version) throw new Error('Plugin and package versions differ');
const archive = path.join(publish, 'tag-network.jpl');
fs.rmSync(archive, { force: true });
execFileSync('tar', ['-cf', archive, 'index.js', 'network.css', 'layout.js', 'webview.js', 'manifest.json'], { cwd: dist, env: { ...process.env, COPYFILE_DISABLE: '1' } });
const digest = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
let commit = '';
try {
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  commit = `${branch === 'HEAD' ? 'main' : branch}:${sha}`;
} catch { /* A local build can be made before Git is initialized. */ }
fs.writeFileSync(path.join(publish, 'tag-network.json'), `${JSON.stringify({ ...manifest, _publish_hash: `sha256:${digest}`, _publish_commit: commit }, null, 2)}\n`);
console.log(`Built ${archive} and release metadata`);
