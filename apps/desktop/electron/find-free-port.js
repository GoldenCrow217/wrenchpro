const net = require('net');

const IPV4_HOST = '127.0.0.1';
const MAX_PORT = 65535;

function probePort(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen({ port, host, exclusive: true }, () => {
      server.removeAllListeners('error');
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function findFreePort(start = 3000, end = MAX_PORT) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > MAX_PORT || start > end) {
    throw new RangeError(`Invalid port range: ${start}-${end}`);
  }

  let lastError;
  for (let port = start; port <= end; port += 1) {
    try {
      return await probePort(port, IPV4_HOST);
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError?.code || lastError?.message || 'unknown probe error';
  throw new Error(`No usable IPv4 port available on ${IPV4_HOST} from ${start} through ${end} (${detail})`);
}

module.exports = { findFreePort, IPV4_HOST, MAX_PORT };
