// app.js — Acadèmia Impulsa't (fixed)

let sb         = null; // "supabase" és una variable global del CDN, no podem reutilitzar el nom
let students   = [];
let teachers   = [];
let classes    = [];
let payments   = [];
let expenses   = [];
let tasks      = [];
let editingId  = null;
let dataLoaded = false;

const TODAY     = new Date();
const DAYS_CA   = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
const MONTHS_CA = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
const DAYS = [
  {label:'Dilluns',order:1},{label:'Dimarts',order:2},{label:'Dimecres',order:3},
  {label:'Dijous',order:4},{label:'Divendres',order:5},{label:'Dissabte',order:6}
];

function todayStr(){return`${TODAY.getFullYear()}-${String(TODAY.getMonth()+1).padStart(2,'0')}-${String(TODAY.getDate()).padStart(2,'0')}`;}
function formatDate(d){if(!d)return'—';const dt=new Date(d+'T00:00:00');return`${dt.getDate()} ${MONTHS_CA[dt.getMonth()]} ${dt.getFullYear()}`;}
function formatMoney(n){return parseFloat(n||0).toFixed(2).replace('.',',')+'€';}
function currentMonth(){return`${TODAY.getFullYear()}-${String(TODAY.getMonth()+1).padStart(2,'0')}`;}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

function updateClock(){
  const now=new Date();
  const el=document.getElementById('currentTime');if(el)el.textContent=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const sd=document.getElementById('sidebarDate');if(sd)sd.innerHTML=`${DAYS_CA[now.getDay()]}<br>${now.getDate()} ${MONTHS_CA[now.getMonth()]} ${now.getFullYear()}`;
}

let toastTimer;
function showToast(msg,type='success'){
  const el=document.getElementById('toast');if(!el)return;
  el.textContent=msg;el.className=`toast show toast-${type}`;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3500);
}

function confirmAction(msg,cb){
  document.getElementById('confirmMessage').textContent=msg;
  const ov=document.getElementById('confirmOverlay');ov.classList.add('active');
  const old=document.getElementById('confirmOk');const btn=old.cloneNode(true);old.parentNode.replaceChild(btn,old);
  btn.addEventListener('click',()=>{ov.classList.remove('active');cb();});
}

function openModal(title,html){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=html;
  document.getElementById('modalOverlay').classList.add('active');
}
function closeModal(){document.getElementById('modalOverlay').classList.remove('active');editingId=null;}

function navigate(sec){
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.toggle('active',i.dataset.section===sec));
  document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id===`section-${sec}`));
  const titles={dashboard:'Dashboard',students:'Alumnes',teachers:'Professors',schedule:'Horaris',payments:'Pagaments',finances:'Finances',tasks:'Tasques'};
  const pt=document.getElementById('pageTitle');if(pt)pt.textContent=titles[sec]||sec;
  document.getElementById('sidebar').classList.remove('open');

  if(!dataLoaded){
    showToast('Carregant dades...','warning');
    return;
  }

  if(sec==='dashboard')loadDashboard();
  if(sec==='students')renderStudents();
  if(sec==='teachers')renderTeachers();
  if(sec==='schedule')renderSchedule();
  if(sec==='payments')renderPayments();
  if(sec==='finances')renderFinances();
  if(sec==='tasks')renderTasks();
}

async function loadAll(){
  if(!sb){
    showToast('Supabase no inicialitzat!','error');
    showLoadError('No s\'ha pogut connectar a Supabase. Comprova les credencials a supabase-config.js i que el fitxer es carregui correctament.');
    return;
  }

  // Mostra animació de càrrega
  const g=document.getElementById('statsGrid');
  if(g)g.innerHTML=`
    <div class="stat-card loading"></div><div class="stat-card loading"></div><div class="stat-card loading"></div>
    <div class="stat-card loading"></div><div class="stat-card loading"></div><div class="stat-card loading"></div>`;

  try{
    // Test de connexió primer
    const testResult = await sb.from('students').select('id').limit(1);
    if(testResult.error){
      throw new Error('Error de connexió: ' + testResult.error.message + '. Codi: ' + testResult.error.code);
    }

    const [s,t,c,p,e,k]=await Promise.all([
      sb.from('students').select('*').order('name'),
      sb.from('teachers').select('*').order('name'),
      sb.from('classes').select('*').order('day_order').order('start_time'),
      sb.from('payments').select('*').order('due_date',{ascending:false}),
      sb.from('expenses').select('*').order('date',{ascending:false}),
      sb.from('tasks').select('*').order('created_at',{ascending:false}),
    ]);

    // Comprova errors individuals i reporta el primer
    const results = [s,t,c,p,e,k];
    const tableNames = ['students','teachers','classes','payments','expenses','tasks'];
    for(let i=0;i<results.length;i++){
      if(results[i].error){
        throw new Error(`Error a la taula "${tableNames[i]}": ${results[i].error.message}`);
      }
    }

    students=s.data||[];teachers=t.data||[];classes=c.data||[];
    payments=p.data||[];expenses=e.data||[];tasks=k.data||[];
    dataLoaded=true;

    await updatePaymentStatuses();
    loadDashboard();
    showToast(`Dades carregades: ${students.length} alumnes, ${teachers.length} professors ✓`,'success');
  }catch(err){
    console.error('loadAll error:', err);
    const msg = err.message || String(err);
    showToast('Error: '+msg,'error');
    showLoadError(msg);
  }
}

function showLoadError(msg){
  const g=document.getElementById('statsGrid');
  if(g)g.innerHTML=`<div class="stat-card" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--red)">
    <div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>
    <strong>Error de connexió</strong><br>
    <span style="color:var(--text-sec);font-size:.85rem;display:block;margin:.5rem 0">${esc(msg)}</span>
    <small style="color:var(--text-light);display:block;margin-bottom:1rem">Obre la consola del navegador (F12 → Console) per veure l'error complet.</small>
    <button class="btn btn-primary" onclick="loadAll()">🔄 Reintenta</button>
  </div>`;
}

async function updatePaymentStatuses(){
  const today=todayStr();
  const ids=payments.filter(p=>p.status==='pendent'&&p.due_date&&p.due_date<today).map(p=>p.id);
  if(!ids.length)return;
  try{
    await sb.from('payments').update({status:'vençut'}).in('id',ids);
    payments.forEach(p=>{if(ids.includes(p.id))p.status='vençut';});
  }catch(e){console.warn('updatePaymentStatuses:',e);}
}

function loadDashboard(){
  const month=currentMonth();
  const active=students.filter(s=>s.status==='actiu');
  const pend=payments.filter(p=>p.status==='pendent');
  const over=payments.filter(p=>p.status==='vençut');
  const inc=payments.filter(p=>p.status==='pagat'&&(p.payment_month||'').startsWith(month)).reduce((a,p)=>a+parseFloat(p.amount||0),0);
  const exp=expenses.filter(e=>e.date&&e.date.startsWith(month)).reduce((a,e)=>a+parseFloat(e.amount||0),0);
  const bal=inc-exp;
  const soon=[];
  active.forEach(s=>{
    if(!s.renewal_day)return;
    const now=new Date(TODAY);now.setHours(0,0,0,0);
    let d=new Date(now.getFullYear(),now.getMonth(),s.renewal_day);
    if(d<now)d=new Date(now.getFullYear(),now.getMonth()+1,s.renewal_day);
    const diff=Math.ceil((d-now)/86400000);
    if(diff>=0&&diff<=7)soon.push({student:s,diff});
  });
  soon.sort((a,b)=>a.diff-b.diff);
  const g=document.getElementById('statsGrid');
  if(g)g.innerHTML=`
    <div class="stat-card stat-card-orange"><div class="stat-label">Ingressos del mes</div><div class="stat-value income">${formatMoney(inc)}</div><div class="stat-accent"></div></div>
    <div class="stat-card"><div class="stat-label">Gastos del mes</div><div class="stat-value expense">${formatMoney(exp)}</div></div>
    <div class="stat-card"><div class="stat-label">Balanç estimat</div><div class="stat-value ${bal>=0?'balance-pos':'balance-neg'}">${formatMoney(bal)}</div></div>
    <div class="stat-card"><div class="stat-label">Alumnes actius</div><div class="stat-value">${active.length}</div></div>
    <div class="stat-card"><div class="stat-label">Pagaments pendents</div><div class="stat-value" style="color:var(--yellow)">${pend.length}</div></div>
    <div class="stat-card"><div class="stat-label">Pagaments vençuts</div><div class="stat-value" style="color:var(--red)">${over.length}</div></div>`;
  const ab=document.getElementById('alertsBar');
  if(ab){const al=[];
    if(over.length)al.push(`<div class="alert alert-danger">⚠️ ${over.length} pagament(s) vençut(s).</div>`);
    if(soon.length)al.push(`<div class="alert alert-warning">🔔 ${soon.length} alumne(s) amb renovació en 7 dies.</div>`);
    const ht=tasks.filter(t=>t.priority==='alta'&&t.status==='pendent');
    if(ht.length)al.push(`<div class="alert alert-danger">🔴 ${ht.length} tasca(es) alta prioritat.</div>`);
    ab.innerHTML=al.join('');
  }
  const rc=document.getElementById('renewalCount');if(rc)rc.textContent=soon.length;
  const rl=document.getElementById('renewalList');
  if(rl)rl.innerHTML=soon.length?soon.map(r=>`<div class="item-row"><div><div class="item-row-name">${esc(r.student.name)} ${esc(r.student.surname)}</div><div class="item-row-sub">${r.diff===0?'Avui':`En ${r.diff} dia${r.diff>1?'s':''}`}</div></div><div class="badge badge-yellow">${formatMoney(r.student.monthly_price)}</div></div>`).join(''):'<div class="item-row" style="padding:1rem;color:var(--text-sec)">Cap renovació propera</div>';
  const pc=document.getElementById('pendingCount');if(pc)pc.textContent=pend.length+over.length;
  const pl=document.getElementById('pendingList');
  if(pl){const all=[...over,...pend].slice(0,8);pl.innerHTML=all.length?all.map(p=>{const st=students.find(s=>s.id===p.student_id);return`<div class="item-row"><div><div class="item-row-name">${st?esc(st.name)+' '+esc(st.surname):'—'}</div><div class="item-row-sub">${p.payment_month||''}</div></div><span class="badge ${p.status==='vençut'?'badge-red':'badge-yellow'}">${p.status}</span></div>`;}).join(''):'<div class="item-row" style="padding:1rem;color:var(--text-sec)">Cap pagament pendent 🎉</div>';}
  const todayIdx=TODAY.getDay()===0?7:TODAY.getDay();
  const tc=document.getElementById('todayClasses');
  if(tc){const cl=classes.filter(c=>c.day_order===todayIdx).sort((a,b)=>(a.start_time||'').localeCompare(b.start_time||''));tc.innerHTML=cl.length?cl.map(c=>{const t=teachers.find(t=>t.id===c.teacher_id);return`<div class="item-row"><div><div class="item-row-name">${c.start_time?.slice(0,5)} — ${esc(c.subject||'')}</div><div class="item-row-sub">${t?esc(t.name+' '+t.surname):''} ${c.students_label?'· '+esc(c.students_label):''}</div></div></div>`;}).join(''):'<div class="item-row" style="padding:1rem;color:var(--text-sec)">No hi ha classes avui</div>';}
  const tt=document.getElementById('todayTasks');
  if(tt){const pO={alta:0,mitja:1,baixa:2};const pt2=tasks.filter(t=>t.status==='pendent').sort((a,b)=>(pO[a.priority]??1)-(pO[b.priority]??1)).slice(0,5);tt.innerHTML=pt2.length?pt2.map(t=>`<div class="item-row"><div><div class="item-row-name">${esc(t.title)}</div><div class="item-row-sub">${t.category||''}</div></div><span class="badge ${t.priority==='alta'?'badge-red':t.priority==='mitja'?'badge-yellow':'badge-green'}">${t.priority}</span></div>`).join(''):'<div class="item-row" style="padding:1rem;color:var(--text-sec)">Totes les tasques fetes! ✅</div>';}
}

// ── STUDENTS ───────────────────────────────────────────────
function renderStudents(){
  const search=(document.getElementById('studentSearch')?.value||'').toLowerCase().trim();
  const statusF=document.getElementById('studentStatusFilter')?.value||'';
  const list=students.filter(s=>(!search||(s.name+' '+s.surname).toLowerCase().includes(search))&&(!statusF||s.status===statusF));
  const tbody=document.getElementById('studentsTbody'),empty=document.getElementById('studentsEmpty'),table=document.getElementById('studentsTable');
  if(!list.length){if(table)table.style.display='none';if(empty)empty.style.display='';return;}
  if(table)table.style.display='';if(empty)empty.style.display='none';
  const sb={actiu:'badge-green',pausat:'badge-yellow',baixa:'badge-gray'};
  tbody.innerHTML=list.map(s=>{const pc=payments.filter(p=>p.student_id===s.id&&(p.status==='pendent'||p.status==='vençut')).length;return`<tr><td><div style="font-weight:600">${esc(s.name)} ${esc(s.surname)}</div><div style="color:var(--text-sec);font-size:.78rem">${esc(s.email||'')}</div></td><td>${esc(s.course||'—')}</td><td>${esc(s.phone||'—')}</td><td style="font-weight:600">${formatMoney(s.monthly_price)}</td><td>Dia ${s.renewal_day||'—'}</td><td><span class="badge ${sb[s.status]||'badge-gray'}">${esc(s.status)}</span>${pc?`<span class="badge badge-red" style="margin-left:.35rem">${pc} pend.</span>`:''}</td><td><div class="actions"><button class="btn btn-icon btn-sm" onclick="openStudentForm('${s.id}')">✏️</button><button class="btn btn-icon btn-sm" onclick="deleteStudent('${s.id}')">🗑️</button></div></td></tr>`;}).join('');
}
function filterStudents(){renderStudents();}
function openStudentForm(id=null){
  editingId=id;const s=id?students.find(x=>x.id===id):{};if(id&&!s){showToast('Alumne no trobat','error');return;}
  openModal(id?'Editar alumne':'Nou alumne',`<div class="form-row"><div class="form-group"><label>Nom *</label><input class="input" id="f_name" value="${esc(s.name||'')}"/></div><div class="form-group"><label>Cognoms *</label><input class="input" id="f_surname" value="${esc(s.surname||'')}"/></div></div><div class="form-row"><div class="form-group"><label>Curs</label><input class="input" id="f_course" value="${esc(s.course||'')}"/></div><div class="form-group"><label>Estat</label><select class="input" id="f_status">${['actiu','pausat','baixa'].map(o=>`<option value="${o}" ${(s.status||'actiu')===o?'selected':''}>${o}</option>`).join('')}</select></div></div><div class="form-group"><label>Assignatures</label><input class="input" id="f_subjects" value="${esc(s.subjects||'')}"/></div><div class="form-row"><div class="form-group"><label>Telèfon</label><input class="input" id="f_phone" value="${esc(s.phone||'')}"/></div><div class="form-group"><label>Email</label><input class="input" id="f_email" type="email" value="${esc(s.email||'')}"/></div></div><div class="form-row"><div class="form-group"><label>Preu mensual (€)</label><input class="input" id="f_price" type="number" step="0.01" min="0" value="${s.monthly_price||''}"/></div><div class="form-group"><label>Dia renovació</label><input class="input" id="f_renewal" type="number" min="1" max="31" value="${s.renewal_day||''}"/></div></div><div class="form-group"><label>Notes</label><textarea class="input" id="f_notes">${esc(s.notes||'')}</textarea></div><div class="form-actions"><button class="btn btn-primary" onclick="saveStudent()">💾 Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button></div>`);
}
async function saveStudent(){
  const data={name:document.getElementById('f_name').value.trim(),surname:document.getElementById('f_surname').value.trim(),course:document.getElementById('f_course').value.trim(),status:document.getElementById('f_status').value,subjects:document.getElementById('f_subjects').value.trim(),phone:document.getElementById('f_phone').value.trim(),email:document.getElementById('f_email').value.trim(),monthly_price:parseFloat(document.getElementById('f_price').value)||0,renewal_day:parseInt(document.getElementById('f_renewal').value)||null,notes:document.getElementById('f_notes').value.trim()};
  if(!data.name||!data.surname){showToast('Nom i cognoms obligatoris','error');return;}
  try{if(editingId){const{error}=await sb.from('students').update(data).eq('id',editingId);if(error)throw error;students=students.map(s=>s.id===editingId?{...s,...data}:s);showToast('Alumne actualitzat ✓');}else{const{data:res,error}=await sb.from('students').insert(data).select().single();if(error)throw error;students.push(res);showToast('Alumne afegit ✓');}closeModal();renderStudents();}catch(e){showToast('Error: '+e.message,'error');}
}
async function deleteStudent(id){
  const s=students.find(x=>x.id===id);
  confirmAction(`Eliminar "${s?.name} ${s?.surname}"?`,async()=>{try{const{error}=await sb.from('students').delete().eq('id',id);if(error)throw error;students=students.filter(x=>x.id!==id);payments=payments.filter(x=>x.student_id!==id);renderStudents();showToast('Alumne eliminat');}catch(e){showToast('Error: '+e.message,'error');}});
}

// ── TEACHERS ───────────────────────────────────────────────
function renderTeachers(){
  const search=(document.getElementById('teacherSearch')?.value||'').toLowerCase().trim();
  const list=teachers.filter(t=>!search||(t.name+' '+t.surname).toLowerCase().includes(search));
  const tbody=document.getElementById('teachersTbody'),empty=document.getElementById('teachersEmpty'),table=document.getElementById('teachersTable');
  if(!list.length){if(table)table.style.display='none';if(empty)empty.style.display='';return;}
  if(table)table.style.display='';if(empty)empty.style.display='none';
  tbody.innerHTML=list.map(t=>`<tr><td style="font-weight:600">${esc(t.name)} ${esc(t.surname)}</td><td>${esc(t.subjects||'—')}</td><td>${esc(t.phone||'—')}</td><td>${esc(t.email||'—')}</td><td><span class="badge ${t.status==='actiu'||!t.status?'badge-green':'badge-gray'}">${t.status||'actiu'}</span></td><td><div class="actions"><button class="btn btn-icon btn-sm" onclick="openTeacherForm('${t.id}')">✏️</button><button class="btn btn-icon btn-sm" onclick="deleteTeacher('${t.id}')">🗑️</button></div></td></tr>`).join('');
}
function filterTeachers(){renderTeachers();}
function openTeacherForm(id=null){
  editingId=id;const t=id?teachers.find(x=>x.id===id):{};if(id&&!t){showToast('Professor no trobat','error');return;}
  openModal(id?'Editar professor':'Nou professor',`<div class="form-row"><div class="form-group"><label>Nom *</label><input class="input" id="f_name" value="${esc(t.name||'')}"/></div><div class="form-group"><label>Cognoms *</label><input class="input" id="f_surname" value="${esc(t.surname||'')}"/></div></div><div class="form-row"><div class="form-group"><label>Telèfon</label><input class="input" id="f_phone" value="${esc(t.phone||'')}"/></div><div class="form-group"><label>Email</label><input class="input" id="f_email" type="email" value="${esc(t.email||'')}"/></div></div><div class="form-group"><label>Assignatures</label><input class="input" id="f_subjects" value="${esc(t.subjects||'')}"/></div><div class="form-group"><label>Disponibilitat</label><input class="input" id="f_availability" value="${esc(t.availability||'')}"/></div><div class="form-group"><label>Estat</label><select class="input" id="f_status"><option value="actiu" ${(t.status==='actiu'||!t.status)?'selected':''}>Actiu</option><option value="inactiu" ${t.status==='inactiu'?'selected':''}>Inactiu</option></select></div><div class="form-group"><label>Notes</label><textarea class="input" id="f_notes">${esc(t.notes||'')}</textarea></div><div class="form-actions"><button class="btn btn-primary" onclick="saveTeacher()">💾 Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button></div>`);
}
async function saveTeacher(){
  const data={name:document.getElementById('f_name').value.trim(),surname:document.getElementById('f_surname').value.trim(),phone:document.getElementById('f_phone').value.trim(),email:document.getElementById('f_email').value.trim(),subjects:document.getElementById('f_subjects').value.trim(),availability:document.getElementById('f_availability').value.trim(),status:document.getElementById('f_status').value,notes:document.getElementById('f_notes').value.trim()};
  if(!data.name||!data.surname){showToast('Nom i cognoms obligatoris','error');return;}
  try{if(editingId){const{error}=await sb.from('teachers').update(data).eq('id',editingId);if(error)throw error;teachers=teachers.map(t=>t.id===editingId?{...t,...data}:t);showToast('Professor actualitzat ✓');}else{const{data:res,error}=await sb.from('teachers').insert(data).select().single();if(error)throw error;teachers.push(res);showToast('Professor afegit ✓');}closeModal();renderTeachers();}catch(e){showToast('Error: '+e.message,'error');}
}
async function deleteTeacher(id){
  const t=teachers.find(x=>x.id===id);
  confirmAction(`Eliminar "${t?.name} ${t?.surname}"?`,async()=>{try{const{error}=await sb.from('teachers').delete().eq('id',id);if(error)throw error;teachers=teachers.filter(x=>x.id!==id);renderTeachers();showToast('Professor eliminat');}catch(e){showToast('Error: '+e.message,'error');}});
}

// ── SCHEDULE ───────────────────────────────────────────────
function renderSchedule(){
  const tSel=document.getElementById('scheduleTeacherFilter'),sSel=document.getElementById('scheduleStudentFilter');
  const curT=tSel?.value||'',curS=sSel?.value||'';
  if(tSel){tSel.innerHTML=`<option value="">Tots els professors</option>`+teachers.map(t=>`<option value="${t.id}" ${curT===t.id?'selected':''}>${esc(t.name)} ${esc(t.surname)}</option>`).join('');tSel.value=curT;}
  if(sSel){sSel.innerHTML=`<option value="">Tots els alumnes</option>`+students.map(s=>`<option value="${s.id}" ${curS===s.id?'selected':''}>${esc(s.name)} ${esc(s.surname)}</option>`).join('');sSel.value=curS;}
  const tF=tSel?.value||'';
  const todayIdx=TODAY.getDay()===0?7:TODAY.getDay();
  const filtered=classes.filter(c=>(!tF||c.teacher_id===tF));
  const container=document.getElementById('weeklySchedule');if(!container)return;
  container.innerHTML=DAYS.map(day=>{
    const dc=filtered.filter(c=>c.day_order===day.order).sort((a,b)=>(a.start_time||'').localeCompare(b.start_time||''));
    return`<div class="day-col"><div class="day-header ${day.order===todayIdx?'today':''}"><span>${day.label}</span><span style="opacity:.6;font-size:.75rem">${dc.length} classe${dc.length!==1?'s':''}</span></div><div class="day-classes">${dc.length?dc.map(c=>{const t=teachers.find(t=>t.id===c.teacher_id);return`<div class="class-chip" onclick="openClassForm('${c.id}')"><div class="class-chip-time">${c.start_time?.slice(0,5)} – ${c.end_time?.slice(0,5)}</div><div class="class-chip-subject">${esc(c.subject||'')}</div><div class="class-chip-info">${t?esc(t.name):'—'} · ${esc(c.students_label||'')}</div></div>`;}).join(''):'<div style="color:var(--text-light);font-size:.8rem;padding:.5rem 0">Sense classes</div>'}<button class="btn btn-ghost btn-sm" onclick="openClassForm(null,${day.order})" style="margin-top:.25rem;width:100%">+ Afegir</button></div></div>`;
  }).join('');
}
function openClassForm(id=null,dayOrder=null){
  editingId=id;const c=id?classes.find(x=>x.id===id):{};if(id&&!c){showToast('Classe no trobada','error');return;}
  const to=teachers.map(t=>`<option value="${t.id}" ${c.teacher_id===t.id?'selected':''}>${esc(t.name)} ${esc(t.surname)}</option>`).join('');
  const targetDay=c.day_order||dayOrder||1;
  const dO=DAYS.map(d=>`<option value="${d.order}" ${targetDay===d.order?'selected':''}>${d.label}</option>`).join('');
  openModal(id?'Editar classe':'Nova classe',`<div class="form-row"><div class="form-group"><label>Dia *</label><select class="input" id="f_day">${dO}</select></div><div class="form-group"><label>Assignatura</label><input class="input" id="f_subject" value="${esc(c.subject||'')}"/></div></div><div class="form-row"><div class="form-group"><label>Hora inici *</label><input class="input" id="f_start" type="time" value="${c.start_time?.slice(0,5)||''}"/></div><div class="form-group"><label>Hora fi *</label><input class="input" id="f_end" type="time" value="${c.end_time?.slice(0,5)||''}"/></div></div><div class="form-group"><label>Professor</label><select class="input" id="f_teacher"><option value="">Sense professor</option>${to}</select></div><div class="form-group"><label>Alumnes</label><input class="input" id="f_students_label" value="${esc(c.students_label||'')}"/></div><div class="form-group"><label>Aula</label><input class="input" id="f_room" value="${esc(c.room||'')}"/></div><div class="form-group"><label>Observacions</label><textarea class="input" id="f_notes">${esc(c.notes||'')}</textarea></div><div class="form-actions"><button class="btn btn-primary" onclick="saveClass()">💾 Guardar</button>${id?`<button class="btn btn-danger" onclick="deleteClass('${id}')">Eliminar</button>`:''}<button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button></div>`);
}
async function saveClass(){
  const data={day_order:parseInt(document.getElementById('f_day').value),subject:document.getElementById('f_subject').value.trim(),start_time:document.getElementById('f_start').value,end_time:document.getElementById('f_end').value,teacher_id:document.getElementById('f_teacher').value||null,students_label:document.getElementById('f_students_label').value.trim(),room:document.getElementById('f_room').value.trim(),notes:document.getElementById('f_notes').value.trim()};
  if(!data.start_time||!data.end_time){showToast('Hora inici i fi obligatòries','error');return;}
  if(data.start_time>=data.end_time){showToast("L'hora de fi ha de ser posterior",'error');return;}
  try{if(editingId){const{error}=await sb.from('classes').update(data).eq('id',editingId);if(error)throw error;classes=classes.map(c=>c.id===editingId?{...c,...data}:c);showToast('Classe actualitzada ✓');}else{const{data:res,error}=await sb.from('classes').insert(data).select().single();if(error)throw error;classes.push(res);showToast('Classe afegida ✓');}closeModal();renderSchedule();}catch(e){showToast('Error: '+e.message,'error');}
}
async function deleteClass(id){
  confirmAction('Eliminar aquesta classe?',async()=>{try{const{error}=await sb.from('classes').delete().eq('id',id);if(error)throw error;classes=classes.filter(c=>c.id!==id);closeModal();renderSchedule();showToast('Classe eliminada');}catch(e){showToast('Error: '+e.message,'error');}});
}

// ── PAYMENTS ───────────────────────────────────────────────
function pBadge(s){return s==='pagat'?'badge-green':s==='vençut'?'badge-red':'badge-yellow';}
function renderPayments(){
  const stSel=document.getElementById('paymentStudentFilter'),mSel=document.getElementById('paymentMonthFilter');
  if(stSel){const cur=stSel.value;stSel.innerHTML=`<option value="">Tots els alumnes</option>`+students.map(s=>`<option value="${s.id}" ${cur===s.id?'selected':''}>${esc(s.name)} ${esc(s.surname)}</option>`).join('');stSel.value=cur;}
  const months=[...new Set(payments.map(p=>p.payment_month).filter(Boolean))].sort().reverse();
  if(mSel){const cur=mSel.value;mSel.innerHTML=`<option value="">Tots els mesos</option>`+months.map(m=>`<option value="${m}" ${cur===m?'selected':''}>${m}</option>`).join('');mSel.value=cur;}
  filterPayments();
}
function filterPayments(){
  const stF=document.getElementById('paymentStudentFilter')?.value||'',stS=document.getElementById('paymentStatusFilter')?.value||'',mF=document.getElementById('paymentMonthFilter')?.value||'';
  const list=payments.filter(p=>(!stF||p.student_id===stF)&&(!stS||p.status===stS)&&(!mF||p.payment_month===mF));
  const tbody=document.getElementById('paymentsTbody'),empty=document.getElementById('paymentsEmpty'),table=document.getElementById('paymentsTable');
  if(!list.length){if(table)table.style.display='none';if(empty)empty.style.display='';return;}
  if(table)table.style.display='';if(empty)empty.style.display='none';
  tbody.innerHTML=list.map(p=>{const st=students.find(s=>s.id===p.student_id);return`<tr><td style="font-weight:600">${st?esc(st.name)+' '+esc(st.surname):'—'}</td><td>${esc(p.payment_month||'—')}</td><td style="font-weight:600">${formatMoney(p.amount)}</td><td>${formatDate(p.due_date)}</td><td>${esc(p.payment_method||'—')}</td><td><span class="badge ${pBadge(p.status)}">${esc(p.status)}</span></td><td><div class="actions">${p.status!=='pagat'?`<button class="btn btn-green btn-sm" onclick="markPaid('${p.id}')">✓ Pagat</button>`:''}<button class="btn btn-icon btn-sm" onclick="openPaymentForm('${p.id}')">✏️</button><button class="btn btn-icon btn-sm" onclick="deletePayment('${p.id}')">🗑️</button></div></td></tr>`;}).join('');
}
function openPaymentForm(id=null){
  editingId=id;const p=id?payments.find(x=>x.id===id):{};if(id&&!p){showToast('Pagament no trobat','error');return;}
  const so=students.map(s=>`<option value="${s.id}" ${p.student_id===s.id?'selected':''}>${esc(s.name)} ${esc(s.surname)}</option>`).join('');
  const md=p.payment_month||currentMonth();const methods=['','Efectiu','Transferència','Bizum','Targeta','Altre'];
  openModal(id?'Editar pagament':'Nou pagament',`<div class="form-group"><label>Alumne *</label><select class="input" id="f_student"><option value="">Selecciona alumne</option>${so}</select></div><div class="form-row"><div class="form-group"><label>Mes (YYYY-MM) *</label><input class="input" id="f_month" value="${esc(md)}"/></div><div class="form-group"><label>Import (€) *</label><input class="input" id="f_amount" type="number" step="0.01" min="0" value="${p.amount||''}"/></div></div><div class="form-row"><div class="form-group"><label>Data venciment</label><input class="input" id="f_due" type="date" value="${p.due_date||''}"/></div><div class="form-group"><label>Data pagament</label><input class="input" id="f_paid_date" type="date" value="${p.paid_date||''}"/></div></div><div class="form-row"><div class="form-group"><label>Estat</label><select class="input" id="f_status">${['pendent','pagat','vençut'].map(o=>`<option value="${o}" ${(p.status||'pendent')===o?'selected':''}>${o}</option>`).join('')}</select></div><div class="form-group"><label>Mètode</label><select class="input" id="f_method">${methods.map(o=>`<option value="${o}" ${p.payment_method===o?'selected':''}>${o||'—'}</option>`).join('')}</select></div></div><div class="form-group"><label>Observacions</label><textarea class="input" id="f_notes">${esc(p.notes||'')}</textarea></div><div class="form-actions"><button class="btn btn-primary" onclick="savePayment()">💾 Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button></div>`);
}
async function savePayment(){
  const data={student_id:document.getElementById('f_student').value||null,payment_month:document.getElementById('f_month').value.trim(),amount:parseFloat(document.getElementById('f_amount').value)||0,due_date:document.getElementById('f_due').value||null,paid_date:document.getElementById('f_paid_date').value||null,status:document.getElementById('f_status').value,payment_method:document.getElementById('f_method').value||null,notes:document.getElementById('f_notes').value.trim()};
  if(!data.student_id||!data.payment_month){showToast('Alumne i mes obligatoris','error');return;}
  if(!/^\d{4}-\d{2}$/.test(data.payment_month)){showToast('Format mes incorrecte (YYYY-MM)','error');return;}
  try{if(editingId){const{error}=await sb.from('payments').update(data).eq('id',editingId);if(error)throw error;payments=payments.map(p=>p.id===editingId?{...p,...data}:p);showToast('Pagament actualitzat ✓');}else{const{data:res,error}=await sb.from('payments').insert(data).select().single();if(error)throw error;payments.push(res);showToast('Pagament afegit ✓');}closeModal();renderPayments();}catch(e){showToast('Error: '+e.message,'error');}
}
async function markPaid(id){
  try{const td=todayStr();const{error}=await sb.from('payments').update({status:'pagat',paid_date:td}).eq('id',id);if(error)throw error;payments=payments.map(p=>p.id===id?{...p,status:'pagat',paid_date:td}:p);renderPayments();showToast('Pagament marcat com a pagat ✓');}catch(e){showToast('Error: '+e.message,'error');}
}
async function deletePayment(id){
  confirmAction('Eliminar aquest pagament?',async()=>{try{const{error}=await sb.from('payments').delete().eq('id',id);if(error)throw error;payments=payments.filter(p=>p.id!==id);renderPayments();showToast('Pagament eliminat');}catch(e){showToast('Error: '+e.message,'error');}});
}

// ── FINANCES ───────────────────────────────────────────────
function renderFinances(){
  const month=currentMonth();
  const inc=payments.filter(p=>p.status==='pagat'&&(p.payment_month||'').startsWith(month)).reduce((a,p)=>a+parseFloat(p.amount||0),0);
  const exp=expenses.filter(e=>e.date&&e.date.startsWith(month)).reduce((a,e)=>a+parseFloat(e.amount||0),0);
  const bal=inc-exp;
  const sm=document.getElementById('financeSummary');
  if(sm)sm.innerHTML=`<div class="finance-card"><div class="finance-card-label">Ingressos del mes</div><div class="finance-card-value income">${formatMoney(inc)}</div></div><div class="finance-card"><div class="finance-card-label">Gastos del mes</div><div class="finance-card-value expense">${formatMoney(exp)}</div></div><div class="finance-card"><div class="finance-card-label">Balanç estimat</div><div class="finance-card-value ${bal>=0?'balance-pos':'balance-neg'}">${formatMoney(bal)}</div></div>`;
  const months=[...new Set(expenses.map(e=>e.date?.slice(0,7)).filter(Boolean))].sort().reverse();
  const mSel=document.getElementById('expenseMonthFilter');
  if(mSel){const cur=mSel.value;mSel.innerHTML=`<option value="">Tots els mesos</option>`+months.map(m=>`<option value="${m}" ${cur===m?'selected':''}>${m}</option>`).join('');mSel.value=cur;}
  filterExpenses();
}
function filterExpenses(){
  const mF=document.getElementById('expenseMonthFilter')?.value||'',cF=document.getElementById('expenseCategoryFilter')?.value||'';
  const list=expenses.filter(e=>(!mF||e.date?.startsWith(mF))&&(!cF||e.category===cF));
  const tbody=document.getElementById('expensesTbody'),empty=document.getElementById('expensesEmpty');
  if(!tbody)return;
  if(!list.length){tbody.innerHTML='';if(empty)empty.style.display='';return;}
  if(empty)empty.style.display='none';
  tbody.innerHTML=list.map(e=>`<tr><td style="font-weight:600">${esc(e.concept||'—')}</td><td><span class="badge badge-blue">${esc(e.category||'—')}</span></td><td style="font-weight:600;color:var(--red)">${formatMoney(e.amount)}</td><td>${formatDate(e.date)}</td><td>${esc(e.payment_method||'—')}</td><td><div class="actions"><button class="btn btn-icon btn-sm" onclick="openExpenseForm('${e.id}')">✏️</button><button class="btn btn-icon btn-sm" onclick="deleteExpense('${e.id}')">🗑️</button></div></td></tr>`).join('');
}
function openExpenseForm(id=null){
  editingId=id;const e=id?expenses.find(x=>x.id===id):{};if(id&&!e){showToast('Gasto no trobat','error');return;}
  const cats=['Lloguer','Material','Professors','Subministraments','Publicitat','Manteniment','Altres'];
  const methods=['','Efectiu','Transferència','Bizum','Targeta','Altre'];
  openModal(id?'Editar gasto':'Nou gasto',`<div class="form-group"><label>Concepte *</label><input class="input" id="f_concept" value="${esc(e.concept||'')}"/></div><div class="form-row"><div class="form-group"><label>Categoria</label><select class="input" id="f_category">${cats.map(c=>`<option value="${c}" ${(e.category||'Altres')===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="form-group"><label>Import (€) *</label><input class="input" id="f_amount" type="number" step="0.01" min="0" value="${e.amount||''}"/></div></div><div class="form-row"><div class="form-group"><label>Data *</label><input class="input" id="f_date" type="date" value="${e.date||todayStr()}"/></div><div class="form-group"><label>Mètode</label><select class="input" id="f_method">${methods.map(o=>`<option value="${o}" ${e.payment_method===o?'selected':''}>${o||'—'}</option>`).join('')}</select></div></div><div class="form-group"><label>Observacions</label><textarea class="input" id="f_notes">${esc(e.notes||'')}</textarea></div><div class="form-actions"><button class="btn btn-primary" onclick="saveExpense()">💾 Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button></div>`);
}
async function saveExpense(){
  const data={concept:document.getElementById('f_concept').value.trim(),category:document.getElementById('f_category').value,amount:parseFloat(document.getElementById('f_amount').value)||0,date:document.getElementById('f_date').value,payment_method:document.getElementById('f_method').value||null,notes:document.getElementById('f_notes').value.trim()};
  if(!data.concept||!data.date){showToast('Concepte i data obligatoris','error');return;}
  try{if(editingId){const{error}=await sb.from('expenses').update(data).eq('id',editingId);if(error)throw error;expenses=expenses.map(e=>e.id===editingId?{...e,...data}:e);showToast('Gasto actualitzat ✓');}else{const{data:res,error}=await sb.from('expenses').insert(data).select().single();if(error)throw error;expenses.push(res);showToast('Gasto afegit ✓');}closeModal();renderFinances();}catch(e){showToast('Error: '+e.message,'error');}
}
async function deleteExpense(id){
  confirmAction('Eliminar aquest gasto?',async()=>{try{const{error}=await sb.from('expenses').delete().eq('id',id);if(error)throw error;expenses=expenses.filter(e=>e.id!==id);renderFinances();showToast('Gasto eliminat');}catch(e){showToast('Error: '+e.message,'error');}});
}

// ── TASKS ──────────────────────────────────────────────────
function renderTasks(){filterTasks();}
function filterTasks(){
  const sF=document.getElementById('taskStatusFilter')?.value||'',pF=document.getElementById('taskPriorityFilter')?.value||'';
  const list=tasks.filter(t=>(!sF||t.status===sF)&&(!pF||t.priority===pF));
  const cont=document.getElementById('tasksList'),empty=document.getElementById('tasksEmpty');
  if(!cont)return;
  if(!list.length){cont.innerHTML='';if(empty)empty.style.display='';return;}
  if(empty)empty.style.display='none';
  cont.innerHTML=list.map(t=>`<div class="task-card ${esc(t.status)}" id="task-${t.id}"><div class="priority-dot priority-${esc(t.priority)}"></div><div class="task-check" onclick="toggleTask('${t.id}','${t.status}')">${t.status==='completada'?'✓':''}</div><div class="task-body"><div class="task-title">${esc(t.title)}</div>${t.description?`<div class="task-desc">${esc(t.description)}</div>`:''}<div class="task-meta"><span class="badge ${t.priority==='alta'?'badge-red':t.priority==='mitja'?'badge-yellow':'badge-green'}">${esc(t.priority)}</span>${t.category?`<span class="badge badge-gray">${esc(t.category)}</span>`:''}${t.date?`<span style="color:var(--text-sec);font-size:.78rem">${formatDate(t.date)}</span>`:''}</div></div><div class="task-actions"><button class="btn btn-icon btn-sm" onclick="openTaskForm('${t.id}')">✏️</button><button class="btn btn-icon btn-sm" onclick="deleteTask('${t.id}')">🗑️</button></div></div>`).join('');
}
async function quickAddTask(){
  const el=document.getElementById('quickTaskTitle');const title=el?.value.trim()||'';
  if(!title){showToast('Escriu el títol','warning');return;}
  const data={title,priority:document.getElementById('quickTaskPriority')?.value||'mitja',category:document.getElementById('quickTaskCategory')?.value||null,status:'pendent',date:todayStr()};
  try{const{data:res,error}=await sb.from('tasks').insert(data).select().single();if(error)throw error;tasks.unshift(res);if(el)el.value='';renderTasks();showToast('Tasca afegida ✓');}catch(e){showToast('Error: '+e.message,'error');}
}
function openTaskForm(id=null){
  editingId=id;const t=id?tasks.find(x=>x.id===id):{};if(id&&!t){showToast('Tasca no trobada','error');return;}
  const cats=['','pagaments','alumnes','professors','organització','trucada','material','altre'];
  openModal(id?'Editar tasca':'Nova tasca',`<div class="form-group"><label>Títol *</label><input class="input" id="f_title" value="${esc(t.title||'')}"/></div><div class="form-group"><label>Descripció</label><textarea class="input" id="f_description">${esc(t.description||'')}</textarea></div><div class="form-row"><div class="form-group"><label>Prioritat</label><select class="input" id="f_priority">${['baixa','mitja','alta'].map(o=>`<option value="${o}" ${(t.priority||'mitja')===o?'selected':''}>${o}</option>`).join('')}</select></div><div class="form-group"><label>Estat</label><select class="input" id="f_status"><option value="pendent" ${(t.status==='pendent'||!t.status)?'selected':''}>Pendent</option><option value="completada" ${t.status==='completada'?'selected':''}>Completada</option></select></div></div><div class="form-row"><div class="form-group"><label>Data</label><input class="input" id="f_date" type="date" value="${t.date||todayStr()}"/></div><div class="form-group"><label>Categoria</label><select class="input" id="f_category">${cats.map(o=>`<option value="${o}" ${(t.category||'')===o?'selected':''}>${o||'Cap'}</option>`).join('')}</select></div></div><div class="form-actions"><button class="btn btn-primary" onclick="saveTask()">💾 Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button></div>`);
}
async function saveTask(){
  const data={title:document.getElementById('f_title').value.trim(),description:document.getElementById('f_description').value.trim(),priority:document.getElementById('f_priority').value,status:document.getElementById('f_status').value,date:document.getElementById('f_date').value,category:document.getElementById('f_category').value||null};
  if(!data.title){showToast('Títol obligatori','error');return;}
  try{if(editingId){const{error}=await sb.from('tasks').update(data).eq('id',editingId);if(error)throw error;tasks=tasks.map(t=>t.id===editingId?{...t,...data}:t);showToast('Tasca actualitzada ✓');}else{const{data:res,error}=await sb.from('tasks').insert(data).select().single();if(error)throw error;tasks.unshift(res);showToast('Tasca afegida ✓');}closeModal();renderTasks();}catch(e){showToast('Error: '+e.message,'error');}
}
async function toggleTask(id,cur){
  const ns=cur==='completada'?'pendent':'completada';
  try{const{error}=await sb.from('tasks').update({status:ns}).eq('id',id);if(error)throw error;tasks=tasks.map(t=>t.id===id?{...t,status:ns}:t);renderTasks();if(ns==='completada')showToast('Tasca completada! ✓');}catch(e){showToast('Error: '+e.message,'error');}
}
async function deleteTask(id){
  confirmAction('Eliminar aquesta tasca?',async()=>{try{const{error}=await sb.from('tasks').delete().eq('id',id);if(error)throw error;tasks=tasks.filter(t=>t.id!==id);renderTasks();showToast('Tasca eliminada');}catch(e){showToast('Error: '+e.message,'error');}});
}

// ── INIT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {

  // window.supabase és el global que exposa el CDN d'unpkg
  try {
    if (typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL) {
      throw new Error('SUPABASE_URL no configurat a supabase-config.js');
    }
    if (typeof SUPABASE_ANON_KEY === 'undefined' || !SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_ANON_KEY no configurat a supabase-config.js');
    }

    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase inicialitzat correctament');

  } catch(e) {
    console.error('❌ Error inicialitzant Supabase:', e.message);
    showToast('Error: ' + e.message, 'error');
    showLoadError(e.message);
    // Atura aquí, no intentis carregar dades
    initUI();
    return;
  }

  initUI();
  loadAll();
});

function initUI() {
  // Navegació lateral
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      navigate(item.dataset.section);
    });
  });

  // Tanca sidebar clicant fora (mòbil)
  document.addEventListener('click', function(e){
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.menu-toggle');
    if(sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle){
      sidebar.classList.remove('open');
    }
  });

  // Tanca confirm clicant fora
  const co = document.getElementById('confirmOverlay');
  if(co) co.addEventListener('click', function(e){ if(e.target===co) co.classList.remove('active'); });

  // Rellotge
  updateClock();
  setInterval(updateClock, 60000);
}
