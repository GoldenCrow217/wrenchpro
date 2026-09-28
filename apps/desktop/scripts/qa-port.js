// Free TCP port for QA servers, chosen by the operating system.
//
// QA scripts used to pick random ports from small fixed ranges (e.g. 6600-6899).
// Those collided between scripts and could land on ports that fetch() refuses
// outright (6665-6669 and 6697 are on the Fetch standard's "bad ports" list),
// so a server that started fine looked unreachable until the wait timed out.
// OS-assigned ephemeral ports (49152+ on Windows) avoid both problems.
const { execFileSync } = require('child_process');

const PROBE = "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close();});";

function freePortSync() {
  const port = execFileSync(process.execPath, ['-e', PROBE], { encoding: 'utf8' }).trim();
  if (!/^\d+$/.test(port)) throw new Error(`Could not obtain a free port: ${port}`);
  return port;
}

module.exports = { freePortSync };
