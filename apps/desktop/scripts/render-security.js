const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const helperMatch = source.match(/function esc\(value\)\{[\s\S]*?function safeImageSrc\(value\)\{[\s\S]*?\n\}/);
if (!helperMatch) throw new Error('Rendering security helpers were not found');
const sidebarMatch = source.match(/function updateSidebarFoot\(\)\{[\s\S]*?\n\}/);
if (!sidebarMatch) throw new Error('Sidebar identity renderer was not found');

const payloads = [
  '<b>Example</b>',
  '<img src=x onerror=alert(1)>',
  '\"><svg onload=alert(1)>',
  "O'Brien & Sons",
  '"quoted" customer',
  '<script>alert(1)</script>',
  '<img src=x onerror=window.__securityExecuted=true>',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  try {
    await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><div id="host"></div><div id="sidebar-name"></div><div id="sidebar-avatar"></div><div id="sidebar-role"></div>'));
    const results = await window.webContents.executeJavaScript(`
      ${helperMatch[0]}
      function shopContextLabel(){ return 'Local desktop mode'; }
      ${sidebarMatch[0]}
      const state={settings:{owner_name:'Jane Doe',business_name:'Example Auto'}};
      updateSidebarFoot();
      const ownerIdentity={
        name:document.getElementById('sidebar-name').textContent,
        avatar:document.getElementById('sidebar-avatar').textContent,
        role:document.getElementById('sidebar-role').textContent,
      };
      state.settings.owner_name='';
      updateSidebarFoot();
      const businessIdentity={
        name:document.getElementById('sidebar-name').textContent,
        avatar:document.getElementById('sidebar-avatar').textContent,
        role:document.getElementById('sidebar-role').textContent,
      };
      const payloads=${JSON.stringify(payloads)};
      const host=document.getElementById('host');
      window.__securityExecuted=false;
      const cases=payloads.map((payload,index)=>{
        host.innerHTML='<button data-id="'+safeId(index+1)+'"><span>'+esc(payload)+'</span></button><input value="'+attrEsc(payload)+'">';
        const displayed=host.querySelector('span').textContent;
        const edited=host.querySelector('input').value;
        const dangerous=host.querySelector('img,svg,script,[onerror],[onload]');
        const id=Number(host.querySelector('button').dataset.id);
        const encodedAgain=esc(displayed);
        return {payload,displayed,edited,dangerous:Boolean(dangerous),id,encodedAgain,encoded:esc(payload)};
      });
      let invalidIdRejected=false;
      try{safeId('1);alert(1)//')}catch{invalidIdRejected=true}
      ({cases,ownerIdentity,businessIdentity,invalidIdRejected,executed:window.__securityExecuted,unsafeUrl:safeImageSrc('javascript:alert(1)'),unsafeSvg:safeImageSrc('data:image/svg+xml,<svg onload=alert(1)>')});
    `, true);

    results.cases.forEach((result, index) => {
      assert(result.displayed === result.payload, `Text payload ${index} did not display literally`);
      assert(result.edited === result.payload, `Attribute payload ${index} did not round-trip`);
      assert(!result.dangerous, `Payload ${index} created executable markup`);
      assert(result.id === index + 1, `Stable ID ${index + 1} was not preserved`);
      assert(result.encodedAgain === result.encoded, `Payload ${index} double-escaped after edit`);
    });
    assert(results.invalidIdRejected, 'Unsafe record ID was not rejected');
    assert(!results.executed, 'A payload event handler executed');
    assert(results.unsafeUrl === '', 'javascript: URL was not rejected');
    assert(results.unsafeSvg === '', 'SVG data URL was not rejected');
    assert(JSON.stringify(results.ownerIdentity) === JSON.stringify({ name: 'Jane Doe', avatar: 'JD', role: 'Local desktop mode' }), 'Configured owner identity did not render');
    assert(JSON.stringify(results.businessIdentity) === JSON.stringify({ name: 'Example Auto', avatar: 'EA', role: 'Local desktop mode' }), 'Business identity fallback did not render');
    assert(!source.includes('${greeting}, Brandon'), 'Dashboard still contains the hardcoded sample greeting');
    assert(source.includes("String((state.settings&&state.settings.owner_name)||'')"), 'Dashboard owner-name fallback is missing');

    const requiredMarkers = [
      '${esc(j.service', '${esc(a.cust)', '${esc(c.address', '${esc(p.description',
      '${esc(l.first', '${esc(p.name)', '${safeId(a.id)}', '${attrEsc(c.tags',
      'safeImageSrc(s.invoice_logo)',
    ];
    requiredMarkers.forEach(marker => assert(source.includes(marker), `Missing protected render marker: ${marker}`));
    console.log(`Rendering security test passed: ${payloads.length} payloads`);
  } finally {
    window.destroy();
    app.quit();
  }
}).catch(error => {
  console.error(error.stack || error.message || String(error));
  app.exit(1);
});
