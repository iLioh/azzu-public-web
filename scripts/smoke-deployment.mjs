import assert from 'node:assert/strict';
const [url, ...routes] = process.argv.slice(2);
assert(url?.startsWith('https://'), 'SWA_URL must use HTTPS');
const base = url.replace(/\/$/, '');
const get = (path) =>
  fetch(base + path, {
    signal: AbortSignal.timeout(20000),
    headers: { 'Cache-Control': 'no-cache' },
  });
const expected = process.env.GITHUB_SHA;
if (expected) {
  let release;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const response = await get('/release.json?verify=' + Date.now());
      if (response.ok) release = await response.json();
    } catch {}
    if (release?.commit === expected) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  assert.equal(release?.commit, expected, 'Published commit does not match this run');
}
for (const path of ['/', ...routes]) {
  const response = await get(path);
  assert.equal(response.status, 200, 'SPA route failed: ' + path);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  const html = await response.text();
  assert(html.includes('app-root'), 'Angular shell missing at ' + path);
  if (path === '/') {
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
    assert(assets.length > 0, 'No compiled assets in HTML');
    for (const asset of assets) {
      if (/^https?:/.test(asset)) continue;
      const result = await get('/' + asset.replace(/^\//, ''));
      assert.equal(result.status, 200, 'Missing asset: ' + asset);
      assert(
        !/text\/html/.test(result.headers.get('content-type') ?? ''),
        'Asset resolved to SPA fallback',
      );
    }
  }
}
console.log('Published release, security headers, compiled assets and SPA routes verified.');
