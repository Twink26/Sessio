require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 3847;
const MAX_SESSIONS = 500;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'sessions.json');

// NEW: Dashboard key from environment (optional — unprotected if unset)
const DASHBOARD_KEY = process.env.DASHBOARD_KEY;

const app = express();

// NEW: Warn at startup when dashboard is unprotected
if (!DASHBOARD_KEY) {
  console.warn('WARNING: DASHBOARD_KEY not set — dashboard is unprotected');
}

// NEW: Middleware — require matching key on protected routes when DASHBOARD_KEY is set
function dashboardKeyMiddleware(req, res, next) {
  if (!DASHBOARD_KEY) {
    console.warn('WARNING: DASHBOARD_KEY not set — dashboard is unprotected');
    return next();
  }

  const providedKey = req.query.key || req.headers['x-dashboard-key'];
  if (providedKey !== DASHBOARD_KEY) {
    return res.status(401).json({ error: 'Invalid or missing dashboard key' });
  }

  next();
}

app.use(cors());
app.use(express.json({ limit: '256kb' }));

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function loadSessions() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function saveSessions(sessions) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(sessions, null, 2), 'utf8');
}

function validateSubmission(body) {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }
  if (!body.contributorId || typeof body.contributorId !== 'string') {
    return 'contributorId is required';
  }
  if (!body.displayName || typeof body.displayName !== 'string') {
    return 'displayName is required';
  }
  if (!body.session || typeof body.session !== 'object') {
    return 'session is required';
  }
  if (!body.session.sessionId || typeof body.session.sessionId !== 'string') {
    return 'session.sessionId is required';
  }
  if (!body.session.summary || typeof body.session.summary !== 'string') {
    return 'session.summary is required';
  }
  return null;
}

// Public — no dashboard key required
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'session-recap-api' });
});

// NEW: Protected — requires dashboard key when DASHBOARD_KEY is set
app.get('/api/sessions', dashboardKeyMiddleware, async (_req, res) => {
  try {
    const sessions = await loadSessions();
    sessions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    res.json({
      sessions,
      count: sessions.length,
      aggregatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET /api/sessions failed:', error);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

// Public — extension submits sessions without a dashboard key
app.post('/api/sessions', async (req, res) => {
  const validationError = validateSubmission(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const sessions = await loadSessions();
    const entry = {
      id: randomUUID(),
      contributorId: req.body.contributorId.trim(),
      displayName: req.body.displayName.trim().slice(0, 80),
      submittedAt: new Date().toISOString(),
      session: req.body.session
    };

    // Replace previous submission from same contributor for same session id
    const filtered = sessions.filter(
      (s) =>
        !(
          s.contributorId === entry.contributorId &&
          s.session?.sessionId === entry.session.sessionId
        )
    );

    filtered.unshift(entry);
    await saveSessions(filtered.slice(0, MAX_SESSIONS));

    res.status(201).json(entry);
  } catch (error) {
    console.error('POST /api/sessions failed:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// NEW: Protected dashboard page — registered before express.static so the key is enforced
app.get('/dashboard.html', dashboardKeyMiddleware, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Public static assets (landing page, CSS, JS) — dashboard.html is handled above
app.use(express.static(path.join(__dirname, 'public')));

// Public landing page fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Session Recap API running at http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard.html`);
});
