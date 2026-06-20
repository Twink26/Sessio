# Session Recap (Sessio)

[![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-brightgreen.svg)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Session Recap** is a VS Code extension that remembers what you were working on — so you can pick up exactly where you left off.

It runs quietly in the background while you code, tracking file edits, git commits, and terminal errors. When you come back, the sidebar shows an AI-generated summary, your edited files, recent commits, and a productivity score.

> **Not on the VS Code Marketplace yet.** Install from source — it takes about five minutes, and this guide walks you through every step.

---

## Table of contents

- [What you'll need](#what-youll-need)
- [Install the extension (step by step)](#install-the-extension-step-by-step)
- [Day-to-day usage](#day-to-day-usage)
- [Optional: AI summaries with OpenAI](#optional-ai-summaries-with-openai)
- [Optional: share sessions to a dashboard](#optional-share-sessions-to-a-dashboard)
- [Commands](#commands)
- [Settings](#settings)
- [Troubleshooting](#troubleshooting)
- [Privacy](#privacy)
- [Development](#development)

---

## What you'll need

Before you start, install these on your computer:

| Tool | Why | How to check |
|------|-----|--------------|
| **[VS Code](https://code.visualstudio.com/)** | The editor the extension runs in | Open VS Code |
| **[Node.js 18+](https://nodejs.org/)** | Builds the extension | Run `node --version` in a terminal |
| **[Git](https://git-scm.com/)** | Clone the repository | Run `git --version` in a terminal |

You do **not** need an OpenAI API key to get started — the extension works without one using a rule-based summary built from your real activity.

---

## Install the extension (step by step)

These steps assume you've never installed a VS Code extension from source before.

### Step 1 — Clone the repository

Open a terminal (PowerShell, Terminal, or Command Prompt) and run:

```bash
git clone https://github.com/Twink26/Sessio.git
cd Sessio
```

This downloads the project into a folder called `Sessio`.

### Step 2 — Install dependencies and build

Still in the `Sessio` folder, run:

```bash
npm install
npm run compile
```

- `npm install` downloads the libraries the extension needs (this may take a minute).
- `npm run compile` converts the TypeScript source code into JavaScript VS Code can run.

Wait until both commands finish without errors before continuing.

### Step 3 — Open the project in VS Code

1. Open **VS Code**
2. Go to **File → Open Folder…**
3. Select the `Sessio` folder you cloned
4. Click **Select Folder**

You should see the project files in the Explorer panel on the left.

### Step 4 — Launch the extension (Extension Development Host)

The extension isn't installed in your normal VS Code yet — you run it in a special debug window:

1. Press **F5** (or go to **Run → Start Debugging**)
2. A **second** VS Code window opens — this is the **Extension Development Host**
3. Look for a notification: **"Session Recap extension is now active."**

> **Tip:** Keep the first window open — that's your development copy. Do your actual coding in the **second** window (the Extension Development Host).

### Step 5 — Open a project and find the sidebar

In the **Extension Development Host** window (the second one):

1. Open any project you want to work on (**File → Open Folder…**)
2. In the left **Explorer** panel, scroll down
3. Find the section labeled **Session Recap** and click to expand it

The panel will be empty the first time — that's normal. No session has been tracked yet.

### Step 6 — Verify it's working

1. Edit and save a file in your project
2. Make a git commit if you can (optional but helpful)
3. **Close or reload** the Extension Development Host window (**Developer: Reload Window** from the Command Palette, or just close VS Code)
4. Press **F5** again from the original `Sessio` window to reopen the Extension Development Host
5. Open the same project folder and expand **Session Recap** again

You should now see your previous session: summary, edited files, commits, and a productivity score.

**You're done with installation.** Everything below is about using it day to day.

---

## Day-to-day usage

### How tracking works

Once the extension is active, you don't need to start or stop anything manually:

- **File edits** — tracked when you save
- **Git commits** — tracked automatically
- **Terminal errors** — captured from the integrated terminal
- **Session end** — saved when you close or reload the VS Code window

All of this stays **on your machine** unless you explicitly opt in to sharing (see below).

### Reading your recap

Open the **Session Recap** panel in the Explorer sidebar. You'll see:

| Section | What it shows |
|---------|---------------|
| **AI Summary** | A short paragraph describing what you worked on |
| **Edited Files** | Files you changed — click one to open it |
| **Git Commits** | Recent commits with messages |
| **Terminal Errors** | Errors from your last session |
| **Productivity Score** | A simple score based on your activity |

### When sessions update

- A new session starts when you open VS Code with the extension running
- The previous session is saved and summarized when you **close** or **reload** the window
- Use **Session Recap: Refresh** (see [Commands](#commands)) to reload the panel without restarting

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`) | Refresh the Session Recap panel |
| `Ctrl+Shift+H` (Mac: `Cmd+Shift+H`) | View session history |
| `Ctrl+Shift+A` (Mac: `Cmd+Shift+A`) | View analytics |
| `Ctrl+Shift+F` (Mac: `Cmd+Shift+F`) | Search sessions |

Shortcuts only work when the Session Recap view is focused (for refresh) or globally (for history/analytics/search).

### Typical workflow

```
Morning:  Open VS Code (F5 → Extension Development Host) → read yesterday's recap
During:   Code normally — tracking is automatic
Evening:  Close VS Code → session is saved and summarized
Next day: Open again → recap tells you exactly where you left off
```

---

## Optional: AI summaries with OpenAI

By default, summaries are generated **locally** from your activity (no API key needed). For richer, natural-language summaries, connect OpenAI:

### Step 1 — Get an API key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create an API key and copy it

### Step 2 — Add it to VS Code settings

1. Open **Settings** (`Ctrl+,` / `Cmd+,`)
2. Search for `sessionRecap`
3. Set these values:

| Setting | Value |
|---------|-------|
| `sessionRecap.aiProvider` | `openai` |
| `sessionRecap.openaiApiKey` | Your API key |
| `sessionRecap.enableAISummary` | `true` (default) |

Or add to your `settings.json`:

```json
{
  "sessionRecap.aiProvider": "openai",
  "sessionRecap.openaiApiKey": "sk-your-key-here",
  "sessionRecap.enableAISummary": true
}
```

### Step 3 — Reload and test

Reload the window (**Developer: Reload Window**), do some coding, then close and reopen. Your next recap should use the AI summary.

> **Without an OpenAI key:** set `sessionRecap.aiProvider` to `disabled` to use only the local rule-based summary, or leave the default — it falls back automatically when no key is set.

---

## Optional: share sessions to a dashboard

Sharing is **off by default**. Nothing leaves your machine unless you turn it on.

### Local dashboard (for testing)

The repo includes a small web server that shows a live feed of opted-in sessions.

**Terminal 1 — start the server** (from the repo root):

```bash
npm run server
```

Open http://localhost:3847 in your browser.

**Optional — protect the dashboard with a key:**

```bash
cd server
cp .env.example .env
# Edit .env and set DASHBOARD_KEY=your-secret-key-here
npm start
```

Then open the dashboard with `?key=your-secret-key-here` or send the `x-dashboard-key` header. See `server/README.md` for API details.

**VS Code settings:**

| Setting | Value |
|---------|-------|
| `sessionRecap.shareApiUrl` | `http://localhost:3847` (default) |
| `sessionRecap.enableTeamDashboard` | `true` |

**Opt in:**

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **Session Recap: Opt In to Team Sharing**
3. Code as normal, then close VS Code — your session is posted on shutdown

To stop sharing: run **Session Recap: Opt Out of Team Sharing**.

Optional: set `sessionRecap.contributorDisplayName` to control the name shown on the feed (defaults to your git `user.name`).

---

## Commands

Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type `Session Recap`:

| Command | What it does |
|---------|--------------|
| **Refresh Session Recap** | Reload the sidebar with the latest session data |
| **Clear Session Data** | Reset the current session tracker |
| **View Session History** | Browse past sessions |
| **View Analytics** | See productivity analytics |
| **Search Sessions** | Search through session history |
| **Export Sessions** | Export session data to a file |
| **Import Sessions** | Import session data from a file |
| **Add Notes to Session** | Attach notes to the current session |
| **Add Tags to Session** | Tag the current session |
| **Opt In to Team Sharing** | Enable posting to the dashboard |
| **Opt Out of Team Sharing** | Disable posting to the dashboard |
| **Open Public Session Feed** | Open the dashboard URL in your browser |
| **Refresh Team Dashboard** | Reload team dashboard data |
| **Show Session Recap Logs** | Open the extension log for debugging |
| **Show Telemetry Summary** | View performance telemetry |
| **Set Log Level** | Change log verbosity |

---

## Settings

All settings live under the `sessionRecap` prefix in VS Code Settings.

### Essential settings

| Setting | Default | Description |
|---------|---------|-------------|
| `sessionRecap.enabled` | `true` | Turn tracking on or off |
| `sessionRecap.enableAISummary` | `true` | Enable summary generation |
| `sessionRecap.aiProvider` | `disabled` | `openai`, `local`, or `disabled` |
| `sessionRecap.openaiApiKey` | `""` | Your OpenAI API key |
| `sessionRecap.maxCommitsToShow` | `10` | Commits shown in the sidebar |

### Sharing settings

| Setting | Default | Description |
|---------|---------|-------------|
| `sessionRecap.shareApiUrl` | `http://localhost:3847` | Dashboard API URL (empty = disabled) |
| `sessionRecap.enableTeamDashboard` | `false` | Show the Team Dashboard sidebar view |
| `sessionRecap.privacySettings.shareWithTeam` | `false` | Whether you're opted in to sharing |
| `sessionRecap.contributorDisplayName` | `""` | Name on the public feed |

### Privacy filters

| Setting | Default | Description |
|---------|---------|-------------|
| `sessionRecap.privacySettings.excludeFilePatterns` | `*.log`, `node_modules/**`, `.git/**` | Files to ignore |
| `sessionRecap.privacySettings.excludeCommitPatterns` | `WIP:`, `temp:`, `debug:` | Commits to ignore |

---

## Troubleshooting

### "Session Recap extension is now active" never appears

- Make sure you pressed **F5** from the `Sessio` project folder (not from a random project)
- Check the **Debug Console** in the first VS Code window for errors
- Run `npm run compile` again and retry

### The sidebar is empty after coding

- Sessions save when you **close or reload** the window — editing alone isn't enough until the session ends
- Run **Session Recap: Refresh** from the Command Palette
- Confirm `sessionRecap.enabled` is `true` in settings

### `npm install` or `npm run compile` fails

- Confirm Node.js 18+: `node --version`
- Delete `node_modules` and retry: `rm -rf node_modules && npm install` (Mac/Linux) or remove the folder manually on Windows
- Make sure you're in the `Sessio` folder, not `Sessio/server`

### AI summary isn't working

- Check `sessionRecap.aiProvider` is set to `openai` and your API key is valid
- Without a key, you'll get a local rule-based summary instead — that's expected
- Run **Session Recap: Show Session Recap Logs** to see errors

### Sharing to the dashboard doesn't work

- Confirm the server is running: `npm run server` and visit http://localhost:3847/api/health
- Set `sessionRecap.enableTeamDashboard` to `true`
- Run **Session Recap: Opt In to Team Sharing**
- Close VS Code to trigger the upload (sessions post on shutdown)

### Something else went wrong

1. Command Palette → **Session Recap: Show Session Recap Logs**
2. Copy relevant log lines
3. [Open an issue on GitHub](https://github.com/Twink26/Sessio/issues) with your VS Code version, steps to reproduce, and the log output

---

## Privacy

- **Local by default** — all tracking and summaries stay on your machine
- **Sharing is opt-in** — nothing is posted unless you run **Opt In to Team Sharing**
- **Your API keys** — OpenAI keys are stored in your VS Code settings, not sent anywhere except OpenAI when you enable that provider
- **Configurable filters** — exclude sensitive file paths and commit patterns from tracking and sharing

For the sharing server, see [server/README.md](server/README.md).

---

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.74.0+
- TypeScript 4.9+

### Scripts

```bash
npm install          # Install dependencies
npm run compile      # Build once
npm run watch        # Rebuild on file changes
npm test             # Run tests
npm run test:all     # Run all Jest tests
npm run server       # Start the sharing API + dashboard
npm run server:dev   # Start server with auto-reload
```

### Project structure

```
Sessio/
├── src/                    # Extension source (TypeScript)
│   ├── extension.ts        # Entry point
│   ├── services/           # Tracking, AI, sharing logic
│   ├── providers/          # Sidebar UI
│   └── models/             # Data types
├── server/                 # Optional sharing API + web dashboard
│   ├── index.js
│   └── public/             # Landing page + dashboard HTML
├── package.json            # Extension manifest
└── README.md               # This file
```

---

## License

MIT — see [LICENSE](LICENSE).

---

**Built for developers who are tired of spending the first five minutes back at their desk re-reading their own code.**

[GitHub](https://github.com/Twink26/Sessio) · [Report an issue](https://github.com/Twink26/Sessio/issues)
