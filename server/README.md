# Session Recap Public API & Dashboard

Honest, opt-in sharing for the Session Recap VS Code extension. Developers choose to post **their own** session summaries; the dashboard shows **real** submissions only.

## Quick start (local)

```bash
# From repo root
npm run server
```

Open http://localhost:3847

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/sessions` | List all shared sessions (newest first) |
| POST | `/api/sessions` | Submit an opt-in session summary |

### POST body

```json
{
  "contributorId": "uuid-from-extension",
  "displayName": "Your Name",
  "session": {
    "sessionId": "...",
    "summary": "What you worked on...",
    "startTime": "2026-01-01T10:00:00.000Z",
    "endTime": "2026-01-01T12:00:00.000Z",
    "editedFiles": [],
    "gitCommits": [],
    "terminalErrors": []
  }
}
```

Data is stored in `server/data/sessions.json` (gitignored).

## Extension setup

1. Start this server (`npm run server`)
2. In VS Code settings:
   - `sessionRecap.shareApiUrl` → `http://localhost:3847` (default)
   - `sessionRecap.enableTeamDashboard` → `true`
3. Command Palette → **Session Recap: Opt In to Team Sharing**
4. Code, then close VS Code — your session is POSTed on shutdown (if opted in)

Optional: `sessionRecap.contributorDisplayName` overrides git `user.name` on the feed.

## Deploy (24h friendly)

Any Node host works (Render, Railway, Fly.io, VPS):

1. Deploy the `server/` folder
2. Set `PORT` env var
3. Use persistent disk for `data/` if available
4. Set extension `sessionRecap.shareApiUrl` to your public URL

## Privacy

- Nothing is posted unless the user opts in
- Extension privacy filters (exclude file/commit patterns) apply before POST
- No fake users or demo data on the feed
