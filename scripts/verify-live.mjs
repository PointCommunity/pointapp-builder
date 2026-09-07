const origin = process.env.POINTAPP_BUILDER_ORIGIN ?? 'https://appbuilder.pointatx.org';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchChecked(path, expectedStatus = 200) {
  const url = new URL(path, origin);
  const response = await fetch(url, { redirect: 'follow' });
  assert(response.status === expectedStatus, `${url} returned ${response.status}`);
  return response;
}

const healthResponse = await fetchChecked('/api/health');
const health = await healthResponse.json();
assert(health.ok === true, 'Health response is not healthy.');
assert(health.environment === 'production', 'Health response is not production.');
assert(health.version === '0.1.0', 'Unexpected deployed application version.');
assert(health.database === 'reachable', 'D1 binding is not reachable.');
assert(health.authentication === 'disabled', 'Authentication must remain disabled.');
assert(health.publishing === 'disabled', 'Publishing must remain disabled.');

for (const path of ['/api/drafts', '/auth/login']) {
  const response = await fetchChecked(path, 503);
  const body = await response.json();
  assert(body.code === 'FOUNDATION_LOCKED', `${path} did not fail closed.`);
}

const documentResponse = await fetchChecked('/');
const html = await documentResponse.text();
assert(html.includes('<title>PointApp Builder</title>'), 'Root document is not PointApp Builder.');

const assetPaths = [
  ...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g),
].map((match) => match[1]);
assert(assetPaths.length > 0, 'No compiled JavaScript or CSS assets were found.');

for (const assetPath of new Set(assetPaths)) {
  const response = await fetchChecked(assetPath);
  const type = response.headers.get('content-type') ?? '';
  assert(
    type.includes('javascript') || type.includes('css'),
    `${assetPath} returned an unexpected content type: ${type}`,
  );
}

process.stdout.write(
  `Verified ${origin}: production health, isolated D1, locked routes, and ${new Set(assetPaths).size} compiled assets.\n`,
);
