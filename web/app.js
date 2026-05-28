// =============================================
// app.js - 出欠管理アプリ メインロジック
// =============================================

// ===== バージョン =====
const VERSION = '20260515-005';

// ===== 状態 =====
const STATE = {
  gasUrl:     localStorage.getItem('gasUrl') || '',
  className:  localStorage.getItem('className') || '',
  attendance: {},   // { "出席番号": "状態" }
  students:   [],   // [{number, name, seatRow, seatCol, className}]
  settings:   [],   // [{className, rows, cols, emptySeats}]
  activeYear: null,
  currentStudent: null,
};

const STATUS_CLASS = {
  '出席':     'present',
  '欠席':     'absent',
  '遅刻/早退': 'late',
  '公欠':     'excused',
  '休学':     'leave',
};

const STATUS_BADGE = {
  '欠席':     '欠',
  '遅刻/早退': '遅',
  '公欠':     '公',
  '休学':     '休',
};

// ===== DOM =====
const $ = id => document.getElementById(id);

const els = {
  menuBtn:       $('menu-btn'),
  closeMenuBtn:  $('close-menu-btn'),
  sidenav:       $('sidenav'),
  overlay:       $('overlay'),
  classSelect:   $('class-select'),
  periodSelect:  $('period-select'),
  dateInput:     $('date-input'),
  saveBtn:       $('save-btn'),
  seatMap:       $('seat-map'),
  absentCount:   $('absent-count'),
  popupOverlay:  $('popup-overlay'),
  popup:         $('popup'),
  popupName:     $('popup-name'),
  popupNumber:   $('popup-number'),
  popupClose:    $('popup-close'),
  toast:         $('toast'),
  numberInput:   $('number-input'),
  numberSearchBtn: $('number-search-btn'),
  studentList:   $('student-list'),
  historyDate:   $('history-date'),
  historyLoadBtn:$('history-load-btn'),
  historyTbody:  $('history-tbody'),
  settingsGrid:  $('settings-grid'),
  saveSettingsBtn: $('save-settings-btn'),
  csvClassSelect:$('csv-class-select'),
  csvInput:      $('csv-input'),
  csvUploadBtn:  $('csv-upload-btn'),
  csvPreview:    $('csv-preview'),
  setupYear:     $('setup-year'),
  setupFolder:   $('setup-folder'),
  setupBtn:      $('setup-btn'),
  gasUrlInput:   $('gas-url-input'),
  gasUrlSaveBtn: $('gas-url-save-btn'),
  yearsList:     $('years-list'),
};

// ===== 初期化 =====
function init() {
  // バージョン表示
  const versionEl = $('app-version');
  if (versionEl) versionEl.textContent = 'v' + VERSION;

  // 今日の日付をデフォルトに
  const today = new Date().toISOString().split('T')[0];
  els.dateInput.value = today;
  els.historyDate.value = today;
  els.setupYear.value = new Date().getFullYear();
  els.gasUrlInput.value = STATE.gasUrl;

  setupEventListeners();
  loadInitialData();
}

async function loadInitialData() {
  if (!STATE.gasUrl) {
    showToast('GAS URLを設定してください（設定 → 年度セットアップ）');
    return;
  }
  try {
    const [settingsRes, studentsRes] = await Promise.all([
      gasGet('getSettings'),
      gasGet('getStudents'),
    ]);
    STATE.settings = settingsRes.settings || [];
    STATE.students = studentsRes.students || [];
    updateClassSelects();
    renderSettingsGrid();
    renderSeatMap();
    renderStudentList();
  } catch (e) {
    showToast('データ読み込み失敗: ' + e.message);
  }
}

// ===== イベント =====
function setupEventListeners() {
  // メニュー
  els.menuBtn.addEventListener('click', () => openMenu());
  els.closeMenuBtn.addEventListener('click', () => closeMenu());
  els.overlay.addEventListener('click', () => closeMenu());

  // ナビ
  document.querySelectorAll('.sidenav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      switchView(item.dataset.view);
      closeMenu();
    });
  });

  // ヘッダー操作
  els.classSelect.addEventListener('change', () => {
    STATE.className = els.classSelect.value;
    localStorage.setItem('className', STATE.className);
    loadAttendance();
    renderSeatMap();
    renderStudentList();
  });
  els.periodSelect.addEventListener('change', loadAttendance);
  els.dateInput.addEventListener('change', loadAttendance);
  els.saveBtn.addEventListener('click', saveAttendance);

  // ポップアップ
  els.popupClose.addEventListener('click', closePopup);
  els.popupOverlay.addEventListener('click', e => { if (e.target === els.popupOverlay) closePopup(); });
  document.querySelectorAll('.popup-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setStatus(STATE.currentStudent, btn.dataset.status);
      closePopup();
    });
  });

  // 出席番号検索
  els.numberSearchBtn.addEventListener('click', () => filterStudentList(els.numberInput.value));
  els.numberInput.addEventListener('keydown', e => { if (e.key === 'Enter') filterStudentList(els.numberInput.value); });
  els.numberInput.addEventListener('input', () => filterStudentList(els.numberInput.value));

  // 履歴
  els.historyLoadBtn.addEventListener('click', loadHistory);

  // 設定保存
  els.saveSettingsBtn.addEventListener('click', saveSettings);

  // CSV
  els.csvInput.addEventListener('change', previewCSV);
  els.csvUploadBtn.addEventListener('click', uploadCSV);

  // セットアップ
  els.setupBtn.addEventListener('click', runSetup);
  els.gasUrlSaveBtn.addEventListener('click', saveGasUrl);
}

// ===== メニュー =====
function openMenu()  { els.sidenav.classList.add('open'); els.overlay.classList.add('show'); }
function closeMenu() { els.sidenav.classList.remove('open'); els.overlay.classList.remove('show'); }

// ===== ビュー切り替え =====
function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidenav-item').forEach(i => i.classList.remove('active'));
  $('view-' + viewName).classList.add('active');
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  if (viewName === 'seat')     renderSeatMap();
  if (viewName === 'number')   renderStudentList();
  if (viewName === 'setup')    loadYears();
}

// ===== クラス選択肢の更新 =====
function updateClassSelects() {
  const classes = [...new Set(STATE.settings.map(s => s.className))];
  [els.classSelect, els.csvClassSelect].forEach(sel => {
    sel.innerHTML = classes.map(c => `<option value="${c}">${c}</option>`).join('');
  });
  if (!STATE.className && classes.length > 0) STATE.className = classes[0];
  els.classSelect.value = STATE.className;
}

// ===== 出欠読み込み =====
async function loadAttendance() {
  if (!STATE.gasUrl || !STATE.className) return;
  try {
    const res = await gasGet('getAttendance', {
      date:      els.dateInput.value,
      period:    els.periodSelect.value,
      className: STATE.className,
    });
    STATE.attendance = {};
    (res.records || []).forEach(r => {
      STATE.attendance[r.number] = r.status;
    });
    renderSeatMap();
    renderStudentList();
    updateAbsentCount();
  } catch (e) {
    console.error(e);
  }
}

// ===== 退学・休学判定 =====
function isWithdrawn(student) {
  // 座席が割り振られていない → 退学
  return !student.seatRow && !student.seatCol;
}

function isOnLeave(student) {
  // 休学期間中かどうか
  if (!student.leaveStart) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(student.leaveStart);
  const end   = student.leaveEnd ? new Date(student.leaveEnd) : null;
  return today >= start && (!end || today <= end);
}

// ===== 出欠保存 =====
async function saveAttendance() {
  if (!STATE.gasUrl) { showToast('GAS URLが未設定です'); return; }
  const classStudents = STATE.students.filter(s => s.className === STATE.className);
  const records = classStudents.map(s => {
    // 退学・休学中は空欄で保存
    if (isWithdrawn(s) || isOnLeave(s)) {
      return { number: s.number, name: s.name, status: '' };
    }
    return {
      number: s.number,
      name:   s.name,
      status: STATE.attendance[s.number] || '出席',
    };
  });
  try {
    els.saveBtn.textContent = '保存中...';
    await gasPost('saveAttendance', {
      date:      els.dateInput.value,
      period:    els.periodSelect.value,
      className: STATE.className,
      records,
    });
    showToast('保存しました ✓');
  } catch (e) {
    showToast('保存失敗: ' + e.message);
  } finally {
    els.saveBtn.textContent = '保存';
  }
}

// ===== ステータス変更 =====
function setStatus(student, status) {
  if (status === '出席') {
    delete STATE.attendance[student.number];
  } else {
    STATE.attendance[student.number] = status;
  }
  renderSeatMap();
  renderStudentList();
  updateAbsentCount();
}

// ===== 座席マップ描画 =====
function renderSeatMap() {
  const setting = STATE.settings.find(s => s.className === STATE.className);
  if (!setting) { els.seatMap.innerHTML = '<p style="color:#888;padding:20px">設定がありません</p>'; return; }

  const { rows, cols, emptySeats } = setting;
  els.seatMap.style.gridTemplateColumns = `repeat(${cols}, 72px)`;

  const classStudents = STATE.students.filter(s => s.className === STATE.className);
  // 座席マップ: {行-列: student}
  const seatMap = {};
  classStudents.forEach(s => { seatMap[`${s.seatRow}-${s.seatCol}`] = s; });

  let html = '';
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const key = `${r}-${c}`;
      const isEmpty = emptySeats.includes(key);
      const student = seatMap[key];

      if (isEmpty || !student) {
        html += `<div class="seat empty"></div>`;
        continue;
      }

      const status = STATE.attendance[student.number] || '出席';
      const cls    = STATUS_CLASS[status] || 'present';
      const badge  = STATUS_BADGE[status] || '';
      html += `
        <div class="seat ${cls}" data-number="${student.number}">
          <span class="seat-number">${student.number}番</span>
          <span class="seat-name">${student.name}</span>
          ${badge ? `<span class="seat-badge">${badge}</span>` : ''}
        </div>`;
    }
  }
  els.seatMap.innerHTML = html;

  els.seatMap.querySelectorAll('.seat:not(.empty)').forEach(el => {
    el.addEventListener('click', () => {
      const num = el.dataset.number;
      const student = classStudents.find(s => String(s.number) === String(num));
      if (student) openPopup(student);
    });
  });
}

// ===== 生徒リスト描画 =====
function renderStudentList(filter = '') {
  const classStudents = STATE.students
    .filter(s => s.className === STATE.className)
    .filter(s => !filter || String(s.number).startsWith(filter) || s.name.includes(filter))
    .sort((a, b) => Number(a.number) - Number(b.number));

  els.studentList.innerHTML = classStudents.map(s => {
    const status = STATE.attendance[s.number] || '出席';
    const cls    = STATUS_CLASS[status] || 'present';
    return `
      <div class="student-row" data-number="${s.number}">
        <div class="student-row-left">
          <span class="student-row-num">${s.number}番</span>
          <span class="student-row-name">${s.name}</span>
        </div>
        <span class="status-badge ${cls}">${status}</span>
      </div>`;
  }).join('');

  els.studentList.querySelectorAll('.student-row').forEach(el => {
    el.addEventListener('click', () => {
      const num = el.dataset.number;
      const student = classStudents.find(s => String(s.number) === String(num));
      if (student) openPopup(student);
    });
  });
}

function filterStudentList(val) { renderStudentList(val.trim()); }

// ===== 欠席カウント更新 =====
function updateAbsentCount() {
  const count = Object.values(STATE.attendance).filter(s => s !== '出席').length;
  els.absentCount.textContent = count;
}

// ===== ポップアップ =====
function openPopup(student) {
  STATE.currentStudent = student;
  els.popupName.textContent   = student.name;
  els.popupNumber.textContent = `${STATE.className} ${student.number}番`;
  const current = STATE.attendance[student.number] || '出席';
  document.querySelectorAll('.popup-btn').forEach(btn => {
    btn.style.opacity = btn.dataset.status === current ? '1' : '0.7';
    btn.style.outline = btn.dataset.status === current ? '3px solid #111' : 'none';
  });
  els.popupOverlay.classList.add('show');
}
function closePopup() { els.popupOverlay.classList.remove('show'); STATE.currentStudent = null; }

// ===== 履歴 =====
async function loadHistory() {
  try {
    const res = await gasGet('getAttendance', {
      date:      els.historyDate.value,
      className: STATE.className,
    });
    const records = res.records || [];
    els.historyTbody.innerHTML = records.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px">記録なし</td></tr>'
      : records.map(r => `
          <tr>
            <td>${r.date}</td>
            <td>${r.period}限</td>
            <td>${r.number}番</td>
            <td>${r.name}</td>
            <td><span class="status-badge ${STATUS_CLASS[r.status]}">${r.status}</span></td>
          </tr>`).join('');
  } catch (e) {
    showToast('履歴読み込み失敗: ' + e.message);
  }
}

// ===== 設定 =====
function renderSettingsGrid() {
  els.settingsGrid.innerHTML = STATE.settings.map((s, i) => `
    <div class="settings-card">
      <h3>${s.className}</h3>
      <label>行数</label>
      <input type="number" data-idx="${i}" data-field="rows" value="${s.rows}" min="1" max="20">
      <label>列数</label>
      <input type="number" data-idx="${i}" data-field="cols" value="${s.cols}" min="1" max="20">
      <label>空席（行-列 をカンマ区切り）</label>
      <input type="text" data-idx="${i}" data-field="emptySeats" value="${s.emptySeats.join(',')}">
    </div>`).join('');

  els.settingsGrid.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', () => {
      const idx   = input.dataset.idx;
      const field = input.dataset.field;
      if (field === 'emptySeats') {
        STATE.settings[idx].emptySeats = input.value.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        STATE.settings[idx][field] = Number(input.value);
      }
    });
  });
}

async function saveSettings() {
  try {
    await gasPost('saveSettings', { settings: STATE.settings });
    showToast('設定を保存しました ✓');
    renderSeatMap();
  } catch (e) {
    showToast('設定保存失敗: ' + e.message);
  }
}

// ===== CSV =====
let csvData = [];
function previewCSV() {
  const file = els.csvInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    csvData = lines.slice(1).map(line => {
      const parts = line.split(',');
      return { number: parts[0]?.trim(), name: parts[1]?.trim() };
    }).filter(s => s.number && s.name);
    els.csvPreview.textContent = `${csvData.length}人 読み込み予定`;
  };
  reader.readAsText(file, 'UTF-8');
}

async function uploadCSV() {
  if (csvData.length === 0) { showToast('CSVを選択してください'); return; }
  const className = els.csvClassSelect.value;
  try {
    await gasPost('saveStudents', { className, students: csvData });
    STATE.students = STATE.students.filter(s => s.className !== className);
    csvData.forEach(s => STATE.students.push({ ...s, className, seatRow: '', seatCol: '' }));
    showToast(`${csvData.length}人 アップロード完了 ✓`);
    renderSeatMap();
    renderStudentList();
    csvData = [];
    els.csvPreview.textContent = '';
    els.csvInput.value = '';
  } catch (e) {
    showToast('アップロード失敗: ' + e.message);
  }
}

// ===== セットアップ =====
async function runSetup() {
  const year   = els.setupYear.value;
  const folder = els.setupFolder.value;
  if (!year) { showToast('年度を入力してください'); return; }
  if (!STATE.gasUrl) { showToast('先にGAS URLを保存してください'); return; }
  try {
    els.setupBtn.textContent = '作成中...';
    const res = await gasPost('setup', { year, folderName: folder });
    showToast(`${res.spreadsheetName} を作成しました ✓`);
    loadYears();
  } catch (e) {
    showToast('セットアップ失敗: ' + e.message);
  } finally {
    els.setupBtn.textContent = 'スプレッドシートを作成してセットアップ';
  }
}

async function loadYears() {
  if (!STATE.gasUrl) return;
  try {
    const res = await gasGet('getYears');
    const years = res.years || [];
    els.yearsList.innerHTML = years.length === 0
      ? '<p style="color:#888;font-size:14px">年度データなし</p>'
      : years.map(y => `
          <div class="year-row ${y.active ? 'active-year' : ''}">
            <div>
              <div style="font-weight:600">${y.name}</div>
              <div style="font-size:12px;color:#888">${y.year}年度</div>
            </div>
            <button class="btn-secondary" onclick="switchYear('${y.spreadsheetId}')">切り替え</button>
          </div>`).join('');
  } catch (e) { console.error(e); }
}

async function switchYear(spreadsheetId) {
  try {
    await gasPost('switchYear', { spreadsheetId });
    showToast('年度を切り替えました ✓');
    loadInitialData();
  } catch (e) {
    showToast('切り替え失敗: ' + e.message);
  }
}

function saveGasUrl() {
  const url = els.gasUrlInput.value.trim();
  STATE.gasUrl = url;
  localStorage.setItem('gasUrl', url);
  showToast('GAS URLを保存しました ✓');
  loadInitialData();
}

// ===== GAS API =====
async function gasGet(action, params = {}) {
  if (!STATE.gasUrl) throw new Error('GAS URLが未設定です');
  const url = new URL(STATE.gasUrl);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { redirect: 'follow' });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function gasPost(action, body = {}) {
  if (!STATE.gasUrl) throw new Error('GAS URLが未設定です');
  const res = await fetch(STATE.gasUrl, {
    method:  'POST',
    body:    JSON.stringify({ action, ...body }),
    redirect:'follow',
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ===== トースト =====
let toastTimer;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3000);
}

// ===== 起動 =====
init();

// Service Worker登録（PWA化）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('SW registered'))
      .catch(e => console.error('SW error:', e));
  });
}
