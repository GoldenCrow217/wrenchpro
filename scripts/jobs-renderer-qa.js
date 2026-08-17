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
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    await window.loadURL(`http://127.0.0.1:${server.address().port}/`);
    const results = await window.webContents.executeJavaScript(`
      (async()=>{
        state.customers=[{id:1,first:'Test',last:'Customer',address:'123 Main St'},{id:4,first:'Second',last:'Customer',address:'456 Oak Ave'}];
        state.vehicles=[{id:2,customer_id:1,year:2020,make:'Ford',model:'Transit',plate:'QA-1',miles:42000},{id:6,customer_id:4,year:2021,make:'Honda',model:'Accord',plate:'QA-2',miles:21000}];
        state.employees=[{id:3,first:'Test',last:'Tech',role:'Technician',status:'active'}];
        state.settings={...state.settings,default_labor_rate:125,diagnostic_rate:150,service_fee:50,tax_rate:8.25};
        state.jobs=[];
        state.inventory=[{id:9,name:'Test part',part_number:'QA-9',quantity:2,retail_price:25}];
        state.catalog=[{id:5,name:'Oil change',category:'Maintenance',default_hours:1,default_price:49.99}];
        state.payments=[];

        const initialPrimaryDisplay=document.getElementById('pri-btn').style.display;
        window.api=async(method,endpoint)=>{
          if(method==='GET'&&endpoint==='/api/dashboard')return{monthNetProfit:0};
          throw new Error('Renderer QA ignores unrelated startup refresh requests');
        };
        await renderDashboard();
        const dashboardNewJob=[...document.querySelectorAll('#page-dashboard button')].find(button=>button.textContent.includes('New Job'));
        dashboardNewJob?.click();
        await new Promise(resolve=>setTimeout(resolve,0));
        const dashboardEntryOpened=document.getElementById('m-job').classList.contains('open');
        closeM('m-job');
        sp('jobs');
        const jobsPrimary={display:document.getElementById('pri-btn').style.display,text:document.getElementById('pri-btn').textContent.trim()};
        document.getElementById('pri-btn').click();
        await new Promise(resolve=>setTimeout(resolve,0));
        const jobsEntryOpened=document.getElementById('m-job').classList.contains('open');
        closeM('m-job');
        handleMenuCommand('action:new-job');
        await new Promise(resolve=>setTimeout(resolve,0));
        const menuEntryOpened=document.getElementById('m-job').classList.contains('open');
        closeM('m-job');

        await openJobModal();
        const newOpen=document.getElementById('m-job').classList.contains('open');
        const newLinksEnabled=!document.getElementById('jf-cust').disabled&&!document.getElementById('jf-veh').disabled;
        const customerOptionCount=document.getElementById('jf-cust').options.length;
        document.getElementById('jf-cust').value='1';
        await loadVehiclesForJob();
        const vehicleOptionCount=document.getElementById('jf-veh').options.length;
        const serviceAddress=document.getElementById('jf-service-addr').value;
        document.getElementById('jf-cust').value='4';
        await loadVehiclesForJob();
        const switchedAutoAddress=document.getElementById('jf-service-addr').value;
        document.getElementById('jf-service-addr').value='Mobile service location';
        document.getElementById('jf-cust').value='1';
        await loadVehiclesForJob();
        const preservedManualAddress=document.getElementById('jf-service-addr').value;
        addJobItem('labor');
        addJobItem('diagnostic');
        const defaultRates=jobItems.map(item=>item.rate);
        jobItems[0].description='Standard labor';
        jobItems[1].description='Diagnostic labor';
        const fromCatalogButton=[...document.querySelectorAll('#m-job button')].find(button=>button.textContent.includes('From catalog'));
        fromCatalogButton?.click();
        const pickerOpened=document.getElementById('m-job-catalog').classList.contains('open');
        const pickerOptionCount=document.getElementById('job-catalog-select').options.length;
        document.getElementById('job-catalog-select').value='service:5';
        addSelectedJobCatalogItem();
        addJobItemFromCatalog();
        document.getElementById('job-catalog-select').value='inventory:9';
        addSelectedJobCatalogItem();
        const catalogLines={
          service:jobItems.find(item=>item.description==='Oil change'),
          inventory:jobItems.find(item=>item.inventory_id===9),
        };
        document.getElementById('jf-veh').value='2';
        document.getElementById('jf-date').value='2026-08-14';
        document.getElementById('jf-service').value='Renderer save QA';
        document.getElementById('jf-apply-trip-fee').checked=true;
        toggleJobTripFee();
        const tripState={value:document.getElementById('jf-travel-fee').value,step:document.getElementById('jf-travel-fee').step,enabled:!document.getElementById('jf-travel-fee').disabled};
        let saveRequestCount=0,saveRequest=null,resolveSave;
        window.api=async(method,endpoint,body)=>{
          if(method!=='POST'||endpoint!=='/api/jobs')throw new Error('Renderer QA ignores unrelated startup refresh requests');
          saveRequestCount++;
          saveRequest={method,endpoint,body};
          return new Promise(resolve=>{resolveSave=()=>resolve({
            id:8,...body,repair_order_number:'RO-1001',first:'Test',last:'Customer',year:2020,make:'Ford',model:'Transit',plate:'QA-1',
            labor:324.99,labor_hours:3,labor_rate:108.33,parts:25,tax_rate:8.25,vehicle_mileage:42000,
            items:body.items.map((item,index)=>({...item,id:index+10,job_id:8})),payment:null,inventory_updates:[{id:9,quantity:1}],
          });});
        };
        document.getElementById('save-job-btn').click();
        const duplicateSave=saveJob();
        await new Promise(resolve=>setTimeout(resolve,0));
        const modalOpenWhileSaving=document.getElementById('m-job').classList.contains('open');
        resolveSave();
        await duplicateSave;
        while(activeMutations.has('job-save-new'))await new Promise(resolve=>setTimeout(resolve,0));
        const saveState={
          requestCount:saveRequestCount,
          method:saveRequest?.method,
          endpoint:saveRequest?.endpoint,
          itemCount:saveRequest?.body?.items?.length,
          repairOrderSent:Object.prototype.hasOwnProperty.call(saveRequest?.body||{},'repair_order_number'),
          travelFee:saveRequest?.body?.travel_fee,
          modalClosed:!document.getElementById('m-job').classList.contains('open'),
          savedJob:state.jobs.find(job=>job.id===8),
          inventoryQuantity:state.inventory.find(item=>item.id===9)?.quantity,
          renderedRow:document.getElementById('jobs-tbody').textContent,
        };
        await openJobModal();
        document.getElementById('jf-cust').value='1';
        await loadVehiclesForJob();
        document.getElementById('jf-veh').value='2';
        document.getElementById('jf-date').value='2026-08-14';
        document.getElementById('jf-ro').value='RO-2222';
        let failureRequestBody=null;
        window.api=async(method,endpoint,body)=>{failureRequestBody=body;throw new Error('simulated network outage');};
        await saveJob();
        const failureState={
          modalOpen:document.getElementById('m-job').classList.contains('open'),
          jobCount:state.jobs.length,
          buttonEnabled:!document.getElementById('save-job-btn').disabled,
          toast:document.getElementById('toast').textContent,
          repairOrder:failureRequestBody?.repair_order_number,
        };
        closeM('m-job');

        state.jobs=[{
          id:7,customer_id:1,vehicle_id:2,employee_id:3,first:'Test',last:'Customer',year:2020,make:'Ford',model:'Transit',plate:'QA-1',
          repair_order_number:'RO-1007',date:'2026-08-14',miles:42500,status:'In Progress',invoice_status:'Unpaid',service:'Brake service',
          complaint:'Noise',diagnosis:'Pads worn',notes:'Renderer QA',service_address:'123 Main St',travel_fee:50,discount:5,parts_deposit_required:0,
          items:[{id:1,job_id:7,type:'labor',description:'Brake labor',qty:2,rate:125,amount:250,taxable:0,inventory_id:null}],
        }];
        await openJobModal(7);
        const editState={
          open:document.getElementById('m-job').classList.contains('open'),
          linksDisabled:document.getElementById('jf-cust').disabled&&document.getElementById('jf-veh').disabled,
          repairOrder:document.getElementById('jf-ro').value,
          customer:document.getElementById('jf-cust').value,
          vehicle:document.getElementById('jf-veh').value,
          employee:document.getElementById('jf-emp').value,
          itemType:jobItems[0]?.type,
          itemRate:jobItems[0]?.rate,
        };
        document.getElementById('jf-service').value='Updated brake service';
        jobItems[0].qty=2;
        jobItems[0].rate=135;
        jobItems.push({type:'part',description:'Shop-supplied pads',qty:1,rate:40,amount:40,taxable:1,inventory_id:null});
        renderJobItems();
        let editSaveRequest=null;
        window.api=async(method,endpoint,body)=>{
          if(method!=='PUT'||endpoint!=='/api/jobs/7')throw new Error('Renderer QA ignores unrelated edit requests');
          editSaveRequest={method,endpoint,body};
          return {
            id:7,...body,repair_order_number:'RO-1007',first:'Test',last:'Customer',year:2020,make:'Ford',model:'Transit',plate:'QA-1',
            labor:270,labor_hours:2,labor_rate:135,parts:40,tax_rate:8.25,vehicle_mileage:42500,
            items:body.items.map((item,index)=>({...item,id:index+20,job_id:7})),payment:null,inventory_updates:[],
          };
        };
        document.getElementById('save-job-btn').click();
        while(activeMutations.has('job-save-7'))await new Promise(resolve=>setTimeout(resolve,0));
        const editSaveState={
          method:editSaveRequest?.method,
          endpoint:editSaveRequest?.endpoint,
          modalClosed:!document.getElementById('m-job').classList.contains('open'),
          savedJob:state.jobs.find(job=>job.id===7),
          renderedRow:document.getElementById('jobs-tbody').textContent,
        };

        state.payments=[{id:30,customer_id:1,job_id:7,amount:100,date:'2026-08-14',method:'Card',description:'RO payment'}];
        state.plans=[{id:31,customer_id:1,job_id:7,repair_order_number:'RO-1007',description:'Brake payment plan',total:300,balance:200,frequency:'monthly',installments:[{due_date:'2026-09-01',amount:100,paid:1},{due_date:'2026-10-01',amount:200,paid:0}]}];
        openInvoice(7);
        const invoiceText=document.getElementById('invoice-content').textContent;
        const invoiceState={
          open:document.getElementById('m-invoice').classList.contains('open'),
          hasRepairOrder:invoiceText.includes('RO #: RO-1007'),
          hasPaymentHistory:invoiceText.includes('Payment history')&&invoiceText.includes('Card'),
          hasPlan:invoiceText.includes('Brake payment plan')&&invoiceText.includes('2026-10-01'),
        };
        closeM('m-invoice');

        state.customers=[];
        state.vehicles=[];
        state.employees=[];
        await openJobModal(7);
        const archivedState={
          customerText:document.getElementById('jf-cust').selectedOptions[0]?.textContent||'',
          vehicleText:document.getElementById('jf-veh').selectedOptions[0]?.textContent||'',
          employeeText:document.getElementById('jf-emp').selectedOptions[0]?.textContent||'',
          deleteGuidance:document.getElementById('jf-del').textContent,
        };
        closeM('m-job');
        openInvoice(7);
        const archivedInvoiceText=document.getElementById('invoice-content').textContent;
        const archivedInvoice={customer:archivedInvoiceText.includes('Test Customer'),vehicle:archivedInvoiceText.includes('2020 Ford Transit')};
        closeM('m-invoice');

        await openJobModal();
        const noCustomerState={
          open:document.getElementById('m-job').classList.contains('open'),
          vehicleOptions:document.getElementById('jf-veh').options.length,
          toast:document.getElementById('toast').textContent,
        };
        closeM('m-job');

        state.customers=[{id:1,first:'Test',last:'Customer'}];
        await openJobModal();
        document.getElementById('jf-cust').value='1';
        await loadVehiclesForJob();
        const noVehicleState={
          open:document.getElementById('m-job').classList.contains('open'),
          vehicleOptions:document.getElementById('jf-veh').options.length,
          toast:document.getElementById('toast').textContent,
        };
        closeM('m-job');

        state.jobs=[
          {id:20,repair_order_number:'RO-10',date:'2026-08-12',first:'Zoe',last:'Zulu',year:2020,make:'Ford',model:'F-150',service:'Open work',labor:50,parts:20,status:'Pending'},
          {id:21,repair_order_number:'RO-2',date:'2026-08-10',first:'Amy',last:'Alpha',year:2019,make:'Honda',model:'Civic',service:'Closed work',labor:10,parts:5,status:'Complete',closed_at:'2026-08-10 12:00:00'},
          {id:22,repair_order_number:'RO-3',date:'2026-08-11',first:'Ben',last:'Beta',year:2018,make:'Toyota',model:'Camry',service:'Canceled work',labor:15,parts:0,status:'Canceled',closed_at:'2026-08-11 12:00:00'},
        ];
        const statusFilter=document.getElementById('job-status-filter');
        statusFilter.value='open';renderJobs();
        const openRows=document.querySelectorAll('#jobs-tbody tr').length;
        statusFilter.value='closed';renderJobs();
        const closedRows=document.querySelectorAll('#jobs-tbody tr').length;
        statusFilter.value='';jobSortKey=null;jobSortDirection='asc';setJobSort('ro');
        const firstAscending=document.querySelector('#jobs-tbody tr td')?.textContent.trim();
        setJobSort('ro');
        const firstDescending=document.querySelector('#jobs-tbody tr td')?.textContent.trim();
        const sortAria=document.querySelector('[data-job-sort="ro"]')?.closest('th')?.getAttribute('aria-sort');
        const listState={openRows,closedRows,firstAscending,firstDescending,sortAria};
        window.api=async()=>{throw new Error('simulated dashboard summary outage');};
        await renderDashboard();
        const degradedDashboardButton=[...document.querySelectorAll('#page-dashboard button')].find(button=>button.textContent.includes('New Job'));
        degradedDashboardButton?.click();
        await new Promise(resolve=>setTimeout(resolve,0));
        const degradedDashboardState={
          warning:document.getElementById('page-dashboard').textContent.includes('Jobs and other saved information are still available'),
          newJobOpened:document.getElementById('m-job').classList.contains('open'),
          netProfitUnavailable:document.getElementById('page-dashboard').textContent.includes('summary unavailable'),
        };
        closeM('m-job');
        return {initialPrimaryDisplay,dashboardEntryOpened,jobsPrimary,jobsEntryOpened,menuEntryOpened,newOpen,newLinksEnabled,customerOptionCount,vehicleOptionCount,serviceAddress,switchedAutoAddress,preservedManualAddress,defaultRates,pickerOpened,pickerOptionCount,catalogLines,tripState,modalOpenWhileSaving,saveState,failureState,editState,editSaveState,invoiceState,archivedState,archivedInvoice,noCustomerState,noVehicleState,listState,degradedDashboardState};
      })()
    `, true);

    assert(results.initialPrimaryDisplay === 'none', 'Fresh Dashboard showed the shared top-bar New Job action');
    assert(results.dashboardEntryOpened, 'Dashboard New Job button did not open the Job modal');
    assert(results.jobsPrimary.display === '' && results.jobsPrimary.text === '+ New Job', 'Jobs navigation did not expose the shared New Job action');
    assert(results.jobsEntryOpened, 'Jobs top-bar New Job button did not open the Job modal');
    assert(results.menuEntryOpened, 'Native menu New Job command did not open the Job modal');
    assert(results.newOpen && results.newLinksEnabled, 'New Job modal did not open with editable customer and vehicle fields');
    assert(results.customerOptionCount === 3 && results.vehicleOptionCount === 2, 'New Job customer or vehicle options did not initialize');
    assert(results.serviceAddress === '123 Main St', 'New Job did not use the selected customer service address');
    assert(results.switchedAutoAddress === '456 Oak Ave' && results.preservedManualAddress === 'Mobile service location', 'Customer changes did not refresh an automatic service address or preserve a manual address');
    assert(JSON.stringify(results.defaultRates) === JSON.stringify([125, 150]), 'Configured labor and diagnostic rates did not initialize');
    assert(results.pickerOpened && results.pickerOptionCount === 2 && results.catalogLines.service?.qty === 1 && results.catalogLines.service?.rate === 49.99, 'From Catalog button did not open both sources or retain the configured service hours and price');
    assert(results.catalogLines.inventory?.rate === 25 && results.catalogLines.inventory?.inventory_id === 9, 'Parts & Inventory item was not added with its retail price and stable inventory link');
    assert(results.tripState.value === '50.00' && results.tripState.step === '10' && results.tripState.enabled, 'Configured trip fee did not enable with ten-dollar input increments');
    assert(results.modalOpenWhileSaving, 'New Job modal closed before the save request was confirmed');
    assert(results.saveState.requestCount === 1 && results.saveState.method === 'POST' && results.saveState.endpoint === '/api/jobs', `Duplicate Save activation issued more than one Job request or used the wrong endpoint: ${JSON.stringify(results.saveState)}`);
    assert(results.saveState.itemCount === 4 && !results.saveState.repairOrderSent && results.saveState.savedJob?.repair_order_number === 'RO-1001', 'Untouched RO suggestion was not assigned authoritatively by the server response');
    assert(results.saveState.modalClosed && results.saveState.inventoryQuantity === 1 && results.saveState.travelFee === 50, 'Confirmed New Job save did not close the modal, preserve the trip fee, or reconcile inventory state');
    assert(results.saveState.renderedRow.includes('RO-1001') && results.saveState.renderedRow.includes('$324.99') && results.saveState.renderedRow.includes('$25.00'), 'Confirmed New Job did not update the visible RO, labor, and parts columns');
    assert(results.failureState.modalOpen && results.failureState.jobCount === 1 && results.failureState.buttonEnabled && results.failureState.repairOrder === 'RO-2222', 'Failed New Job save changed state, closed the modal, left Save disabled, or lost a manual RO override');
    assert(results.failureState.toast.includes('simulated network outage') && results.failureState.toast.includes('try again'), 'Failed New Job save did not show actionable guidance');
    assert(results.editState.open && results.editState.linksDisabled, 'Edit Job did not open with immutable customer and vehicle links');
    assert(results.editState.repairOrder === 'RO-1007' && results.editState.customer === '1' && results.editState.vehicle === '2', 'Edit Job did not populate its saved links and repair order');
    assert(results.editState.employee === '3' && results.editState.itemType === 'labor' && results.editState.itemRate === 125, 'Edit Job did not populate employee or line-item details');
    assert(results.editSaveState.method === 'PUT' && results.editSaveState.endpoint === '/api/jobs/7' && results.editSaveState.modalClosed, 'Edit Job did not use the existing PUT workflow or close after confirmation');
    assert(results.editSaveState.savedJob?.service === 'Updated brake service' && results.editSaveState.savedJob?.labor === 270 && results.editSaveState.savedJob?.parts === 40, 'Confirmed Job edit did not reconcile the returned record into local state');
    assert(results.editSaveState.renderedRow.includes('Updated brake service') && results.editSaveState.renderedRow.includes('$270.00') && results.editSaveState.renderedRow.includes('$40.00') && results.editSaveState.renderedRow.includes('$358.25'), 'Confirmed Job edit did not immediately update the visible Service, Labor, Parts, and Total columns');
    assert(results.invoiceState.open && results.invoiceState.hasRepairOrder && results.invoiceState.hasPaymentHistory && results.invoiceState.hasPlan, 'Job invoice did not render its RO, linked payment history, and payment plan schedule');
    assert(results.archivedState.customerText.includes('(archived)') && results.archivedState.vehicleText.includes('(archived)') && results.archivedState.employeeText.includes('(archived)'), 'Archived linked records were not available in historical Job editing');
    assert(results.archivedState.deleteGuidance.includes('retained for history'), 'Archived-customer Job did not show history-retention guidance');
    assert(results.archivedInvoice.customer && results.archivedInvoice.vehicle, 'Archived customer or vehicle details disappeared from the Job invoice');
    assert(results.noCustomerState.open && results.noCustomerState.vehicleOptions === 1, 'No-customer New Job did not remain open with a cleared vehicle selector');
    assert(results.noCustomerState.toast.includes('Add a customer before saving a job'), 'No-customer New Job did not show actionable guidance');
    assert(results.noVehicleState.open && results.noVehicleState.vehicleOptions === 1 && results.noVehicleState.toast.includes('Add a vehicle before saving'), 'Customer-without-vehicle New Job did not remain open with actionable guidance');
    assert(results.listState.openRows === 1 && results.listState.closedRows === 2, 'Open and closed repair-order filters did not select the correct rows');
    assert(results.listState.firstAscending === 'RO-2' && results.listState.firstDescending === 'RO-10' && results.listState.sortAria === 'descending', 'Repair-order column did not sort naturally in both directions');
    assert(results.degradedDashboardState.warning && results.degradedDashboardState.newJobOpened && results.degradedDashboardState.netProfitUnavailable, 'Dashboard summary failure removed New Job access or displayed a misleading financial total');
    console.log('Jobs renderer QA passed: entry points, catalog/inventory, pricing, trip fee, create/edit recovery, archived links, filters, and sorting');
  } finally {
    window.destroy();
    await new Promise(resolve=>server.close(resolve));
    app.quit();
  }
}).catch(error => {
  console.error(error.stack || error.message || String(error));
  app.exit(1);
});
