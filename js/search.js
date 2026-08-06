// ---------------------------------------------------------------
// Backend contract (coordinate with the Apps Script side):
//   Search:      GET APPS_SCRIPT_URL?action=search&keyword=text
//                Response: JSON array of row objects, same shape as
//                example_respone.json, e.g.:
//                [{ "Order-Round": "1-0019", "ที่อยู่อีเมล": "...", ... }]
//                (an object like { data: [...] } or { results: [...] } is
//                also accepted, see readRows() below)
//   View order:  GET APPS_SCRIPT_URL?action=order&order=<order-round>
//                Response: JSON object mapping size label -> quantity, e.g.
//                { "S": 1, "M": 3, "L": 2, "XL": 0 }
//                (an object like { data: {...} } is also accepted, see
//                readSizes() below)
// ---------------------------------------------------------------
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwZ8nQ2KH2Ets8WSQphOsRik9mDp8ydOoxvVWk1cuei3gvPfdFhs8cuYvNQlwZBTB-nvQ/exec'; // TODO: paste the deployed Apps Script /exec URL here

const FIELD = {
  round: 'Order-Round',
  email: 'ที่อยู่อีเมล',
  studentId: 'รหัสนิสิต (Student ID)',
  year: 'ชั้นปี (Year of Study)',
  firstName: 'ชื่อจริง (First Name)',
  lastName: 'นามสกุล (Last Name)',
  nickname: 'ชื่อเล่น (Nick Name)',
  group: 'กรุ๊ป (Group)',
  major: 'ภาค (Major)',
};

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('search-status');
const resultsEl = document.getElementById('results');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  runSearch(input.value.trim());
});

resultsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-view-order');
  if (!btn) return;
  showOrderModal(btn.dataset.order);
});

async function runSearch(query) {
  if (!query) {
    resultsEl.innerHTML = '';
    statusEl.textContent = '';
    return;
  }
  if (!APPS_SCRIPT_URL) {
    showError('ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ใน js/search.js');
    return;
  }

  setLoading(true);
  try {
    const url = `${APPS_SCRIPT_URL}?action=search&keyword=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`คำขอล้มเหลว (HTTP ${res.status})`);
    const payload = await res.json();
    renderResults(readRows(payload), query);
  } catch (err) {
    showError('ค้นหาไม่สำเร็จ: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function readRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

function setLoading(isLoading) {
  searchBtn.disabled = isLoading;
  if (isLoading) {
    statusEl.textContent = '';
    resultsEl.innerHTML = '<div class="spinner">กำลังค้นหา...</div>';
  }
}

function showError(message) {
  resultsEl.innerHTML = `<div class="alert alert-error">${escapeHtml(message)}</div>`;
  statusEl.textContent = '';
}

function renderResults(rows, query) {
  if (!rows.length) {
    resultsEl.innerHTML = `<span class="empty-text">ไม่พบผลลัพธ์สำหรับ "${escapeHtml(query)}"</span>`;
    statusEl.textContent = '';
    return;
  }

  statusEl.textContent = `พบ ${rows.length} รายการ`;
  resultsEl.innerHTML = `<div class="results-grid">${rows.map(rowToCard).join('')}</div>`;
}

function rowToCard(row) {
  const firstName = row[FIELD.firstName] || '';
  const lastName = row[FIELD.lastName] || '';
  const nickname = row[FIELD.nickname] || '';
  const orderRound = row[FIELD.round] || '';
  const round = orderRound.split('-')[0];
  const group = row[FIELD.group] || '';
  const major = row[FIELD.major] || '';
  const initial = (nickname || firstName || '?').charAt(0);

  return `
    <div class="card result-card">
      <div class="result-card-top">
        <div class="result-avatar">${escapeHtml(initial)}</div>
        <div class="result-name-block">
          <div class="result-name">${escapeHtml(firstName)} ${escapeHtml(lastName)}</div>
          ${nickname ? `<div class="result-nickname">"${escapeHtml(nickname)}"</div>` : ''}
        </div>
      </div>
      <div class="result-badges">
        ${round ? `<span class="round-badge">รอบ ${escapeHtml(round)}</span>` : ''}
        ${group ? `<span class="group-badge">กลุ่ม ${escapeHtml(group)}</span>` : ''}
        ${major ? `<span class="major-badge">${escapeHtml(major)}</span>` : ''}
      </div>
      <div class="result-meta">
        ${metaRow('รหัสนิสิต', row[FIELD.studentId])}
        ${metaRow('ชั้นปี', row[FIELD.year])}
      </div>
      ${orderRound ? `
        <div class="result-actions">
          <button type="button" class="btn btn-secondary btn-view-order" data-order="${escapeHtml(orderRound)}">ดูคำสั่งซื้อ</button>
        </div>
      ` : ''}
    </div>
  `;
}

function metaRow(label, value) {
  if (!value) return '';
  return `
    <div class="result-meta-row">
      <span class="result-meta-label">${escapeHtml(label)}</span>
      <span class="result-meta-value">${escapeHtml(value)}</span>
    </div>
  `;
}

async function showOrderModal(orderNumber) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">คำสั่งซื้อ ${escapeHtml(orderNumber)}</div>
      <div class="modal-body"><div class="spinner">กำลังโหลด...</div></div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary modal-close">ปิด</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
  };
  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.modal-close').addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);

  const bodyEl = overlay.querySelector('.modal-body');
  try {
    const url = `${APPS_SCRIPT_URL}?action=order&order=${encodeURIComponent(orderNumber)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`คำขอล้มเหลว (HTTP ${res.status})`);
    const payload = await res.json();
    bodyEl.innerHTML = renderSizeTable(readSizes(payload));
  } catch (err) {
    bodyEl.innerHTML = `<div class="alert alert-error">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

function readSizes(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload.data && typeof payload.data === 'object' ? payload.data : payload;
  }
  return {};
}

function renderSizeTable(sizes) {
  const entries = Object.entries(sizes).filter(([, qty]) => Number(qty) !== 0);
  if (!entries.length) {
    return `<span class="empty-text">ไม่พบข้อมูลไซส์สำหรับคำสั่งซื้อนี้</span>`;
  }
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>ไซส์</th><th>จำนวน</th></tr></thead>
        <tbody>
          ${entries.map(([size, qty]) => `
            <tr><td>${escapeHtml(size)}</td><td>${escapeHtml(String(qty))}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
