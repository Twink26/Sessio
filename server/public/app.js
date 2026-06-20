const statusLine = document.getElementById('statusLine');
const statusDot = document.getElementById('statusDot');
const sessionGrid = document.getElementById('sessionGrid');
const emptyState = document.getElementById('emptyState');
const refreshBtn = document.getElementById('refreshBtn');

function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function scoreColor(score) {
  if (score >= 80) return 'var(--green)';
  if (score >= 60) return 'var(--accent)';
  if (score >= 40) return 'var(--orange)';
  return 'var(--red)';
}

function renderSession(entry) {
  const session = entry.session || {};
  const files = session.editedFiles?.length ?? 0;
  const commits = session.gitCommits?.length ?? 0;
  const errors = session.terminalErrors?.length ?? 0;
  const tags = (session.tags || [])
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');

  const score = session.productivityScore;
  const scoreHtml =
    score !== undefined
      ? `
        <div class="score-bar-wrap">
          <div class="score-track">
            <div class="score-fill" style="width: ${score}%; background: ${scoreColor(score)};"></div>
          </div>
          <div class="score-label">Productivity <strong style="color: ${scoreColor(score)};">${score}</strong>/100</div>
        </div>
      `
      : '';

  return `
    <article class="card">
      <div class="card-header">
        <div class="avatar">${escapeHtml(getInitials(entry.displayName))}</div>
        <div>
          <div class="author">${escapeHtml(entry.displayName)}</div>
          <div class="meta">Shared ${formatRelativeTime(entry.submittedAt)}</div>
        </div>
      </div>
      <div class="summary">${escapeHtml(session.summary)}</div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${files}</div>
          <div class="stat-label">Files</div>
        </div>
        <div class="stat">
          <div class="stat-value">${commits}</div>
          <div class="stat-label">Commits</div>
        </div>
        <div class="stat">
          <div class="stat-value">${errors}</div>
          <div class="stat-label">Errors</div>
        </div>
      </div>
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      ${scoreHtml}
    </article>
  `;
}

async function loadSessions() {
  statusLine.textContent = 'Loading shared sessions…';
  if (statusDot) statusDot.style.background = 'var(--orange)';

  try {
    const response = await fetch('/api/sessions');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      sessionGrid.innerHTML = '';
      emptyState.classList.remove('hidden');
      statusLine.textContent = 'Feed is live — waiting for the first opt-in submission.';
      if (statusDot) statusDot.style.background = 'var(--green)';
      return;
    }

    emptyState.classList.add('hidden');
    sessionGrid.innerHTML = sessions.map(renderSession).join('');
    statusLine.textContent = `${sessions.length} real shared session${sessions.length === 1 ? '' : 's'} · updated ${formatRelativeTime(data.aggregatedAt)}`;
    if (statusDot) statusDot.style.background = 'var(--green)';
  } catch (error) {
    sessionGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    emptyState.querySelector('h2').textContent = 'Could not load sessions';
    emptyState.querySelector('p').textContent =
      'The API may be starting up. Try refreshing in a moment.';
    statusLine.textContent = `Error: ${error.message}`;
    if (statusDot) statusDot.style.background = 'var(--red)';
  }
}

refreshBtn.addEventListener('click', loadSessions);
loadSessions();
setInterval(loadSessions, 30000);