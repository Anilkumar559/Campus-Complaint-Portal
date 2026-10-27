const API = '/api';
const form = document.getElementById('complaintForm');
const formMessage = document.getElementById('formMessage');
const body = document.getElementById('complaintsBody');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
let complaints = [];

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function statusClass(status) {
  if (status === 'Resolved') return 'status-resolved';
  if (status === 'In Progress') return 'status-in-progress';
  return 'status-pending';
}
function updateStats() {
  document.getElementById('totalCount').textContent = complaints.length;
  document.getElementById('pendingCount').textContent = complaints.filter(c => c.status === 'Pending').length;
  document.getElementById('progressCount').textContent = complaints.filter(c => c.status === 'In Progress').length;
  document.getElementById('resolvedCount').textContent = complaints.filter(c => c.status === 'Resolved').length;
  document.getElementById('recordCount').textContent = `${complaints.length} record${complaints.length === 1 ? '' : 's'}`;
}
function renderComplaints() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const filtered = complaints.filter(c => {
    const haystack = [c.id, c.studentName, c.rollNumber, c.category, c.description].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (status === 'All' || c.status === status);
  });
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell">${complaints.length ? 'No complaints match your search.' : 'No complaints yet. Submit the first report above.'}</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map(c => `<tr>
    <td><span class="complaint-id">#CC-${c.id}</span><span class="date-note">Complaint ID</span></td>
    <td><span class="student-name">${escapeText(c.studentName)}</span><span class="roll-number">${escapeText(c.rollNumber)}</span></td>
    <td><span class="category-tag">${escapeText(c.category)}</span></td>
    <td>${escapeText(c.description)}</td>
    <td><span class="status-tag ${statusClass(c.status)}">${escapeText(c.status)}</span></td>
    <td><label class="sr-only" for="status-${c.id}">Update status for complaint ${c.id}</label><select class="status-select" id="status-${c.id}" data-id="${c.id}" aria-label="Update status for complaint ${c.id}"><option ${c.status==='Pending'?'selected':''}>Pending</option><option ${c.status==='In Progress'?'selected':''}>In Progress</option><option ${c.status==='Resolved'?'selected':''}>Resolved</option></select></td>
  </tr>`).join('');
}
async function loadComplaints() {
  body.innerHTML = '<tr><td colspan="6" class="empty-cell">Loading complaints...</td></tr>';
  try {
    const response = await fetch(`${API}/complaints`);
    if (!response.ok) throw new Error('The server returned an error.');
    complaints = await response.json();
    updateStats(); renderComplaints();
    document.getElementById('lastUpdated').textContent = `Updated ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
  } catch (error) {
    body.innerHTML = '<tr><td colspan="6" class="empty-cell">Could not connect to the C++ server. Start the backend and reload this page.</td></tr>';
    document.getElementById('lastUpdated').textContent = 'Server unavailable';
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  formMessage.textContent = '';
  formMessage.classList.remove('error');
  const fields = Object.fromEntries(new FormData(form).entries());
  if (Object.values(fields).some(value => !String(value).trim())) {
    formMessage.textContent = 'Please complete every field.'; formMessage.classList.add('error'); return;
  }
  if (Object.values(fields).some(value => value.includes('|') || /[\r\n]/.test(value))) {
    formMessage.textContent = 'Please remove the | character and line breaks.'; formMessage.classList.add('error'); return;
  }
  const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Submitting...';
  try {
    const response = await fetch(`${API}/complaints`, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}, body:new URLSearchParams(fields)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not submit complaint.');
    form.reset(); formMessage.textContent = `Complaint submitted successfully! Your complaint ID is CC-${result.id}.`;
    await loadComplaints();
  } catch (error) {
    formMessage.textContent = `${error.message || 'Could not connect to server.'} Check that the C++ server is running.`;
    formMessage.classList.add('error');
  } finally { button.disabled = false; button.innerHTML = 'Submit complaint <span>→</span>'; }
});
body.addEventListener('change', async event => {
  const select = event.target.closest('.status-select'); if (!select) return;
  select.disabled = true;
  try {
    const response = await fetch(`${API}/status`, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}, body:new URLSearchParams({id:select.dataset.id, status:select.value})});
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not update status.');
    await loadComplaints();
  } catch (error) { alert(error.message || 'Could not connect to the C++ server.'); await loadComplaints(); }
  finally { select.disabled = false; }
});
searchInput.addEventListener('input', renderComplaints);
statusFilter.addEventListener('change', renderComplaints);
document.getElementById('refreshButton').addEventListener('click', loadComplaints);
loadComplaints();
