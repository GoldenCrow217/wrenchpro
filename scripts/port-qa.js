const assert = require('assert/strict');
const net = require('net');
const { findFreePort, IPV4_HOST } = require('../electron/find-free-port');

function listen(port, host = IPV4_HOST) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen({ port, host, exclusive: true }, () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function availablePort(host = IPV4_HOST) {
  const server = await listen(0, host);
  const port = server.address().port;
  await close(server);
  return port;
}

async function consecutivePorts(count) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const start = await availablePort();
    if (start + count > 65535) continue;
    const servers = [];
    try {
      for (let offset = 0; offset < count; offset += 1) servers.push(await listen(start + offset));
      return { start, servers };
    } catch {
      await Promise.all(servers.map(close));
    }
  }
  throw new Error(`Could not reserve ${count} consecutive IPv4 ports for testing`);
}

(async () => {
  const defaultFree = await availablePort();
  assert.equal(await findFreePort(defaultFree, defaultFree), defaultFree, 'free default port was not selected');

  const one = await consecutivePorts(1);
  try {
    assert.equal(await findFreePort(one.start, one.start + 1), one.start + 1, 'occupied IPv4 port was not skipped');
  } finally {
    await Promise.all(one.servers.map(close));
  }

  const many = await consecutivePorts(3);
  try {
    assert.equal(await findFreePort(many.start, many.start + 3), many.start + 3, 'consecutive occupied ports were not skipped');
  } finally {
    await Promise.all(many.servers.map(close));
  }

  const ipv6Port = await availablePort('::1');
  const ipv6Only = await listen(ipv6Port, '::1');
  try {
    assert.equal(await findFreePort(ipv6Port, ipv6Port), ipv6Port, 'IPv6-only listener incorrectly blocked IPv4');
  } finally {
    await close(ipv6Only);
  }

  const selected = await availablePort();
  assert.equal(await findFreePort(selected, selected), selected, 'probe did not select the available port');
  const rebound = await listen(selected);
  await close(rebound);

  const exhausted = await consecutivePorts(1);
  try {
    await assert.rejects(
      findFreePort(exhausted.start, exhausted.start),
      error => /No usable IPv4 port available on 127\.0\.0\.1/.test(error.message),
      'range exhaustion did not produce a clear error'
    );
  } finally {
    await Promise.all(exhausted.servers.map(close));
  }

  console.log('IPv4 port detection QA passed');
})().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
