// ---------------------------------------------------------------
// Backend contract (coordinate with the Apps Script side):
//   Request:  GET APPS_SCRIPT_URL?keyword=text  (via doGet(e), e.parameter.keyword)
//   Response: JSON array of row objects, same shape as
//             example_respone.json, e.g.:
//             [{ "Round": "1", "ที่อยู่อีเมล": "...", "รหัสนิสิต (Student ID)": "...", ... }]
//             (an object like { data: [...] } or { results: [...] } is
//             also accepted, see readRows() below)
// ---------------------------------------------------------------
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwZ8nQ2KH2Ets8WSQphOsRik9mDp8ydOoxvVWk1cuei3gvPfdFhs8cuYvNQlwZBTB-nvQ/exec'; // TODO: paste the deployed Apps Script /exec URL here

const FIELD = {
  round: 'Round',
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
    const url = `${APPS_SCRIPT_URL}?keyword=${encodeURIComponent(query)}`;
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
  const round = row[FIELD.round] || '';
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
        ${group ? `<span class="group-badge" style="${groupBadgeStyle(group)}">กลุ่ม ${escapeHtml(group)}</span>` : ''}
        ${major ? `<span class="major-badge">${escapeHtml(major)}</span>` : ''}
      </div>
      <div class="result-meta">
        ${metaRow('รหัสนิสิต', row[FIELD.studentId])}
        ${metaRow('ชั้นปี', row[FIELD.year])}
        ${metaRow('อีเมล', row[FIELD.email])}
      </div>
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

// Deterministic color per group letter so the same group always
// gets the same badge color, without hardcoding a palette per letter.
function groupBadgeStyle(group) {
  const hue = (group.charCodeAt(0) * 47) % 360;
  return `background:hsl(${hue},70%,94%);color:hsl(${hue},55%,32%);`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
