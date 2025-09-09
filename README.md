# Session Recap Extension

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://github.com/your-username/session-recap-extension)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-brightgreen.svg)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A VS Code extension that provides an AI-generated summary of your previous coding session to help you resume work efficiently. Never lose track of what you were working on again!

##  Features

### Core Functionality
- **Automatic Session Tracking**: Monitors file changes, Git commits, and terminal errors
- **AI-Powered Summaries**: Generates intelligent summaries of your coding sessions
- **Quick File Navigation**: Click on files from your previous session to open them instantly
- **Git Activity Overview**: See recent commits with messages and timestamps
- **Error Tracking**: Keep track of terminal errors from your last session

### Team Collaboration
- **Team Dashboard**: View session summaries across your team (optional)
- **Privacy Controls**: Granular control over what data is shared
- **Opt-in Sharing**: Team features are completely optional and require explicit consent

### Performance & Reliability
- **Optimized Performance**: Minimal impact on VS Code startup and runtime
- **Error Handling**: Robust error handling with detailed logging
- **Configurable**: Extensive configuration options to customize behavior



### Session Recap Panel
The main sidebar panel showing your previous session summary:

```
┌─ Session Recap ──────────────────┐
│ Session Overview              │
│ Session ID: abc123               │
│ Started: 2024-01-15 09:30 AM     │
│ Duration: 2h 45m                 │
│ Status: ✅ Completed             │
│                                  │
│  Files Edited (3)             │
│ ▶ src/components/Header.tsx      │
│ ▶ src/styles/main.css            │
│ ▶ README.md                      │
│                                  │
│  Git Commits (2)              │
│ ▶ feat: add responsive header    │
│ ▶ fix: css styling issues        │
│                                  │
│  Terminal Errors (1)           │
│ ▶ TypeError: Cannot read...      │
│                                  │
│  AI Summary                    │
│ You worked on improving the      │
│ header component, adding         │
│ responsive design and fixing     │
│ CSS styling issues.              │
└──────────────────────────────────┘
```

##  Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Session Recap"
4. Click Install

### From VSIX Package
1. Download the `.vsix` file from releases
2. Open VS Code
3. Run `Extensions: Install from VSIX...` from Command Palette
4. Select the downloaded file

### Development Installation
```bash
git clone https://github.com/your-username/session-recap-extension.git
cd session-recap-extension
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

##  Configuration

The extension provides extensive configuration options through VS Code settings:

### Basic Settings
```json
{
  "sessionRecap.enabled": true,
  "sessionRecap.maxCommitsToShow": 10,
  "sessionRecap.enableAISummary": true
}
```

### AI Configuration
```json
{
  "sessionRecap.aiProvider": "openai",
  "sessionRecap.openaiApiKey": "your-api-key-here",
  "sessionRecap.aiMaxTokens": 150,
  "sessionRecap.aiTemperature": 0.7
}
```

### Team Features
```json
{
  "sessionRecap.enableTeamDashboard": false,
  "sessionRecap.privacySettings.shareWithTeam": false,
  "sessionRecap.privacySettings.excludeFilePatterns": [
    "*.log",
    "node_modules/**",
    ".git/**"
  ]
}
```

### Privacy & Filtering
```json
{
  "sessionRecap.privacySettings.excludeCommitPatterns": [
    "WIP:",
    "temp:",
    "debug:"
  ]
}
```

##  Usage

### Getting Started
1. Install the extension
2. Restart VS Code
3. The Session Recap panel will appear in the sidebar
4. Start coding - your activity is automatically tracked
5. When you restart VS Code, you'll see a summary of your previous session

### AI Summary Setup
1. Choose your AI provider in settings:
   - `openai`: Use OpenAI GPT models (requires API key)
   - `local`: Use local AI models (if available)
   - `disabled`: No AI summaries, show raw data only

2. For OpenAI:
   - Get an API key from [OpenAI](https://platform.openai.com/api-keys)
   - Add it to `sessionRecap.openaiApiKey` setting
   - Adjust `aiMaxTokens` and `aiTemperature` as needed

### Team Dashboard (Optional)
1. Enable team features: `sessionRecap.enableTeamDashboard: true`
2. Opt-in to sharing: Use the "Opt In to Team Sharing" command
3. Configure privacy settings to control what data is shared
4. View team dashboard in the sidebar

##  Commands

Access these commands through the Command Palette (Ctrl+Shift+P):

| Command | Description |
|---------|-------------|
| `Session Recap: Refresh` | Manually refresh the session recap |
| `Session Recap: Clear Session Data` | Clear current session data |
| `Session Recap: Show Logs` | Open the extension's log output |
| `Session Recap: Set Log Level` | Change logging verbosity |
| `Session Recap: Refresh Team Dashboard` | Update team dashboard data |
| `Session Recap: Opt In to Team Sharing` | Enable sharing with team |
| `Session Recap: Opt Out of Team Sharing` | Disable sharing with team |
| `Session Recap: Show Telemetry Summary` | View extension performance data |

##  Development

### Prerequisites
- Node.js 16.x or higher
- VS Code 1.74.0 or higher
- TypeScript 4.9.4 or higher

### Setup
```bash
# Clone the repository
git clone https://github.com/your-username/session-recap-extension.git
cd session-recap-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm run test

# Watch for changes during development
npm run watch
```

### Testing
```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run all tests
npm run test:all

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Project Structure
```
session-recap-extension/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── models/                   # Data models and interfaces
│   ├── services/                 # Core business logic
│   ├── providers/                # VS Code UI providers
│   ├── interfaces/               # TypeScript interfaces
│   ├── utils/                    # Utility functions
│   └── __tests__/               # Test files
├── .kiro/specs/                 # Feature specifications
├── package.json                 # Extension manifest
└── README.md                    # This file
```

##  Privacy & Security

### Data Collection
The extension only collects data locally within your VS Code workspace:
- File paths and modification timestamps
- Git commit messages and metadata
- Terminal error messages
- Session timing information

### Team Sharing
- **Opt-in Only**: Team features require explicit user consent
- **Configurable**: Control exactly what data is shared
- **Local Storage**: All data is stored locally by default
- **No External Services**: No data is sent to external services without your configuration

### AI Processing
- **Your Choice**: AI features are optional and configurable
- **API Keys**: You provide your own API keys for external AI services
- **Local Processing**: When possible, processing happens locally
- **No Data Retention**: AI services process data transiently

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Start for Contributors
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm run test:all`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Update documentation as needed
- Follow the existing code style
- Ensure all tests pass before submitting

##  License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

##  Issues & Support

### Reporting Issues
If you encounter any problems:
1. Check the [existing issues](https://github.com/your-username/session-recap-extension/issues)
2. Use the "Show Logs" command to gather diagnostic information
3. Create a new issue with:
   - VS Code version
   - Extension version
   - Steps to reproduce
   - Log output (if relevant)


##  Roadmap

### Upcoming Features
- [ ] Integration with more AI providers
- [ ] Enhanced team collaboration features
- [ ] Session analytics and insights
- [ ] Export/import session data
- [ ] Custom summary templates
- [ ] Integration with project management tools

### Version History
- **0.0.1** - Initial release with core session tracking and AI summaries

##  Acknowledgments

- Thanks to the VS Code team for the excellent extension API
- OpenAI for providing AI capabilities


---

**Made with ❤️ for developers who want to stay focused and productive.**

*If you find this extension helpful, please consider giving it a ⭐ on GitHub and leaving a review on the VS Code Marketplace!*