import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const dir = process.argv[2];
assert(dir, 'Pass the browser output directory');
const index = readFileSync(join(dir, 'index.html'), 'utf8');
assert(index.includes('app-root'), 'Angular app-root is missing');
const config = JSON.parse(readFileSync(join(dir, 'staticwebapp.config.json'), 'utf8'));
assert.equal(config.navigationFallback?.rewrite, '/index.html');
assert.equal(config.globalHeaders?.['X-Content-Type-Options'], 'nosniff');
assert.equal(config.globalHeaders?.['X-Frame-Options'], 'DENY');
const walk = (path) =>
  readdirSync(path, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(path, e.name)) : [join(path, e.name)],
  );
const files = walk(dir);
assert(
  !files.some((f) => /\.(map|pfx|p12|pem|key)$/.test(f)),
  'Source maps or private keys must not be published',
);
const commit = process.env.GITHUB_SHA;
if (commit)
  writeFileSync(
    join(dir, 'release.json'),
    JSON.stringify({ commit, builtAt: new Date().toISOString() }),
  );
console.log('Production artifact validated; ' + files.length + ' files.');
