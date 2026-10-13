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
//
// Size-change section (rounds 1-2):
//   ROUND12_SEARCH_URL?action=search&keyword=text   -> same row shape as above,
//                with Order-Round like "1-0340". The change deployment has no
//                working search of its own, so names are resolved here first.
//   CHANGE_URL?action=order&order=<order-round>     -> either [] (no change
//                requested for that order) or
//                { OLD: {size: qty}, NEW: {size: qty}, "Noted Prob Comment": "..." }
// ---------------------------------------------------------------
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyh89Y3GIQkA24NhRlvdRB3vArsLLMxt0rHFkIEwzE6Qr38FuzRpk55dPjefxk2vYVl/exec'; // TODO: paste the deployed Apps Script /exec URL here
const ROUND12_SEARCH_URL = 'https://script.google.com/macros/s/AKfycbwZ8nQ2KH2Ets8WSQphOsRik9mDp8ydOoxvVWk1cuei3gvPfdFhs8cuYvNQlwZBTB-nvQ/exec';
const CHANGE_URL = 'https://script.google.com/macros/s/AKfycbyo5QbJejy1rA9TvvgobREHJiTKYMSNFN3Bw5cOnvOyJw6faNCBeLXZrgyA16jMnMIU0Q/exec';

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
const changeEl = document.getElementById('change');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = input.value.trim();
  runSearch(query);
  runChangeSearch(query);
});

resultsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-view-order');
  if (!btn) return;
  showOrderModal(btn.dataset.order);
});

changeEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-view-change');
  if (!btn) return;
  showChangeModal(btn.dataset.order);
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
        ${group ? `<span class="group-badge">กรูป ${escapeHtml(group)}</span>` : ''}
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

/* -----------------------------------------------------------------
   SIZE-CHANGE SECTION (rounds 1-2)
   ----------------------------------------------------------------- */
const changeCache = new Map();

async function runChangeSearch(query) {
  if (!query) {
    changeEl.innerHTML = '';
    return;
  }

  changeEl.innerHTML = '<div class="spinner">กำลังค้นหา...</div>';
  changeCache.clear();
  try {
    const url = `${ROUND12_SEARCH_URL}?action=search&keyword=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`คำขอล้มเหลว (HTTP ${res.status})`);
    const rows = readRows(await res.json());

    const checked = await Promise.all(rows.map(async (row) => {
      const orderRound = row[FIELD.round];
      if (!orderRound) return null;
      const change = await fetchChange(orderRound);
      if (!change) return null;
      changeCache.set(orderRound, change);
      return { row, change };
    }));

    renderChangeResults(checked.filter(Boolean), query);
  } catch (err) {
    changeEl.innerHTML = `<div class="alert alert-error">${escapeHtml('ค้นหาไม่สำเร็จ: ' + err.message)}</div>`;
  }
}

async function fetchChange(orderRound) {
  const url = `${CHANGE_URL}?action=order&order=${encodeURIComponent(orderRound)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`คำขอล้มเหลว (HTTP ${res.status})`);
  return readChange(await res.json());
}

// The change endpoint answers [] for an order with no size-change request.
function readChange(payload) {
  const hasChange = payload && !Array.isArray(payload) && typeof payload === 'object'
    && (payload.OLD || payload.NEW);
  return hasChange ? payload : null;
}

function renderChangeResults(entries, query) {
  if (!entries.length) {
    changeEl.innerHTML = `<span class="empty-text">ไม่พบรายการเปลี่ยนไซส์สำหรับ "${escapeHtml(query)}"</span>`;
    return;
  }
  changeEl.innerHTML = `<div class="results-grid">${entries.map(changeToCard).join('')}</div>`;
}

function changeToCard({ row, change }) {
  const firstName = row[FIELD.firstName] || '';
  const lastName = row[FIELD.lastName] || '';
  const nickname = row[FIELD.nickname] || '';
  const orderRound = row[FIELD.round] || '';
  const round = orderRound.split('-')[0];
  const group = row[FIELD.group] || '';
  const major = row[FIELD.major] || '';
  const initial = (nickname || firstName || '?').charAt(0);
  const summary = sizeDiffSummary(change.OLD, change.NEW);

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
        ${group ? `<span class="group-badge">กรูป ${escapeHtml(group)}</span>` : ''}
        ${major ? `<span class="major-badge">${escapeHtml(major)}</span>` : ''}
      </div>
      <div class="result-meta">
        ${metaRow('รหัสนิสิต', row[FIELD.studentId])}
        ${metaRow('เลขที่ออเดอร์', orderRound)}
      </div>
      ${summary ? `<div class="change-summary">${summary}</div>` : ''}
      <div class="result-actions">
        <button type="button" class="btn btn-secondary btn-view-change" data-order="${escapeHtml(orderRound)}">ดูรายละเอียดการเปลี่ยน</button>
      </div>
    </div>
  `;
}

function sizeLabels(oldSizes, newSizes) {
  return [...new Set([...Object.keys(oldSizes || {}), ...Object.keys(newSizes || {})])];
}

function sizeDiffSummary(oldSizes, newSizes) {
  const from = [];
  const to = [];
  for (const size of sizeLabels(oldSizes, newSizes)) {
    const delta = Number(newSizes?.[size] || 0) - Number(oldSizes?.[size] || 0);
    if (delta < 0) from.push(`${escapeHtml(size)} ×${-delta}`);
    if (delta > 0) to.push(`${escapeHtml(size)} ×${delta}`);
  }
  if (!from.length && !to.length) return '';
  return `
    <span class="change-from">${from.join(', ') || '—'}</span>
    <span class="change-arrow">→</span>
    <span class="change-to">${to.join(', ') || '—'}</span>
  `;
}

function showChangeModal(orderNumber) {
  const change = changeCache.get(orderNumber);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">คำขอเปลี่ยนไซส์ ${escapeHtml(orderNumber)}</div>
      <div class="modal-body">${change
        ? renderChangeTable(change)
        : '<span class="empty-text">ไม่พบคำขอเปลี่ยนไซส์สำหรับคำสั่งซื้อนี้</span>'}</div>
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
}

function renderChangeTable(change) {
  const oldSizes = change.OLD || {};
  const newSizes = change.NEW || {};
  const note = change['Noted Prob Comment'] || '';
  const sizes = sizeLabels(oldSizes, newSizes)
    .filter((size) => Number(oldSizes[size] || 0) !== 0 || Number(newSizes[size] || 0) !== 0);

  const table = sizes.length ? `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>ไซส์</th><th>เดิม</th><th>ใหม่</th></tr></thead>
        <tbody>
          ${sizes.map((size) => {
            const before = Number(oldSizes[size] || 0);
            const after = Number(newSizes[size] || 0);
            return `
            <tr${before === after ? '' : ' class="size-row-changed"'}>
              <td>${escapeHtml(size)}</td>
              <td>${before}</td>
              <td>${after}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : '<span class="empty-text">ไม่พบข้อมูลไซส์สำหรับคำขอนี้</span>';

  return `${table}${note ? `
    <div class="change-note">
      <span class="change-note-label">หมายเหตุ</span>
      ${escapeHtml(note)}
    </div>
  ` : ''}`;
}
