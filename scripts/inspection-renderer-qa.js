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
  const server=http.createServer((req,res)=>{if(req.url==='/'||req.url==='/index.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);}else{res.writeHead(503,{'content-type':'application/json'});res.end('{"error":"Renderer QA has no API server"}');}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const window = new BrowserWindow({
    show: false,
    width: 1100,
    height: 900,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    await window.loadURL(`http://127.0.0.1:${server.address().port}/`);
    const results = await window.webContents.executeJavaScript(`
      (async()=>{
        state.customers=[{id:1,first:'Inspection',last:'Customer'}];
        state.vehicles=[{id:2,customer_id:1,year:2022,make:'Ford',model:'Transit'}];
        state.employees=[{id:3,first:'Test',last:'Technician',status:'active'}];
        state.inspections=[];
        await openInspModal();
        const measurementInputs=[...document.querySelectorAll('#insp-checklist .insp-measurement input')];
        const padInput=measurementInputs.find(input=>input.getAttribute('aria-label')==='Brake pad thickness — LF measurement');
        const rotorInput=measurementInputs.find(input=>input.getAttribute('aria-label')==='Rotor thickness — RF measurement');
        const treadInput=measurementInputs.find(input=>input.getAttribute('aria-label')==='Tread depth — LR measurement');
        padInput.value='6.5';padInput.dispatchEvent(new Event('input',{bubbles:true}));
        rotorInput.value='24.2';rotorInput.dispatchEvent(new Event('input',{bubbles:true}));
        treadInput.value='5';treadInput.dispatchEvent(new Event('input',{bubbles:true}));
        const treadIndex=inspItems.findIndex(item=>item.item_name==='Tread depth — LR');
        setInspCond(treadIndex,'advisory');
        document.getElementById('if2-cust').value='1';
        await loadVehiclesForInsp();
        document.getElementById('if2-veh').value='2';
        document.getElementById('if2-emp').value='3';
        document.getElementById('if2-date').value='2026-08-16';

        let requestCount=0,requestBody=null,resolveSave;
        window.api=async(method,endpoint,body)=>{
          if(method!=='POST'||endpoint!=='/api/inspections')throw new Error('Unexpected inspection renderer request');
          requestCount++;
          requestBody=body;
          return new Promise(resolve=>{resolveSave=()=>resolve({id:12,...body});});
        };
        document.getElementById('save-inspection-btn').click();
        document.getElementById('save-inspection-btn').click();
        await new Promise(resolve=>setTimeout(resolve,0));
        const openWhileSaving=document.getElementById('m-insp').classList.contains('open');
        resolveSave();
        while(activeMutations.has('inspection-save-new'))await new Promise(resolve=>setTimeout(resolve,0));
        const saved=state.inspections.find(inspection=>inspection.id===12);
        const saveState={
          requestCount,
          openWhileSaving,
          modalClosed:!document.getElementById('m-insp').classList.contains('open'),
          pad:requestBody.items.find(item=>item.item_name==='Brake pad thickness — LF'),
          rotor:requestBody.items.find(item=>item.item_name==='Rotor thickness — RF'),
          tread:requestBody.items.find(item=>item.item_name==='Tread depth — LR'),
          saved,
        };

        await openInspModal(12);
        const reopenedPad=document.querySelector('input[aria-label="Brake pad thickness — LF measurement"]');
        const reopenedTread=inspItems.find(item=>item.item_name==='Tread depth — LR');
        const reopenState={pad:reopenedPad.value,treadCondition:reopenedTread.condition};
        reopenedPad.value='4.5';reopenedPad.dispatchEvent(new Event('input',{bubbles:true}));
        window.api=async()=>{throw new Error('simulated inspection network failure');};
        await saveInspection();
        const failureState={
          modalOpen:document.getElementById('m-insp').classList.contains('open'),
          buttonEnabled:!document.getElementById('save-inspection-btn').disabled,
          toast:document.getElementById('toast').textContent,
          savedPad:state.inspections.find(inspection=>inspection.id===12).items.find(item=>item.item_name==='Brake pad thickness — LF').measurement_value,
        };
        closeM('m-insp');
        state.settings={business_name:'QA Repair',tax_rate:0};
        openInspectionReport(12);
        const inspectionReport={open:document.getElementById('m-invoice').classList.contains('open'),text:document.getElementById('invoice-content').textContent};
        closeM('m-invoice');
        state.jobs=[{id:20,customer_id:1,vehicle_id:2,repair_order_number:'RO-1020',date:'2026-08-16',service:'Brake service',labor:100,parts:0,status:'Complete'}];
        state.payments=[{id:30,customer_id:1,job_id:20,repair_order_number:'RO-1020',date:'2026-08-16',amount:40,method:'Card',payment_type:'payment'}];
        openCustomerStatement(1);
        const customerStatement={open:document.getElementById('m-invoice').classList.contains('open'),text:document.getElementById('invoice-content').textContent};
        closeM('m-invoice');
        state.operations={workflow_columns:[{id:1,name:'Awaiting Approval',position:10,color:'#D97706',is_active:1},{id:2,name:'In Progress',position:20,color:'#0891B2',is_active:1}],resources:[{id:5,name:'Mobile Unit 1',active:1}],templates:[],authorizations:[],deferred_services:[],reservations:[],vendors:[],purchase_orders:[],tasks:[],service_events:[],jobs:[{...state.jobs[0],status:'In Progress',workflow_column_id:2,resource_id:5,first:'Inspection',last:'Customer',year:2022,make:'Ford',model:'Transit'}]};
        operationsTab='board';renderOperations();
        const workflow={cards:document.querySelectorAll('.workflow-card').length,text:document.getElementById('operations-body').textContent,draggable:document.querySelector('.workflow-card')?.draggable};
        return {
          modalOpened:saveState.openWhileSaving,
          measurementCount:measurementInputs.length,
          saveState,
          reopenState,
          failureState,
          inspectionReport,
          customerStatement,
          workflow,
        };
      })()
    `, true);

    assert(results.modalOpened && results.measurementCount === 16, 'New Inspection did not open with all per-corner measurement inputs');
    assert(results.saveState.requestCount === 1 && results.saveState.openWhileSaving && results.saveState.modalClosed, 'Inspection duplicate-save protection or modal lifecycle failed');
    assert(results.saveState.pad.measurement_value === 6.5 && results.saveState.pad.measurement_unit === 'mm', 'Brake pad measurement was not submitted in millimeters');
    assert(results.saveState.rotor.measurement_value === 24.2 && results.saveState.rotor.measurement_unit === 'mm', 'Rotor measurement was not submitted in millimeters');
    assert(results.saveState.tread.measurement_value === 5 && results.saveState.tread.measurement_unit === '32nds' && results.saveState.tread.condition === 'advisory', 'Tread depth or its condition was not submitted correctly');
    assert(results.reopenState.pad === '6.5' && results.reopenState.treadCondition === 'advisory', 'Saved inspection measurements did not repopulate in edit mode');
    assert(results.failureState.modalOpen && results.failureState.buttonEnabled && results.failureState.savedPad === 6.5, 'Failed inspection edit closed the modal, disabled retry, or changed saved state');
    assert(results.failureState.toast.includes('simulated inspection network failure') && results.failureState.toast.includes('try again'), 'Failed inspection edit did not show actionable guidance');
    assert(results.inspectionReport.open && results.inspectionReport.text.includes('Vehicle Inspection') && results.inspectionReport.text.includes('6.5 mm'), 'Printable inspection report did not render saved measurements');
    assert(results.customerStatement.open && results.customerStatement.text.includes('Customer Statement') && results.customerStatement.text.includes('RO-1020'), 'Printable customer statement did not render account activity');
    assert(results.workflow.cards===1 && results.workflow.draggable && results.workflow.text.includes('Mobile Unit 1'), 'Workflow board did not render a draggable repair order and assigned resource');
    console.log('Inspection renderer QA passed: inspection entry/report, customer statement, workflow board, duplicate protection, and failure recovery');
  } finally {
    window.destroy();
    await new Promise(resolve=>server.close(resolve));
    app.quit();
  }
}).catch(error => {
  console.error(error.stack || error);
  app.exit(1);
});
