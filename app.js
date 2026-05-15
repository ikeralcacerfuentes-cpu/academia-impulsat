// ============================================================
//  app.js — Acadèmia Impulsa't
// ============================================================

// ── Supabase init ──────────────────────────────────────────
let sb;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch(e) {
  console.warn("Supabase no inicialitzat. Revisa supabase-config.js");
}

// ── State ──────────────────────────────────────────────────
let students  = [];
let teachers  = [];
let classes   = [];
let payments  = [];
let expenses  = [];
let tasks     = [];
let editingId = null;
let dataLoaded = false;

// ── Dates / Clock ──────────────────────────────────────────
const TODAY = new Date();
const DAYS_CA = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
const MONTHS_CA = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];

function todayStr() {
  const y = TODAY.getFullYear();
  const m = String(TODAY.getMonth()+1).padStart(2,'0');
  const d = String(TODAY.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${MONTHS_CA[dt.getMonth()]} ${dt.getFullYear()}`;
}

function formatMoney(n) {
  return parseFloat(n || 0).toFixed(2).replace('.', ',') + ' €';
}

function currentMonth() {
  const m = TODAY.getMonth() + 1;
  const y = TODAY.getFullYear();
  return `${y}-${String(m).padStart(2,'0')}`;
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const el = document.getElementById('currentTime');
  if (el) el.textContent = `${h}:${m}`;
  const sd = document.getElementById('sidebarDate');
  if (sd) sd.innerHTML = `${DAYS_CA[now.getDay()]}<br>${now.getDate()} ${MONTHS_CA[now.getMonth()]} ${now.getFullYear()}`;
}

// ── Toast ──────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast show toast-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Confirm ────────────────────────────────────────────────
function confirmAction(msg, cb) {
  document.getElementById('confirmMessage').textContent = msg;
  const overlay = document.getElementById('confirmOverlay');
  overlay.classList.add('active');
  const okBtn = document.getElementById('confirmOk');
  const newOk = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  newOk.addEventListener('click', () => {
    overlay.classList.remove('active');
    cb();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const confirmOverlay = document.getElementById('confirmOverlay');
  if (confirmOverlay) {
    confirmOverlay.addEventListener('click', (e) => {
      if (e.target === confirmOverlay) confirmOverlay.classList.remove('active');
    });
  }
});

// ── Modal ──────────────────────────────────────────────────
function openModal(title, html) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  editingId = null;
}

// ── Navigation ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const sec = item.dataset.section;
      navigate(sec);
      document.getElementById('sidebar').classList.remove('open');
    });
  });
});

function navigate(sec) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.section === sec));
  document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === `section-${sec}`));
  const titles = {
    dashboard: 'Dashboard',
    students: 'Alumnes',
    teachers: 'Professors',
    schedule: 'Horaris',
    payments: 'Pagaments',
    finances: 'Finances',
    tasks: 'Tasques'
  };
  document.getElementById('pageTitle').textContent = titles[sec] || sec;

  if (!dataLoaded) return;

  if (sec === 'dashboard')  loadDashboard();
  if (sec === 'students')   renderStudents();
  if (sec === 'teachers')   renderTeachers();
  if (sec === 'schedule')   renderSchedule();
  if (sec === 'payments')   renderPayments();
  if (sec === 'finances')   renderFinances();
  if (sec === 'tasks')      renderTasks();
}

// ── Load all data ──────────────────────────────────────────
async function loadAll() {
  if (!sb) {
    showToast("Configura les credencials de Supabase!", 'error');
    clearLoadingStats();
    return;
  }
  try {
    const [s, t, c, p, e, k] = await Promise.all([
      sb.from('students').select('*').order('name'),
      sb.from('teachers').select('*').order('name'),
      sb.from('classes').select('*').order('day_order').order('start_time'),
      sb.from('payments').select('*').order('due_date', { ascending: false }),
      sb.from('expenses').select('*').order('date', { ascending: false }),
      sb.from('tasks').select('*').order('created_at', { ascending: false }),
    ]);

    if (s.error) throw s.error;
    if (t.error) throw t.error;
    if (c.error) throw c.error;
    if (p.error) throw p.error;
    if (e.error) throw e.error;
    if (k.error) throw k.error;

    students = s.data || [];
    teachers = t.data || [];
    classes  = c.data || [];
    payments = p.data || [];
    expenses = e.data || [];
    tasks    = k.data || [];

    dataLoaded = true;

    await updatePaymentStatuses();
    await autoRenewPayments();
    loadDashboard();
  } catch(err) {
    console.error('Error carregant dades:', err);
    showToast("Error carregant dades: " + (err.message || err), 'error');
    clearLoadingStats();
  }
}

function clearLoadingStats() {
  const statsGrid = document.getElementById('statsGrid');
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-sec)">
        ⚠️ No s'han pogut carregar les dades. Revisa la connexió i les credencials de Supabase.
      </div>
    `;
  }
}

// ── Auto-update payment status ─────────────────────────────
async function updatePaymentStatuses() {
  const today = todayStr();
  const toUpdate = payments.filter(p => p.status === 'pendent' && p.due_date && p.due_date < today);
  if (!toUpdate.length) return;
  const ids = toUpdate.map(p => p.id);
  try {
    await sb.from('payments').update({ status: 'vençut' }).in('id', ids);
    toUpdate.forEach(p => { p.status = 'vençut'; });
  } catch(e) {
    console.warn('Error actualitzant estats de pagaments:', e);
  }
}

// ── Auto-renew: +28 dies des de la data d'alta ─────────────
async function autoRenewPayments() {
  const today = todayStr();
  const activeStudents = students.filter(s => s.status === 'actiu' && s.enrollment_date);

  for (const s of activeStudents) {
    // Calcula el pròxim venciment (+28 dies des de enrollment_date, iterativament)
    let nextDue = new Date(s.enrollment_date + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');

    // Avança de 28 en 28 fins que nextDue >= avui
    while (nextDue < todayDate) {
      nextDue.setDate(nextDue.getDate() + 28);
    }

    const nextDueStr = nextDue.toISOString().slice(0, 10);

    // Comprova si ja existeix pagament per aquesta data de venciment
    const exists = payments.some(p => p.student_id === s.id && p.due_date === nextDueStr);
    if (!exists) {
      const newPayment = {
        student_id:    s.id,
        payment_month: nextDueStr.slice(0, 7),
        amount:        parseFloat(s.current_price || s.monthly_price || 0),
        due_date:      nextDueStr,
        status:        'pendent',
      };
      try {
        const { data: res, error } = await sb.from('payments').insert(newPayment).select().single();
        if (!error && res) payments.push(res);
      } catch(e) {
        console.warn('Error creant renovació automàtica:', e);
      }
    }
  }
}

// ── DASHBOARD ─────────────────────────────────────────────
function loadDashboard() {
  const month = currentMonth();
  const activeStudents = students.filter(s => s.status === 'actiu');
  const pendingPayments = payments.filter(p => p.status === 'pendent');
  const overduePayments = payments.filter(p => p.status === 'vençut');
  const monthIncome = payments
    .filter(p => p.status === 'pagat' && (p.payment_month || '').startsWith(month))
    .reduce((a, p) => a + parseFloat(p.amount || 0), 0);
  const monthExpenses = expenses
    .filter(e => e.date && e.date.startsWith(month))
    .reduce((a, e) => a + parseFloat(e.amount || 0), 0);
  const balance = monthIncome - monthExpenses;

  // Renovacions en els pròxims 7 dies (basades en +28 dies)
  const soon = [];
  activeStudents.forEach(s => {
    if (!s.enrollment_date) return;
    const todayDate = new Date(TODAY);
    todayDate.setHours(0,0,0,0);
    let nextDue = new Date(s.enrollment_date + 'T00:00:00');
    while (nextDue < todayDate) {
      nextDue.setDate(nextDue.getDate() + 28);
    }
    const diff = Math.ceil((nextDue - todayDate) / 86400000);
    if (diff >= 0 && diff <= 7) soon.push({ student: s, date: nextDue, diff });
  });
  soon.sort((a, b) => a.diff - b.diff);

  const statsGrid = document.getElementById('statsGrid');
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card stat-card-orange">
        <div class="stat-label">Ingressos del mes</div>
        <div class="stat-value income">${formatMoney(monthIncome)}</div>
        <div class="stat-accent"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Gastos del mes</div>
        <div class="stat-value expense">${formatMoney(monthExpenses)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Balanç estimat</div>
        <div class="stat-value ${balance >= 0 ? 'balance-pos' : 'balance-neg'}">${formatMoney(balance)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Alumnes actius</div>
        <div class="stat-value">${activeStudents.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total alumnes</div>
        <div class="stat-value">${students.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pagaments pendents</div>
        <div class="stat-value" style="color:var(--yellow)">${pendingPayments.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pagaments vençuts</div>
        <div class="stat-value" style="color:var(--red)">${overduePayments.length}</div>
      </div>
    `;
  }

  const alerts = [];
  if (overduePayments.length)
    alerts.push({ type: 'danger', msg: `⚠️ ${overduePayments.length} pagament(s) vençut(s) sense cobrar.` });
  if (soon.length)
    alerts.push({ type: 'warning', msg: `🔔 ${soon.length} alumne(s) amb renovació en menys de 7 dies.` });
  const highTasks = tasks.filter(t => t.priority === 'alta' && t.status === 'pendent');
  if (highTasks.length)
    alerts.push({ type: 'danger', msg: `🔴 ${highTasks.length} tasca(es) d'alta prioritat pendents.` });

  const alertsBar = document.getElementById('alertsBar');
  if (alertsBar) {
    alertsBar.innerHTML = alerts.map(a =>
      `<div class="alert alert-${a.type}">${a.msg}</div>`
    ).join('') || '';
  }

  const renewalCount = document.getElementById('renewalCount');
  const renewalList = document.getElementById('renewalList');
  if (renewalCount) renewalCount.textContent = soon.length;
  if (renewalList) {
    renewalList.innerHTML = soon.length
      ? soon.map(r => `
          <div class="item-row">
            <div>
              <div class="item-row-name">${esc(r.student.name)}${r.student.surname ? ' ' + esc(r.student.surname) : ''}</div>
              <div class="item-row-sub">${r.diff === 0 ? 'Avui' : `En ${r.diff} dia${r.diff > 1 ? 's' : ''}`}</div>
            </div>
            <div class="badge badge-yellow">${formatMoney(r.student.current_price || r.student.monthly_price)}</div>
          </div>
        `).join('')
      : '<div class="item-row" style="padding:1rem;color:var(--text-sec)">Cap renovació propera</div>';
  }

  const pendingCount = document.getElementById('pendingCount');
  const pendingList = document.getElementById('pendingList');
  if (pendingCount) pendingCount.textContent = pendingPayments.length + overduePayments.length;
  if (pendingList) {
    const allPending = [...overduePayments, ...pendingPayments].slice(0, 8);
    pendingList.innerHTML = allPending.length
      ? allPending.map(p => {
          const st = students.find(s => s.id === p.student_id);
          return `<div class="item-row">
            <div>
              <div class="item-row-name">${st ? esc(st.name) + (st.surname ? ' ' + esc(st.surname) : '') : '—'}</div>
              <div class="item-row-sub">${p.payment_month || ''}</div>
            </div>
            <span class="badge ${p.status === 'vençut' ? 'badge-red' : 'badge-yellow'}">${p.status}</span>
          </div>`;
        }).join('')
      : '<div class="item-row" style="padding:1rem;color:var(--text-sec)">Cap pagament pendent 🎉</div>';
  }

  const todayDayIdx = TODAY.getDay() === 0 ? 7 : TODAY.getDay();
  const todayClassesList = classes.filter(c => c.day_order === todayDayIdx);
  const todayClassesEl = document.getElementById('todayClasses');
  if (todayClassesEl) {
    todayClassesEl.innerHTML = todayClassesList.length
      ? todayClassesList
          .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
          .map(c => {
            const teacher = teachers.find(t => t.id === c.teacher_id);
            return `<div class="item-row">
              <div>
                <div class="item-row-name">${c.start_time?.slice(0,5)} — ${esc(c.subject || '')}</div>
                <div class="item-row-sub">${teacher ? esc(teacher.name + (teacher.surname ? ' ' + teacher.surname : '')) : ''} ${c.students_label ? '· ' + esc(c.students_label) : ''}</div>
              </div>
            </div>`;
          }).join('')
      : '<div class="item-row" style="padding:1rem;color:var(--text-sec)">No hi ha classes avui</div>';
  }

  const pendingTasks = tasks
    .filter(t => t.status === 'pendent')
    .sort((a, b) => {
      const pOrder = { alta: 0, mitja: 1, baixa: 2 };
      return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
    })
    .slice(0, 5);
  const todayTasksEl = document.getElementById('todayTasks');
  if (todayTasksEl) {
    todayTasksEl.innerHTML = pendingTasks.length
      ? pendingTasks.map(t => `
          <div class="item-row">
            <div>
              <div class="item-row-name">${esc(t.title)}</div>
              <div class="item-row-sub">${t.category || ''}</div>
            </div>
            <span class="badge ${t.priority === 'alta' ? 'badge-red' : t.priority === 'mitja' ? 'badge-yellow' : 'badge-green'}">${t.priority}</span>
          </div>
        `).join('')
      : '<div class="item-row" style="padding:1rem;color:var(--text-sec)">Totes les tasques fetes! ✅</div>';
  }
}

// ── XSS protection ─────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Collect unique values for filters ──────────────────────
function getUniqueSchools() {
  return [...new Set(students.map(s => s.school).filter(Boolean))].sort();
}
function getUniqueCourses() {
  return [...new Set(students.map(s => s.course).filter(Boolean))].sort();
}

// ════════════════════════════════════════════════
//  STUDENTS
// ════════════════════════════════════════════════
function populateStudentFilters() {
  const schoolSel = document.getElementById('studentSchoolFilter');
  const courseSel = document.getElementById('studentCourseFilter');
  if (schoolSel) {
    const current = schoolSel.value;
    schoolSel.innerHTML = `<option value="">Tots els col·legis</option>` +
      getUniqueSchools().map(s => `<option value="${esc(s)}" ${current === s ? 'selected' : ''}>${esc(s)}</option>`).join('');
  }
  if (courseSel) {
    const current = courseSel.value;
    courseSel.innerHTML = `<option value="">Tots els cursos</option>` +
      getUniqueCourses().map(c => `<option value="${esc(c)}" ${current === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
  }
}

function renderStudents() {
  populateStudentFilters();
  filterStudents();
}

function filterStudents() {
  const search  = (document.getElementById('studentSearch')?.value || '').toLowerCase().trim();
  const statusF = document.getElementById('studentStatusFilter')?.value || '';
  const schoolF = document.getElementById('studentSchoolFilter')?.value || '';
  const courseF = document.getElementById('studentCourseFilter')?.value || '';

  const list = students.filter(s => {
    const name = (s.name + ' ' + (s.surname || '')).toLowerCase();
    if (search && !name.includes(search)) return false;
    if (statusF && s.status !== statusF) return false;
    if (schoolF && s.school !== schoolF) return false;
    if (courseF && s.course !== courseF) return false;
    return true;
  });

  const tbody = document.getElementById('studentsTbody');
  const empty = document.getElementById('studentsEmpty');
  const table = document.getElementById('studentsTable');

  if (!list.length) {
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = '';
    return;
  }
  if (table) table.style.display = '';
  if (empty) empty.style.display = 'none';

  const statusBadge = { actiu: 'badge-green', pausat: 'badge-yellow', baixa: 'badge-gray' };

  tbody.innerHTML = list.map(s => {
    const pendingCount = payments.filter(p =>
      p.student_id === s.id && (p.status === 'pendent' || p.status === 'vençut')
    ).length;
    return `<tr>
      <td>
        <div style="font-weight:600">${esc(s.name)}${s.surname ? ' ' + esc(s.surname) : ''}</div>
        <div style="color:var(--text-sec);font-size:.78rem">${esc(s.email || '')}${s.locality ? ' · ' + esc(s.locality) : ''}</div>
      </td>
      <td>${esc(s.school || '—')}</td>
      <td>${esc(s.course || '—')}</td>
      <td>${esc(s.phone || '—')}</td>
      <td style="font-weight:600">${formatMoney(s.current_price || s.monthly_price)}</td>
      <td>
        <span class="badge ${statusBadge[s.status] || 'badge-gray'}">${esc(s.status)}</span>
        ${pendingCount ? `<span class="badge badge-red" style="margin-left:.35rem">${pendingCount} pend.</span>` : ''}
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-icon btn-sm" onclick="openStudentForm('${s.id}')" title="Editar">✏️</button>
          <button class="btn btn-icon btn-sm" onclick="deleteStudent('${s.id}')" title="Eliminar">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openStudentForm(id = null) {
  editingId = id;
  const s = id ? students.find(x => x.id === id) : {};
  if (id && !s) { showToast("Alumne no trobat", 'error'); return; }
  openModal(id ? 'Editar alumne' : 'Nou alumne', `
    <div class="form-row">
      <div class="form-group">
        <label>Nom *</label>
        <input class="input" id="f_name" value="${esc(s.name || '')}" placeholder="Nom" />
      </div>
      <div class="form-group">
        <label>Cognoms</label>
        <input class="input" id="f_surname" value="${esc(s.surname || '')}" placeholder="Cognoms" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Col·legi / Institut</label>
        <input class="input" id="f_school" value="${esc(s.school || '')}" placeholder="Nom del centre educatiu" list="schoolsList" />
        <datalist id="schoolsList">${getUniqueSchools().map(sc => `<option value="${esc(sc)}">`).join('')}</datalist>
      </div>
      <div class="form-group">
        <label>Curs / Nivell</label>
        <input class="input" id="f_course" value="${esc(s.course || '')}" placeholder="ex: 3r ESO" list="coursesList" />
        <datalist id="coursesList">${getUniqueCourses().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Localitat</label>
        <input class="input" id="f_locality" value="${esc(s.locality || '')}" placeholder="Localitat" />
      </div>
      <div class="form-group">
        <label>Nom pare/mare</label>
        <input class="input" id="f_parent_name" value="${esc(s.parent_name || '')}" placeholder="Nom del tutor" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Telèfon familiar</label>
        <input class="input" id="f_phone" value="${esc(s.phone || '')}" placeholder="600 000 000" />
      </div>
      <div class="form-group">
        <label>Email familiar</label>
        <input class="input" id="f_email" type="email" value="${esc(s.email || '')}" placeholder="email@exemple.com" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tarifa inicial (€)</label>
        <input class="input" id="f_initial_price" type="number" step="0.01" min="0" value="${s.initial_price || ''}" placeholder="0.00" />
      </div>
      <div class="form-group">
        <label>Tarifa actual (€)</label>
        <input class="input" id="f_current_price" type="number" step="0.01" min="0" value="${s.current_price || s.monthly_price || ''}" placeholder="0.00" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Data d'alta (per renovació automàtica)</label>
        <input class="input" id="f_enrollment_date" type="date" value="${s.enrollment_date || todayStr()}" />
      </div>
      <div class="form-group">
        <label>Estat</label>
        <select class="input" id="f_status">
          ${['actiu','pausat','baixa'].map(o => `<option value="${o}" ${(s.status||'actiu') === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Assignatures</label>
      <input class="input" id="f_subjects" value="${esc(s.subjects || '')}" placeholder="ex: Matemàtiques, Física" />
    </div>
    <div class="form-group">
      <label>Notes internes</label>
      <textarea class="input" id="f_notes">${esc(s.notes || '')}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveStudent()">💾 Guardar</button>
      <button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button>
    </div>
  `);
}

async function saveStudent() {
  const data = {
    name:             document.getElementById('f_name').value.trim(),
    surname:          document.getElementById('f_surname').value.trim(),
    school:           document.getElementById('f_school').value.trim(),
    course:           document.getElementById('f_course').value.trim(),
    locality:         document.getElementById('f_locality').value.trim(),
    parent_name:      document.getElementById('f_parent_name').value.trim(),
    status:           document.getElementById('f_status').value,
    subjects:         document.getElementById('f_subjects').value.trim(),
    phone:            document.getElementById('f_phone').value.trim(),
    email:            document.getElementById('f_email').value.trim(),
    initial_price:    parseFloat(document.getElementById('f_initial_price').value) || null,
    current_price:    parseFloat(document.getElementById('f_current_price').value) || 0,
    monthly_price:    parseFloat(document.getElementById('f_current_price').value) || 0,
    enrollment_date:  document.getElementById('f_enrollment_date').value || null,
    notes:            document.getElementById('f_notes').value.trim(),
  };
  if (!data.name) { showToast("El nom és obligatori", 'error'); return; }
  try {
    if (editingId) {
      const { error } = await sb.from('students').update(data).eq('id', editingId);
      if (error) throw error;
      students = students.map(s => s.id === editingId ? { ...s, ...data } : s);
      showToast("Alumne actualitzat ✓");
    } else {
      const { data: res, error } = await sb.from('students').insert(data).select().single();
      if (error) throw error;
      students.push(res);
      showToast("Alumne afegit ✓");
    }
    closeModal();
    renderStudents();
  } catch(e) { showToast("Error: " + e.message, 'error'); }
}

async function deleteStudent(id) {
  const s = students.find(x => x.id === id);
  confirmAction(`Eliminar l'alumne "${s?.name}${s?.surname ? ' ' + s.surname : ''}"? Aquesta acció és permanent.`, async () => {
    try {
      const { error } = await sb.from('students').delete().eq('id', id);
      if (error) throw error;
      students = students.filter(x => x.id !== id);
      payments = payments.filter(x => x.student_id !== id);
      renderStudents();
      showToast("Alumne eliminat");
    } catch(e) { showToast("Error: " + e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════
//  TEACHERS
// ════════════════════════════════════════════════
function renderTeachers() {
  const search = (document.getElementById('teacherSearch')?.value || '').toLowerCase().trim();
  const list = teachers.filter(t => {
    const name = (t.name + ' ' + (t.surname || '')).toLowerCase();
    return !search || name.includes(search);
  });

  const tbody = document.getElementById('teachersTbody');
  const empty = document.getElementById('teachersEmpty');
  const table = document.getElementById('teachersTable');

  if (!list.length) {
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = '';
    return;
  }
  if (table) table.style.display = '';
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = list.map(t => `<tr>
    <td style="font-weight:600">${esc(t.name)}${t.surname ? ' ' + esc(t.surname) : ''}</td>
    <td>${esc(t.subjects || '—')}</td>
    <td>${esc(t.phone || '—')}</td>
    <td>${esc(t.email || '—')}</td>
    <td><span class="badge ${t.status === 'actiu' || !t.status ? 'badge-green' : 'badge-gray'}">${t.status || 'actiu'}</span></td>
    <td>
      <div class="actions">
        <button class="btn btn-icon btn-sm" onclick="openTeacherForm('${t.id}')">✏️</button>
        <button class="btn btn-icon btn-sm" onclick="deleteTeacher('${t.id}')">🗑️</button>
      </div>
    </td>
  </tr>`).join('');
}

function filterTeachers() { renderTeachers(); }

function openTeacherForm(id = null) {
  editingId = id;
  const t = id ? teachers.find(x => x.id === id) : {};
  if (id && !t) { showToast("Professor no trobat", 'error'); return; }
  openModal(id ? 'Editar professor' : 'Nou professor', `
    <div class="form-row">
      <div class="form-group"><label>Nom *</label><input class="input" id="f_name" value="${esc(t.name || '')}" /></div>
      <div class="form-group"><label>Cognoms</label><input class="input" id="f_surname" value="${esc(t.surname || '')}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Telèfon</label><input class="input" id="f_phone" value="${esc(t.phone || '')}" /></div>
      <div class="form-group"><label>Email</label><input class="input" id="f_email" type="email" value="${esc(t.email || '')}" /></div>
    </div>
    <div class="form-group"><label>Assignatures</label><input class="input" id="f_subjects" value="${esc(t.subjects || '')}" /></div>
    <div class="form-group"><label>Disponibilitat / Horari</label>
      <input class="input" id="f_availability" value="${esc(t.availability || '')}" placeholder="ex: dilluns-divendres 16-20h" />
    </div>
    <div class="form-group"><label>Estat</label>
      <select class="input" id="f_status">
        <option value="actiu" ${(t.status === 'actiu' || !t.status) ? 'selected' : ''}>Actiu</option>
        <option value="inactiu" ${t.status === 'inactiu' ? 'selected' : ''}>Inactiu</option>
      </select>
    </div>
    <div class="form-group"><label>Notes</label><textarea class="input" id="f_notes">${esc(t.notes || '')}</textarea></div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveTeacher()">💾 Guardar</button>
      <button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button>
    </div>
  `);
}

async function saveTeacher() {
  const data = {
    name:         document.getElementById('f_name').value.trim(),
    surname:      document.getElementById('f_surname').value.trim(),
    phone:        document.getElementById('f_phone').value.trim(),
    email:        document.getElementById('f_email').value.trim(),
    subjects:     document.getElementById('f_subjects').value.trim(),
    availability: document.getElementById('f_availability').value.trim(),
    status:       document.getElementById('f_status').value,
    notes:        document.getElementById('f_notes').value.trim(),
  };
  if (!data.name) { showToast("El nom és obligatori", 'error'); return; }
  try {
    if (editingId) {
      const { error } = await sb.from('teachers').update(data).eq('id', editingId);
      if (error) throw error;
      teachers = teachers.map(t => t.id === editingId ? { ...t, ...data } : t);
      showToast("Professor actualitzat ✓");
    } else {
      const { data: res, error } = await sb.from('teachers').insert(data).select().single();
      if (error) throw error;
      teachers.push(res);
      showToast("Professor afegit ✓");
    }
    closeModal();
    renderTeachers();
  } catch(e) { showToast("Error: " + e.message, 'error'); }
}

async function deleteTeacher(id) {
  const t = teachers.find(x => x.id === id);
  confirmAction(`Eliminar el professor "${t?.name}${t?.surname ? ' ' + t.surname : ''}"?`, async () => {
    try {
      const { error } = await sb.from('teachers').delete().eq('id', id);
      if (error) throw error;
      teachers = teachers.filter(x => x.id !== id);
      renderTeachers();
      showToast("Professor eliminat");
    } catch(e) { showToast("Error: " + e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════
//  SCHEDULE
// ════════════════════════════════════════════════
const DAYS = [
  { label: 'Dilluns',   order: 1 },
  { label: 'Dimarts',   order: 2 },
  { label: 'Dimecres',  order: 3 },
  { label: 'Dijous',    order: 4 },
  { label: 'Divendres', order: 5 },
  { label: 'Dissabte',  order: 6 },
];

function renderSchedule() {
  const teacherSel = document.getElementById('scheduleTeacherFilter');
  const currentTeacher = teacherSel?.value || '';

  if (teacherSel) {
    teacherSel.innerHTML = `<option value="">Tots els professors</option>` +
      teachers.map(t => `<option value="${t.id}" ${currentTeacher === t.id ? 'selected' : ''}>${esc(t.name)}${t.surname ? ' ' + esc(t.surname) : ''}</option>`).join('');
  }

  const tFilter = teacherSel?.value || '';
  const todayDayIdx = TODAY.getDay() === 0 ? 7 : TODAY.getDay();

  const filtered = classes.filter(c => {
    if (tFilter && c.teacher_id !== tFilter) return false;
    return true;
  });

  const container = document.getElementById('weeklySchedule');
  if (!container) return;

  container.innerHTML = DAYS.map(day => {
    const dayCls = filtered
      .filter(c => c.day_order === day.order)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    const isToday = day.order === todayDayIdx;
    return `<div class="day-col">
      <div class="day-header ${isToday ? 'today' : ''}">
        <span>${day.label}</span>
        <span style="opacity:.6;font-size:.75rem">${dayCls.length} classe${dayCls.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="day-classes">
        ${dayCls.length
          ? dayCls.map(c => {
              const teacher = teachers.find(t => t.id === c.teacher_id);
              // Build student names from student_ids
              const studentNames = (c.student_ids || [])
                .map(sid => { const st = students.find(s => s.id === sid); return st ? st.name : null; })
                .filter(Boolean).join(', ');
              const label = studentNames || c.students_label || '';
              return `<div class="class-chip" onclick="openClassForm('${c.id}')">
                <div class="class-chip-time">${c.start_time?.slice(0,5)} – ${c.end_time?.slice(0,5)}</div>
                <div class="class-chip-subject">${esc(c.subject || '')}</div>
                <div class="class-chip-info">${teacher ? esc(teacher.name) : '—'} · ${esc(label)}</div>
              </div>`;
            }).join('')
          : '<div style="color:var(--text-light);font-size:.8rem;padding:.5rem 0">Sense classes</div>'
        }
        <button class="btn btn-ghost btn-sm" onclick="openClassForm(null, ${day.order})" style="margin-top:.25rem;width:100%">+ Afegir</button>
      </div>
    </div>`;
  }).join('');
}

function openClassForm(id = null, dayOrder = null) {
  editingId = id;
  const c = id ? classes.find(x => x.id === id) : {};
  if (id && !c) { showToast("Classe no trobada", 'error'); return; }

  const targetDay = c.day_order || dayOrder || 1;
  const dayOptions = DAYS.map(d =>
    `<option value="${d.order}" ${targetDay === d.order ? 'selected' : ''}>${d.label}</option>`
  ).join('');

  const teacherOptions = `<option value="">Sense professor</option>` +
    teachers.filter(t => !t.status || t.status === 'actiu').map(t =>
      `<option value="${t.id}" ${c.teacher_id === t.id ? 'selected' : ''}>${esc(t.name)}${t.surname ? ' ' + esc(t.surname) : ''}${t.subjects ? ' (' + esc(t.subjects) + ')' : ''}</option>`
    ).join('');

  // Student checkboxes — multi-select
  const selectedIds = c.student_ids || [];
  const activeStudents = students.filter(s => s.status === 'actiu');
  const studentCheckboxes = activeStudents.length
    ? activeStudents.map(s => `
        <label style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;cursor:pointer;font-size:.875rem;">
          <input type="checkbox" value="${s.id}" ${selectedIds.includes(s.id) ? 'checked' : ''}
            style="width:1rem;height:1rem;accent-color:var(--orange);cursor:pointer;" />
          <span>${esc(s.name)}${s.surname ? ' ' + esc(s.surname) : ''}</span>
          ${s.course ? `<span style="color:var(--text-sec);font-size:.75rem">${esc(s.course)}</span>` : ''}
        </label>
      `).join('')
    : '<p style="color:var(--text-sec);font-size:.85rem">No hi ha alumnes actius</p>';

  openModal(id ? 'Editar classe' : 'Nova classe', `
    <div class="form-row">
      <div class="form-group"><label>Dia *</label>
        <select class="input" id="f_day">${dayOptions}</select>
      </div>
      <div class="form-group"><label>Assignatura</label>
        <input class="input" id="f_subject" value="${esc(c.subject || '')}" placeholder="ex: Matemàtiques" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Hora inici *</label>
        <input class="input" id="f_start" type="time" value="${c.start_time?.slice(0,5) || ''}" />
      </div>
      <div class="form-group"><label>Hora fi *</label>
        <input class="input" id="f_end" type="time" value="${c.end_time?.slice(0,5) || ''}" />
      </div>
    </div>
    <div class="form-group"><label>Professor</label>
      <select class="input" id="f_teacher">${teacherOptions}</select>
    </div>
    <div class="form-group">
      <label>Alumnes <span style="font-weight:400;color:var(--text-sec)">(selecciona els inscrits)</span></label>
      <div style="border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:.65rem .85rem;max-height:180px;overflow-y:auto;background:var(--white);" id="studentCheckboxContainer">
        ${studentCheckboxes}
      </div>
    </div>
    <div class="form-group"><label>Aula</label>
      <input class="input" id="f_room" value="${esc(c.room || '')}" placeholder="Aula 1" />
    </div>
    <div class="form-group"><label>Observacions</label>
      <textarea class="input" id="f_notes">${esc(c.notes || '')}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveClass()">💾 Guardar</button>
      ${id ? `<button class="btn btn-danger" onclick="deleteClass('${id}')">Eliminar</button>` : ''}
      <button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button>
    </div>
  `);
}

async function saveClass() {
  const selectedStudentIds = Array.from(
    document.querySelectorAll('#studentCheckboxContainer input[type=checkbox]:checked')
  ).map(cb => cb.value);

  // Build label from selected students
  const studentNames = selectedStudentIds
    .map(sid => { const st = students.find(s => s.id === sid); return st ? st.name : null; })
    .filter(Boolean).join(', ');

  const data = {
    day_order:      parseInt(document.getElementById('f_day').value),
    subject:        document.getElementById('f_subject').value.trim(),
    start_time:     document.getElementById('f_start').value,
    end_time:       document.getElementById('f_end').value,
    teacher_id:     document.getElementById('f_teacher').value || null,
    student_ids:    selectedStudentIds,
    students_label: studentNames,
    room:           document.getElementById('f_room').value.trim(),
    notes:          document.getElementById('f_notes').value.trim(),
  };
  if (!data.start_time || !data.end_time) { showToast("Hora inici i fi obligatòries", 'error'); return; }
  if (data.start_time >= data.end_time) { showToast("L'hora de fi ha de ser posterior a l'inici", 'error'); return; }
  try {
    if (editingId) {
      const { error } = await sb.from('classes').update(data).eq('id', editingId);
      if (error) throw error;
      classes = classes.map(c => c.id === editingId ? { ...c, ...data } : c);
      showToast("Classe actualitzada ✓");
    } else {
      const { data: res, error } = await sb.from('classes').insert(data).select().single();
      if (error) throw error;
      classes.push(res);
      showToast("Classe afegida ✓");
    }
    closeModal();
    renderSchedule();
  } catch(e) { showToast("Error: " + e.message, 'error'); }
}

async function deleteClass(id) {
  confirmAction("Eliminar aquesta classe?", async () => {
    try {
      const { error } = await sb.from('classes').delete().eq('id', id);
      if (error) throw error;
      classes = classes.filter(c => c.id !== id);
      closeModal();
      renderSchedule();
      showToast("Classe eliminada");
    } catch(e) { showToast("Error: " + e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════
//  PAYMENTS
// ════════════════════════════════════════════════
function paymentStatusBadge(s) {
  if (s === 'pagat')  return 'badge-green';
  if (s === 'vençut') return 'badge-red';
  return 'badge-yellow';
}

function populatePaymentFilters() {
  const stSel = document.getElementById('paymentStudentFilter');
  if (stSel) {
    const current = stSel.value;
    stSel.innerHTML = `<option value="">Tots els alumnes</option>` +
      students.map(s => `<option value="${s.id}" ${current === s.id ? 'selected' : ''}>${esc(s.name)}${s.surname ? ' ' + esc(s.surname) : ''}</option>`).join('');
  }

  const months = [...new Set(payments.map(p => p.payment_month).filter(Boolean))].sort().reverse();
  const mSel = document.getElementById('paymentMonthFilter');
  if (mSel) {
    const current = mSel.value;
    mSel.innerHTML = `<option value="">Tots els mesos</option>` +
      months.map(m => `<option value="${m}" ${current === m ? 'selected' : ''}>${m}</option>`).join('');
  }
}

function renderPayments() {
  populatePaymentFilters();
  filterPayments();
}

function filterPayments() {
  const stF      = document.getElementById('paymentStudentFilter')?.value || '';
  const stStatus = document.getElementById('paymentStatusFilter')?.value || '';
  const mF       = document.getElementById('paymentMonthFilter')?.value || '';

  const list = payments.filter(p => {
    if (stF && p.student_id !== stF) return false;
    if (stStatus && p.status !== stStatus) return false;
    if (mF && p.payment_month !== mF) return false;
    return true;
  });

  const tbody = document.getElementById('paymentsTbody');
  const empty = document.getElementById('paymentsEmpty');
  const table = document.getElementById('paymentsTable');

  if (!list.length) {
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = '';
    return;
  }
  if (table) table.style.display = '';
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = list.map(p => {
    const st = students.find(s => s.id === p.student_id);
    return `<tr>
      <td style="font-weight:600">${st ? esc(st.name) + (st.surname ? ' ' + esc(st.surname) : '') : '—'}</td>
      <td>${esc(p.payment_month || '—')}</td>
      <td style="font-weight:600">${formatMoney(p.amount)}</td>
      <td>${formatDate(p.due_date)}</td>
      <td>${esc(p.payment_method || '—')}</td>
      <td><span class="badge ${paymentStatusBadge(p.status)}">${esc(p.status)}</span></td>
      <td>
        <div class="actions">
          ${p.status !== 'pagat' ? `<button class="btn btn-green btn-sm" onclick="markPaid('${p.id}')" title="Marcar com a pagat">✓ Pagat</button>` : ''}
          <button class="btn btn-icon btn-sm" onclick="openPaymentForm('${p.id}')">✏️</button>
          <button class="btn btn-icon btn-sm" onclick="deletePayment('${p.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openPaymentForm(id = null) {
  editingId = id;
  const p = id ? payments.find(x => x.id === id) : {};
  if (id && !p) { showToast("Pagament no trobat", 'error'); return; }
  const studentOptions = students.map(s =>
    `<option value="${s.id}" ${p.student_id === s.id ? 'selected' : ''}>${esc(s.name)}${s.surname ? ' ' + esc(s.surname) : ''}</option>`
  ).join('');
  const monthDefault = p.payment_month || currentMonth();

  openModal(id ? 'Editar pagament' : 'Nou pagament', `
    <div class="form-group"><label>Alumne *</label>
      <select class="input" id="f_student"><option value="">Selecciona alumne</option>${studentOptions}</select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Mes (YYYY-MM) *</label>
        <input class="input" id="f_month" value="${esc(monthDefault)}" placeholder="2025-01" />
      </div>
      <div class="form-group"><label>Import (€) *</label>
        <input class="input" id="f_amount" type="number" step="0.01" min="0" value="${p.amount || ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Data venciment</label>
        <input class="input" id="f_due" type="date" value="${p.due_date || ''}" />
      </div>
      <div class="form-group"><label>Data de pagament</label>
        <input class="input" id="f_paid_date" type="date" value="${p.paid_date || ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Estat</label>
        <select class="input" id="f_status">
          ${['pendent','pagat','vençut'].map(o => `<option value="${o}" ${(p.status || 'pendent') === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Mètode de pagament</label>
        <select class="input" id="f_method">
          ${['','Efectiu','Transferència','Bizum','Targeta','Altre'].map(o =>
            `<option value="${o}" ${p.payment_method === o ? 'selected' : ''}>${o || '—'}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label>Observacions</label>
      <textarea class="input" id="f_notes">${esc(p.notes || '')}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="savePayment()">💾 Guardar</button>
      <button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button>
    </div>
  `);
}

async function savePayment() {
  const data = {
    student_id:     document.getElementById('f_student').value || null,
    payment_month:  document.getElementById('f_month').value.trim(),
    amount:         parseFloat(document.getElementById('f_amount').value) || 0,
    due_date:       document.getElementById('f_due').value || null,
    paid_date:      document.getElementById('f_paid_date').value || null,
    status:         document.getElementById('f_status').value,
    payment_method: document.getElementById('f_method').value || null,
    notes:          document.getElementById('f_notes').value.trim(),
  };
  if (!data.student_id || !data.payment_month) { showToast("Alumne i mes obligatoris", 'error'); return; }
  if (!/^\d{4}-\d{2}$/.test(data.payment_month)) { showToast("Format del mes incorrecte (YYYY-MM)", 'error'); return; }
  try {
    if (editingId) {
      const { error } = await sb.from('payments').update(data).eq('id', editingId);
      if (error) throw error;
      payments = payments.map(p => p.id === editingId ? { ...p, ...data } : p);
      showToast("Pagament actualitzat ✓");
    } else {
      const { data: res, error } = await sb.from('payments').insert(data).select().single();
      if (error) throw error;
      payments.push(res);
      showToast("Pagament afegit ✓");
    }
    closeModal();
    renderPayments();
  } catch(e) { showToast("Error: " + e.message, 'error'); }
}

async function markPaid(id) {
  try {
    const today = todayStr();
    const { error } = await sb.from('payments').update({ status: 'pagat', paid_date: today }).eq('id', id);
    if (error) throw error;
    payments = payments.map(p => p.id === id ? { ...p, status: 'pagat', paid_date: today } : p);
    renderPayments();
    showToast("Pagament marcat com a pagat ✓", 'success');
  } catch(e) { showToast("Error: " + e.message, 'error'); }
}

async function deletePayment(id) {
  confirmAction("Eliminar aquest pagament?", async () => {
    try {
      const { error } = await sb.from('payments').delete().eq('id', id);
      if (error) throw error;
      payments = payments.filter(p => p.id !== id);
      renderPayments();
      showToast("Pagament eliminat");
    } catch(e) { showToast("Error: " + e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════
//  FINANCES
// ════════════════════════════════════════════════
function renderFinances() {
  const month = currentMonth();
  const monthIncome = payments
    .filter(p => p.status === 'pagat' && (p.payment_month || '').startsWith(month))
    .reduce((a, p) => a + parseFloat(p.amount || 0), 0);
  const monthExp = expenses
    .filter(e => e.date && e.date.startsWith(month))
    .reduce((a, e) => a + parseFloat(e.amount || 0), 0);
  const balance = monthIncome - monthExp;

  const summary = document.getElementById('financeSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="finance-card">
        <div class="finance-card-label">Ingressos del mes</div>
        <div class="finance-card-value income">${formatMoney(monthIncome)}</div>
        <div style="color:var(--text-sec);font-size:.78rem;margin-top:.25rem">Pagaments cobrats</div>
      </div>
      <div class="finance-card">
        <div class="finance-card-label">Gastos del mes</div>
        <div class="finance-card-value expense">${formatMoney(monthExp)}</div>
        <div style="color:var(--text-sec);font-size:.78rem;margin-top:.25rem">Despeses registrades</div>
      </div>
      <div class="finance-card">
        <div class="finance-card-label">Balanç estimat</div>
        <div class="finance-card-value ${balance >= 0 ? 'balance-pos' : 'balance-neg'}">${formatMoney(balance)}</div>
        <div style="color:var(--text-sec);font-size:.78rem;margin-top:.25rem">${balance >= 0 ? '✓ Positiu' : '⚠️ Negatiu'}</div>
      </div>
    `;
  }

  const allMonths = [...new Set(expenses.map(e => e.date?.slice(0,7)).filter(Boolean))].sort().reverse();
  const mSel = document.getElementById('expenseMonthFilter');
  if (mSel) {
    const current = mSel.value;
    mSel.innerHTML = `<option value="">Tots els mesos</option>` +
      allMonths.map(m => `<option value="${m}" ${current === m ? 'selected' : ''}>${m}</option>`).join('');
  }

  filterExpenses();
}

function filterExpenses() {
  const mF = document.getElementById('expenseMonthFilter')?.value || '';
  const cF = document.getElementById('expenseCategoryFilter')?.value || '';

  const list = expenses.filter(e => {
    if (mF && !e.date?.startsWith(mF)) return false;
    if (cF && e.category !== cF) return false;
    return true;
  });

  const tbody = document.getElementById('expensesTbody');
  const empty = document.getElementById('expensesEmpty');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = list.map(e => `<tr>
    <td style="font-weight:600">${esc(e.concept || '—')}</td>
    <td><span class="badge badge-blue">${esc(e.category || '—')}</span></td>
    <td style="font-weight:600;color:var(--red)">${formatMoney(e.amount)}</td>
    <td>${formatDate(e.date)}</td>
    <td>${esc(e.payment_method || '—')}</td>
    <td>
      <div class="actions">
        <button class="btn btn-icon btn-sm" onclick="openExpenseForm('${e.id}')">✏️</button>
        <button class="btn btn-icon btn-sm" onclick="deleteExpense('${e.id}')">🗑️</button>
      </div>
    </td>
  </tr>`).join('');
}

function openExpenseForm(id = null) {
  editingId = id;
  const e = id ? expenses.find(x => x.id === id) : {};
  if (id && !e) { showToast("Gasto no trobat", 'error'); return; }
  const cats = ['Lloguer','Material','Professors','Subministraments','Publicitat','Manteniment','Altres'];
  openModal(id ? 'Editar gasto' : 'Nou gasto', `
    <div class="form-group"><label>Concepte *</label>
      <input class="input" id="f_concept" value="${esc(e.concept || '')}" placeholder="Descripció del gasto" />
    </div>
    <div class="form-row">
      <div class="form-group"><label>Categoria</label>
        <select class="input" id="f_category">
          ${cats.map(c => `<option value="${c}" ${(e.category || 'Altres') === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Import (€) *</label>
        <input class="input" id="f_amount" type="number" step="0.01" min="0" value="${e.amount || ''}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Data *</label>
        <input class="input" id="f_date" type="date" value="${e.date || todayStr()}" />
      </div>
      <div class="form-group"><label>Mètode de pagament</label>
        <select class="input" id="f_method">
          ${['','Efectiu','Transferència','Bizum','Targeta','Altre'].map(o =>
            `<option value="${o}" ${e.payment_method === o ? 'selected' : ''}>${o || '—'}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label>Observacions</label>
      <textarea class="input" id="f_notes">${esc(e.notes || '')}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveExpense()">💾 Guardar</button>
      <button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button>
    </div>
  `);
}

async function saveExpense() {
  const data = {
    concept:        document.getElementById('f_concept').value.trim(),
    category:       document.getElementById('f_category').value,
    amount:         parseFloat(document.getElementById('f_amount').value) || 0,
    date:           document.getElementById('f_date').value,
    payment_method: document.getElementById('f_method').value || null,
    notes:          document.getElementById('f_notes').value.trim(),
  };
  if (!data.concept || !data.date) { showToast("Concepte i data obligatoris", 'error'); return; }
  try {
    if (editingId) {
      const { error } = await sb.from('expenses').update(data).eq('id', editingId);
      if (error) throw error;
      expenses = expenses.map(e => e.id === editingId ? { ...e, ...data } : e);
      showToast("Gasto actualitzat ✓");
    } else {
      const { data: res, error } = await sb.from('expenses').insert(data).select().single();
      if (error) throw error;
      expenses.push(res);
      showToast("Gasto afegit ✓");
    }
    closeModal();
    renderFinances();
  } catch(e) { showToast("Error: " + e.message, 'error'); }
}

async function deleteExpense(id) {
  confirmAction("Eliminar aquest gasto?", async () => {
    try {
      const { error } = await sb.from('expenses').delete().eq('id', id);
      if (error) throw error;
      expenses = expenses.filter(e => e.id !== id);
      renderFinances();
      showToast("Gasto eliminat");
    } catch(e) { showToast("Error: " + e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════
//  TASKS
// ════════════════════════════════════════════════
function renderTasks() { filterTasks(); }

function filterTasks() {
  const statusF   = document.getElementById('taskStatusFilter')?.value || '';
  const priorityF = document.getElementById('taskPriorityFilter')?.value || '';

  const list = tasks.filter(t => {
    if (statusF && t.status !== statusF) return false;
    if (priorityF && t.priority !== priorityF) return false;
    return true;
  });

  const container = document.getElementById('tasksList');
  const empty = document.getElementById('tasksEmpty');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = list.map(t => `
    <div class="task-card ${esc(t.status)}" id="task-${t.id}">
      <div class="priority-dot priority-${esc(t.priority)}"></div>
      <div class="task-check" onclick="toggleTask('${t.id}', '${t.status}')">
        ${t.status === 'completada' ? '✓' : ''}
      </div>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
        <div class="task-meta">
          <span class="badge ${t.priority === 'alta' ? 'badge-red' : t.priority === 'mitja' ? 'badge-yellow' : 'badge-green'}">${esc(t.priority)}</span>
          ${t.category ? `<span class="badge badge-gray">${esc(t.category)}</span>` : ''}
          ${t.date ? `<span style="color:var(--text-sec);font-size:.78rem">${formatDate(t.date)}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-icon btn-sm" onclick="openTaskForm('${t.id}')">✏️</button>
        <button class="btn btn-icon btn-sm" onclick="deleteTask('${t.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function quickAddTask() {
  const titleEl = document.getElementById('quickTaskTitle');
  const title = titleEl?.value.trim() || '';
  if (!title) { showToast("Escriu el títol de la tasca", 'warning'); return; }
  const data = {
    title,
    priority: document.getElementById('quickTaskPriority')?.value || 'mitja',
    category: document.getElementById('quickTaskCategory')?.value || null,
    status: 'pendent',
    date: todayStr(),
  };
  try {
    const { data: res, error } = await sb.from('tasks').insert(data).select().single();
    if (error) throw error;
    tasks.unshift(res);
    if (titleEl) titleEl.value = '';
    renderTasks();
    showToast("Tasca afegida ✓");
  } catch(e) { showToast("Error: " + e.message, 'error'); }
}

function openTaskForm(id = null) {
  editingId = id;
  const t = id ? tasks.find(x => x.id === id) : {};
  if (id && !t) { showToast("Tasca no trobada", 'error'); return; }
  openModal(id ? 'Editar tasca' : 'Nova tasca detallada', `
    <div class="form-group"><label>Títol *</label>
      <input class="input" id="f_title" value="${esc(t.title || '')}" />
    </div>
    <div class="form-group"><label>Descripció</label>
      <textarea class="input" id="f_description">${esc(t.description || '')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Prioritat</label>
        <select class="input" id="f_priority">
          ${['baixa','mitja','alta'].map(o => `<option value="${o}" ${(t.priority || 'mitja') === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Estat</label>
        <select class="input" id="f_status">
          <option value="pendent" ${(t.status === 'pendent' || !t.status) ? 'selected' : ''}>Pendent</option>
          <option value="completada" ${t.status === 'completada' ? 'selected' : ''}>Completada</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Data</label>
        <input class="input" id="f_date" type="date" value="${t.date || todayStr()}" />
      </div>
      <div class="form-group"><label>Categoria</label>
        <select class="input" id="f_category">
          ${['','pagaments','alumnes','professors','organització','trucada','material','altre'].map(o =>
            `<option value="${o}" ${(t.category || '') === o ? 'selected' : ''}>${o || 'Cap'}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveTask()">💾 Guardar</button>
      <button class="btn btn-ghost" onclick="closeModal()">Cancel·lar</button>
    </div>
  `);
}

async function saveTask() {
  const data = {
    title:       document.getElementById('f_title').value.trim(),
    description: document.getElementById('f_description').value.trim(),
    priority:    document.getElementById('f_priority').value,
    status:      document.getElementById('f_status').value,
    date:        document.getElementById('f_date').value,
    category:    document.getElementById('f_category').value || null,
  };
  if (!data.title) { showToast("Títol obligatori", 'error'); return; }
  try {
    if (editingId) {
      const { error } = await sb.from('tasks').update(data).eq('id', editingId);
      if (error) throw error;
      tasks = tasks.map(t => t.id === editingId ? { ...t, ...data } : t);
      showToast("Tasca actualitzada ✓");
    } else {
      const { data: res, error } = await sb.from('tasks').insert(data).select().single();
      if (error) throw error;
      tasks.unshift(res);
      showToast("Tasca afegida ✓");
    }
    closeModal();
    renderTasks();
  } catch(e) { showToast("Error: " + e.message, 'error'); }
}

async function toggleTask(id, currentStatus) {
  const newStatus = currentStatus === 'completada' ? 'pendent' : 'completada';
  try {
    const { error } = await sb.from('tasks').update({ status: newStatus }).eq('id', id);
    if (error) throw error;
    tasks = tasks.map(t => t.id === id ? { ...t, status: newStatus } : t);
    renderTasks();
    if (newStatus === 'completada') showToast("Tasca completada! ✓");
  } catch(e) { showToast("Error: " + e.message, 'error'); }
}

async function deleteTask(id) {
  confirmAction("Eliminar aquesta tasca?", async () => {
    try {
      const { error } = await sb.from('tasks').delete().eq('id', id);
      if (error) throw error;
      tasks = tasks.filter(t => t.id !== id);
      renderTasks();
      showToast("Tasca eliminada");
    } catch(e) { showToast("Error: " + e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 60000);
  loadAll();
});
