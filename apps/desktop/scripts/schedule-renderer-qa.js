// Schedule day view: clicking a calendar day shows that day's appointments in
// time order with open gaps, double-booking warnings, jobs, and actions.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

app.whenReady().then(async () => {
  const html=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
  const pricingSource=fs.readFileSync(path.join(__dirname,'..','server','pricing.js'),'utf8');
  const server=http.createServer((req,res)=>{if(req.url==='/'||req.url==='/index.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);}else if(req.url==='/shared/pricing.js'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(pricingSource);}else{res.writeHead(503,{'content-type':'application/json'});res.end('{"error":"Renderer QA has no API server"}');}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const window = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    await window.loadURL(`http://127.0.0.1:${server.address().port}/`);
    const results = await window.webContents.executeJavaScript(`
      (async()=>{
        window.api=async()=>{throw new Error('Renderer QA ignores unrelated startup refresh requests');};
        const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
        await tick();
        state.customers=[{id:1,first:'Test',last:'Customer'}];
        state.vehicles=[];
        state.jobs=[{id:7,date:'2026-08-14',first:'Test',last:'Customer',year:2020,make:'Ford',model:'Transit',service:'Brake service',status:'In Progress',emp_first:'Test',emp_last:'Tech'}];
        state.appts=[
          {id:3,date:'2026-08-14',time:'13:00',duration_minutes:60,cust:'Afternoon <b>Client</b>',service:'Oil change',resource_id:null},
          {id:1,date:'2026-08-14',time:'08:00',duration_minutes:60,cust:'Early Client',service:'Inspection',veh_year:2019,veh_make:'Honda',veh_model:'Civic',resource_id:null},
          {id:2,date:'2026-08-14',time:'08:30',duration_minutes:30,cust:'Overlap Client',service:'Tire rotation',resource_id:null},
          {id:4,date:'2026-08-14',time:'',duration_minutes:60,cust:'Untimed Client',resource_id:null},
        ];
        calMonth=7;calYear=2026;
        renderCalendar();
        const cell=[...document.querySelectorAll('#cal-body .cal-cell:not(.other)')].find(c=>c.querySelector('.cal-num')?.textContent==='14');
        const cellState={chips:cell?.querySelectorAll('.cal-ev').length,more:cell?.querySelector('.cal-more')?.textContent,conflictChips:cell?.querySelectorAll('.cal-ev.conflict').length,label:cell?.getAttribute('aria-label')};
        cell?.click();
        const dayOpen=document.getElementById('m-day').classList.contains('open');
        const apptFormOpenedInstead=document.getElementById('m-appt').classList.contains('open');
        const rows=[...document.querySelectorAll('#m-day-body [data-day-appointment-id]')];
        const dayState={
          order:rows.map(r=>r.dataset.dayAppointmentId),
          conflictRows:rows.filter(r=>r.classList.contains('conflict')).map(r=>r.dataset.dayAppointmentId),
          summary:document.getElementById('m-day-summary').textContent,
          gap:document.querySelector('#m-day-body .day-gap')?.textContent||'',
          body:document.getElementById('m-day-body').textContent,
          escaped:!document.querySelector('#m-day-body b'),
          title:document.getElementById('m-day-title').textContent,
        };
        [...document.querySelectorAll('#m-day button')].find(b=>b.textContent.includes('New appointment'))?.click();
        await tick();
        const newApptState={open:document.getElementById('m-appt').classList.contains('open'),date:document.getElementById('af-date').value,dayStillOpen:document.getElementById('m-day').classList.contains('open')};
        closeTopmostModal();
        const escClosedFormFirst=!document.getElementById('m-appt').classList.contains('open')&&document.getElementById('m-day').classList.contains('open');

        let deleteRequest=null;
        window.confirm=()=>true;
        window.api=async(method,endpoint)=>{
          if(method==='DELETE'&&endpoint==='/api/appointments/2'){deleteRequest=endpoint;return{success:true};}
          if(method==='GET'&&endpoint==='/api/appointments')return state.appts.filter(a=>a.id!==2);
          if(method==='GET'&&endpoint==='/api/dashboard')return{monthNetProfit:0};
          throw new Error('Renderer QA ignores unrelated requests');
        };
        await deleteAppt(2);
        while(activeMutations.has('appt-delete-2'))await tick();
        const afterDelete={request:deleteRequest,rows:document.querySelectorAll('#m-day-body [data-day-appointment-id]').length,conflicts:document.querySelectorAll('#m-day-body .day-row.conflict').length};

        shiftDayView(1);
        const nextDay={title:document.getElementById('m-day-title').textContent,empty:document.getElementById('m-day-body').textContent.includes('Nothing scheduled')};
        shiftDayView(20);
        const monthFollowed=document.getElementById('cal-title').textContent;
        closeM('m-day');
        return {cellState,dayOpen,apptFormOpenedInstead,dayState,newApptState,escClosedFormFirst,afterDelete,nextDay,monthFollowed};
      })()
    `, true);

    const r = results;
    assert(r.cellState.chips === 2 && r.cellState.more === '+3 more', `Busy calendar day did not collapse extra items into "+N more": ${JSON.stringify(r.cellState)}`);
    assert(r.cellState.conflictChips >= 1 && /4 appointments, 1 job/.test(r.cellState.label || ''), `Calendar day did not flag overlaps or describe its contents: ${JSON.stringify(r.cellState)}`);
    assert(r.dayOpen && !r.apptFormOpenedInstead, 'Clicking a calendar day did not open the day view');
    assert(JSON.stringify(r.dayState.order) === JSON.stringify(['1','2','3','4']), `Day view did not list appointments in time order with untimed last: ${JSON.stringify(r.dayState.order)}`);
    assert(JSON.stringify(r.dayState.conflictRows) === JSON.stringify(['1','2']), `Day view did not flag the double-booked appointments: ${JSON.stringify(r.dayState.conflictRows)}`);
    assert(r.dayState.summary.includes('4 appointments') && r.dayState.summary.includes('1 job') && r.dayState.summary.includes('8:00 AM – 2:00 PM') && r.dayState.summary.includes('2 overlapping'), `Day summary is wrong: ${r.dayState.summary}`);
    assert(r.dayState.gap.includes('9:00 AM – 1:00 PM') && r.dayState.gap.includes('4 hrs'), `Day view did not show the open gap: ${r.dayState.gap}`);
    assert(r.dayState.body.includes('2019 Honda Civic') && r.dayState.body.includes('Brake service') && r.dayState.body.includes('Overlaps with'), 'Day view is missing vehicle, job, or overlap details');
    assert(r.dayState.escaped, 'Day view rendered customer text as HTML');
    assert(r.dayState.title.includes('August') && r.dayState.title.includes('14'), `Day view title is wrong: ${r.dayState.title}`);
    assert(r.newApptState.open && r.newApptState.date === '2026-08-14' && r.newApptState.dayStillOpen, `New appointment from the day view did not prefill the date: ${JSON.stringify(r.newApptState)}`);
    assert(r.escClosedFormFirst, 'Closing the top window did not close the appointment form before the day view');
    assert(r.afterDelete.request === '/api/appointments/2' && r.afterDelete.rows === 3 && r.afterDelete.conflicts === 0, `Deleting from the day view did not refresh it: ${JSON.stringify(r.afterDelete)}`);
    assert(r.nextDay.title.includes('15') && r.nextDay.empty, `Next-day navigation did not show the empty next day: ${JSON.stringify(r.nextDay)}`);
    assert(r.monthFollowed === 'September 2026', `Calendar month did not follow day navigation: ${r.monthFollowed}`);
    console.log('Schedule renderer QA passed: day view, time order, open gaps, overlap warnings, jobs, new/delete appointment, day navigation');
  } finally {
    window.destroy();
    await new Promise(resolve=>server.close(resolve));
    app.quit();
  }
}).catch(error => {
  console.error(error.stack || error.message || String(error));
  app.exit(1);
});
