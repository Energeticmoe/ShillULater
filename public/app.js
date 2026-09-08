const form = document.getElementById('shillForm');
const submitBtn = document.getElementById('submitBtn');
const resultsEl = document.getElementById('results');
const errorEl = document.getElementById('errorMessage');

const profilePasteSection = document.getElementById('profilePasteSection');
const threadPasteSection = document.getElementById('threadPasteSection');
document.getElementById('toggleProfilePaste').addEventListener('click', () => {
  profilePasteSection.hidden = !profilePasteSection.hidden;
});
document.getElementById('toggleThreadPaste').addEventListener('click', () => {
  threadPasteSection.hidden = !threadPasteSection.hidden;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Shill-ulating…';

  const payload = {
    username: document.getElementById('username').value.trim(),
    draft: document.getElementById('draft').value.trim(),
    threadUrl: document.getElementById('threadUrl').value.trim(),
    affiliation: document.getElementById('affiliation').value,
    pastedProfileText: combinePastedProfile(),
    pastedThreadText: document.getElementById('pastedThread').value.trim(),
  };

  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    renderResult(data);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Shill-ulate';
  }
});

function combinePastedProfile() {
  const posts = document.getElementById('pastedPosts').value.trim();
  const comments = document.getElementById('pastedComments').value.trim();
  const parts = [];
  if (posts) parts.push(`--- PASTED POSTS ---\n${posts}`);
  if (comments) parts.push(`--- PASTED COMMENTS ---\n${comments}`);
  return parts.join('\n\n');
}

function renderResult(data) {
  const { analysis, access, disclaimers } = data;

  // Score
  const scoreEl = document.getElementById('scoreValue');
  scoreEl.textContent = analysis.score;
  scoreEl.className = 'score-value ' + (analysis.score < 34 ? 'low' : analysis.score < 67 ? 'mid' : 'high');

  // Reasons
  const reasonsList = document.getElementById('reasonsList');
  reasonsList.innerHTML = '';
  (analysis.reasons || []).forEach((r) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${escapeHtml(r.category)}:</strong> ${escapeHtml(r.explanation)}` +
      (r.quote ? `<br><em>"${escapeHtml(r.quote)}"</em>` : '');
    reasonsList.appendChild(li);
  });

  // Account context
  fillList('observationsList', analysis.account_context?.observations);
  fillList('inferencesList', analysis.account_context?.inferences);
  document.getElementById('coverageNote').textContent = analysis.account_context?.coverage_note || '';

  // Disclosure match
  const dm = analysis.disclosure_match || {};
  document.getElementById('disclosureMatch').textContent =
    `Declared affiliation: ${dm.declared_affiliation || '—'}. Disclosed in draft: ${dm.disclosed_in_draft || '—'}. ${dm.explanation || ''}`;

  // Missing info + confidence
  fillList('missingInfoList', analysis.missing_information);
  const conf = analysis.confidence || {};
  document.getElementById('confidenceNote').textContent =
    `Confidence: ${conf.level || '—'}. ${conf.reason || ''}`;

  // Rewrite + tip
  document.getElementById('rewriteText').textContent = analysis.rewrite || '';
  document.getElementById('tipText').textContent = analysis.tip || '';

  // Disclaimers
  const disclaimersList = document.getElementById('disclaimersList');
  disclaimersList.innerHTML = '';
  (disclaimers || []).forEach((d) => {
    const li = document.createElement('li');
    li.textContent = d;
    disclaimersList.appendChild(li);
  });

  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Access status + auto-reveal paste fallback
  handleAccessStatus('profile', access.profile, profilePasteSection, 'profileAccessStatus');
  handleAccessStatus('thread', access.thread, threadPasteSection, 'threadAccessStatus');
}

function handleAccessStatus(kind, accessInfo, section, statusElId) {
  const statusEl = document.getElementById(statusElId);
  if (!accessInfo) return;

  const failureStatuses = ['unavailable', 'denied', 'error', 'not_found', 'rate_limited'];
  if (failureStatuses.includes(accessInfo.status)) {
    section.hidden = false;
    statusEl.textContent = describeAccessFailure(kind, accessInfo);
  } else if (accessInfo.status === 'ok') {
    statusEl.textContent = accessInfo.coverageNote || 'Fetched successfully.';
  } else if (accessInfo.status === 'user_provided') {
    statusEl.textContent = 'Using pasted content — ownership and completeness unverified.';
  }
}

function describeAccessFailure(kind, accessInfo) {
  const label = kind === 'profile' ? 'Reddit profile access' : 'Thread access';
  const reasonMap = {
    unavailable: 'is currently unavailable for this tool (Reddit API credentials pending approval).',
    denied: 'was denied by Reddit (account may be private/suspended, or the request was blocked).',
    error: 'failed due to an error.',
    not_found: 'failed — account or thread not found.',
    rate_limited: 'was rate-limited by Reddit. Try again shortly.',
  };
  return `${label} ${reasonMap[accessInfo.status] || 'is unavailable.'} You can paste it manually below instead.`;
}

function fillList(id, items) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  (items || []).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
  if (!items || items.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'None noted.';
    li.style.opacity = '0.6';
    el.appendChild(li);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
