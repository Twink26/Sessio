# Technical Architecture & Logic - Session Recap Extension

This document explains the technical architecture, design patterns, and implementation logic used to build the Session Recap VS Code extension.

---

## 🏗️ Overall Architecture

### Architecture Pattern: **Service-Oriented Architecture (SOA)**

The extension follows a **layered service-oriented architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    Extension Entry Point                 │
│                  (extension.ts)                         │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐      ┌─────────▼──────────┐
│   Providers    │      │     Services       │
│  (UI Layer)    │      │  (Business Logic)  │
└───────┬────────┘      └─────────┬──────────┘
        │                         │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │      Data Models        │
        │   (Domain Objects)      │
        └─────────────────────────┘
```

---

## 🎯 Core Design Patterns

### 1. **Observer Pattern**
Used extensively for event-driven monitoring:

- **FileChangeMonitor**: Observes file system changes via VS Code's `FileSystemWatcher`
- **TerminalErrorMonitor**: Observes terminal output via `onDidWriteData`
- **SessionTracker**: Observes changes from all monitors via callbacks

**Implementation:**
```typescript
// FileChangeMonitor uses VS Code's FileSystemWatcher
this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');
this.fileSystemWatcher.onDidChange((uri) => {
    this.handleFileChange(uri, 'modified');
});

// Callbacks registered by SessionTracker
this.fileChangeMonitor.onFileChanged((fileEdit) => {
    this.currentSession.editedFiles.push(fileEdit);
});
```

### 2. **Singleton Pattern**
Used for shared state management:

- **PerformanceMonitor**: Single instance tracks all performance metrics
- **PerformanceOptimizer**: Single instance manages optimization strategies

**Implementation:**
```typescript
export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    
    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }
}
```

### 3. **Strategy Pattern**
Used for AI provider selection:

- **AISummaryService**: Different strategies for OpenAI, local AI, or fallback
- **ErrorHandlingService**: Different error handling strategies based on error type

**Implementation:**
```typescript
switch (this.config.provider) {
    case 'openai':
        return await this.generateOpenAISummary(sessionData);
    case 'local':
        return await this.generateLocalSummary(sessionData);
    default:
        return this.generateFallbackSummary(sessionData);
}
```

### 4. **Repository Pattern**
Used for data persistence:

- **SessionStorage**: Abstracts storage implementation (file-based)
- Provides CRUD operations for session data

**Implementation:**
```typescript
interface ISessionStorage {
    saveSession(sessionData: SessionData): Promise<void>;
    loadLastSession(): Promise<SessionData | null>;
    loadSession(sessionId: string): Promise<SessionData | null>;
    deleteSession(sessionId: string): Promise<void>;
}
```

### 5. **Facade Pattern**
**SessionTracker** acts as a facade, simplifying interaction with multiple monitors:

```typescript
// Instead of calling each monitor separately:
sessionTracker.startTracking(); // Handles all monitors internally
```

---

## 🔄 Data Flow Architecture

### Session Lifecycle Flow

```
1. VS Code Startup
   ↓
2. Extension Activation (extension.ts)
   ↓
3. Initialize Services (Error Handling, Configuration, etc.)
   ↓
4. Create SessionTracker
   ↓
5. Load Previous Session from Storage
   ↓
6. Generate AI Summary (if enabled)
   ↓
7. Display Previous Session in UI
   ↓
8. Start Tracking New Session
   ├─→ FileChangeMonitor (watches file system)
   ├─→ GitActivityMonitor (polls Git every 30s)
   └─→ TerminalErrorMonitor (watches terminal output)
   ↓
9. User Activity Detected
   ├─→ File changes → SessionTracker → Update Session → Throttled UI Update
   ├─→ Git commits → SessionTracker → Update Session → Throttled UI Update
   └─→ Terminal errors → SessionTracker → Update Session → Throttled UI Update
   ↓
10. VS Code Shutdown
    ↓
11. Save Current Session
    ↓
12. Calculate Productivity Score
    ↓
13. Persist to Storage
```

### Real-Time Tracking Flow

```
File System Event
    ↓
FileChangeMonitor.handleFileChange()
    ↓
Debounce (500ms) → Prevent duplicate events
    ↓
Get Line Count (async)
    ↓
Create FileEdit Object
    ↓
Callback to SessionTracker
    ↓
Update currentSession.editedFiles[]
    ↓
Throttled Sidebar Update (1s delay)
    ↓
SidebarPanelProvider.updateContent()
    ↓
Webview postMessage()
    ↓
Frontend JavaScript updates UI
```

---

## 🧠 Core Technologies & APIs

### 1. **VS Code Extension API**

#### File System Monitoring
```typescript
// Create file system watcher
const watcher = vscode.workspace.createFileSystemWatcher('**/*');

// Listen to events
watcher.onDidCreate((uri) => { /* handle */ });
watcher.onDidChange((uri) => { /* handle */ });
watcher.onDidDelete((uri) => { /* handle */ });
```

#### Terminal API
```typescript
// Monitor terminal output
vscode.window.onDidOpenTerminal((terminal) => {
    terminal.onDidWriteData((data) => {
        // Process terminal output
    });
});
```

#### Webview API
```typescript
// Create webview provider
vscode.window.registerWebviewViewProvider('sessionRecap', provider);

// Communication between extension and webview
webview.postMessage({ type: 'updateSession', sessionData });
webview.onDidReceiveMessage((message) => { /* handle */ });
```

### 2. **Node.js APIs**

#### Child Process (for Git commands)
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Execute Git commands
const { stdout } = await execAsync('git log --since="..."', {
    cwd: workspaceRoot,
    timeout: 10000
});
```

#### File System (for storage)
```typescript
import * as fs from 'fs/promises';

// Async file operations
await fs.writeFile(filePath, jsonData, 'utf8');
const data = await fs.readFile(filePath, 'utf8');
```

### 3. **TypeScript**

- **Type Safety**: Strong typing throughout
- **Interfaces**: Define contracts between components
- **Generics**: Used in data converters and validators
- **Async/Await**: For all asynchronous operations

---

## ⚡ Performance Optimizations

### 1. **Debouncing**

**Purpose**: Prevent excessive processing of rapid events

**Implementation in FileChangeMonitor:**
```typescript
private readonly debounceDelay = 500; // 500ms
private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

// Debounce file changes
const debounceKey = `${filePath}:${changeType}`;
const existingTimer = this.debounceTimers.get(debounceKey);
if (existingTimer) {
    clearTimeout(existingTimer); // Cancel previous timer
}
const newTimer = setTimeout(() => {
    this.processPendingChange(debounceKey, uri);
}, this.debounceDelay);
```

**Why**: File saves can trigger multiple events. Debouncing batches them.

### 2. **Throttling**

**Purpose**: Limit UI update frequency

**Implementation in SessionTracker:**
```typescript
private readonly sidebarUpdateDelay = 1000; // 1 second
private sidebarUpdateThrottle: NodeJS.Timeout | undefined;

private throttledSidebarUpdate(): void {
    if (this.sidebarUpdateThrottle) {
        clearTimeout(this.sidebarUpdateThrottle);
    }
    this.sidebarUpdateThrottle = setTimeout(() => {
        this.updateSidebarContent();
    }, this.sidebarUpdateDelay);
}
```

**Why**: Prevents UI flickering from rapid updates.

### 3. **Caching**

**Purpose**: Avoid redundant expensive operations

**Implementation in GitActivityMonitor:**
```typescript
private commitsCache: Map<string, { commits: GitCommit[]; timestamp: number }> = new Map();
private readonly cacheTimeout = 30000; // 30 seconds

// Check cache before executing Git command
const cachedResult = this.commitsCache.get(cacheKey);
if (cachedResult && (now - cachedResult.timestamp) < this.cacheTimeout) {
    return cachedResult.commits; // Return cached result
}
```

**Why**: Git commands are expensive. Caching reduces system calls.

### 4. **Memory Management**

**Purpose**: Prevent memory leaks in long-running sessions

**Strategies:**

#### a) **Limit Collection Sizes**
```typescript
private readonly maxTrackedFiles = 1000;

if (this.editedFiles.length >= this.maxTrackedFiles) {
    // Remove oldest 10%
    const removeCount = Math.floor(this.maxTrackedFiles * 0.1);
    this.editedFiles.splice(0, removeCount);
}
```

#### b) **Periodic Cleanup**
```typescript
// Clean up old entries every 5 minutes
setInterval(() => {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    this.editedFiles = this.editedFiles.filter(
        edit => now - edit.timestamp.getTime() < maxAge
    );
}, 5 * 60 * 1000);
```

#### c) **Buffer Size Limits**
```typescript
private readonly maxBufferSize = 100; // Max lines per terminal
private readonly maxLineLength = 1000; // Max characters per line

if (buffer.length > this.maxBufferSize) {
    buffer = buffer.slice(-this.maxBufferSize); // Keep only recent
}
```

### 5. **Lazy Loading**

**Purpose**: Defer expensive operations until needed

**Implementation:**
```typescript
// Previous session loaded on-demand
async ensurePreviousSessionLoaded(): Promise<SessionData | null> {
    if (this.previousSession === null) {
        await this.loadPreviousSession(); // Load only when needed
    }
    return this.getPreviousSession();
}
```

### 6. **Performance Monitoring**

**Purpose**: Track and optimize slow operations

**Implementation:**
```typescript
const timer = this.performanceMonitor.startTimer('OperationName');
// ... perform operation ...
const duration = timer.end();

if (duration > 500) {
    // Log warning for slow operations
    this.logPerformanceSummary();
}
```

---

## 🔍 Key Algorithms & Logic

### 1. **Productivity Score Calculation**

**Algorithm**: Weighted scoring system

```typescript
calculateProductivityScore(session: SessionData): number {
    // Normalize factors (0-1 scale)
    const filesScore = Math.min(session.editedFiles.length / 20, 1);
    const commitsScore = Math.min(session.gitCommits.length / 10, 1);
    const durationScore = Math.min(durationMinutes / 120, 1);
    
    // Error penalty
    const errorPenalty = Math.min(session.terminalErrors.length / 5, 1);
    
    // Weighted calculation
    const baseScore = (
        filesScore * 0.3 +      // 30% weight
        commitsScore * 0.3 +     // 30% weight
        durationScore * 0.2      // 20% weight
    );
    
    // Apply error penalty (up to 20% reduction)
    const finalScore = baseScore * (1 - errorPenalty * 0.2);
    
    return Math.round(finalScore * 100); // Convert to 0-100 scale
}
```

**Logic**:
- Files edited: Max 20 files = 100% score
- Commits: Max 10 commits = 100% score
- Duration: Max 120 minutes = 100% score
- Errors: Each error reduces score by up to 4%

### 2. **Error Detection Algorithm**

**Pattern Matching Strategy**:

```typescript
// Multi-level pattern matching
private isErrorLine(line: string): boolean {
    // Quick check first (most common cases)
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('error') || lowerLine.includes('exception')) {
        return true; // Fast path
    }
    
    // Full pattern matching for edge cases
    return this.errorPatterns.some(pattern => pattern.test(line));
}
```

**Patterns Used**:
- Generic: `/error:/i`, `/exception:/i`, `/failed/i`
- Language-specific: `/SyntaxError:/i`, `/TypeError:/i`
- Build tools: `/build failed/i`, `/compilation failed/i`
- Package managers: `/npm ERR!/i`, `/yarn error/i`

### 3. **Git Commit Parsing**

**Algorithm**: Parse structured Git log output

```typescript
// Git command format: "%H|%s|%an|%ai"
// Output: "hash|message|author|timestamp\nfile1\nfile2"

parseGitLogOutput(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const commitBlocks = output.split('\n\n'); // Split by double newline
    
    for (const block of commitBlocks) {
        const lines = block.split('\n');
        const [hash, message, author, timestamp] = lines[0].split('|');
        const filesChanged = lines.slice(1).filter(line => line.trim());
        
        commits.push({
            hash: hash.trim(),
            message: message.trim(),
            author: author.trim(),
            timestamp: new Date(timestamp.trim()),
            filesChanged: filesChanged.slice(0, 50) // Limit files
        });
    }
    
    return commits.sort((a, b) => 
        b.timestamp.getTime() - a.timestamp.getTime()
    ).slice(0, 10); // Return top 10
}
```

### 4. **Session Search Algorithm**

**Full-Text Search Implementation**:

```typescript
async searchSessions(query: string): Promise<SessionData[]> {
    const lowerQuery = query.toLowerCase();
    
    return allSessions.filter(session => {
        // Search in multiple fields
        return (
            session.summary?.toLowerCase().includes(lowerQuery) ||
            session.notes?.toLowerCase().includes(lowerQuery) ||
            session.editedFiles.some(file => 
                file.filePath.toLowerCase().includes(lowerQuery)
            ) ||
            session.gitCommits.some(commit => 
                commit.message.toLowerCase().includes(lowerQuery)
            ) ||
            session.tags?.some(tag => 
                tag.toLowerCase().includes(lowerQuery)
            )
        );
    });
}
```

---

## 🗄️ Data Models & Storage

### Data Structure Hierarchy

```
SessionData
├── sessionId: string (UUID)
├── startTime: Date
├── endTime?: Date
├── editedFiles: FileEdit[]
│   ├── filePath: string
│   ├── timestamp: Date
│   ├── changeType: 'created' | 'modified' | 'deleted'
│   └── lineCount?: number
├── gitCommits: GitCommit[]
│   ├── hash: string
│   ├── message: string
│   ├── author: string
│   ├── timestamp: Date
│   └── filesChanged: string[]
├── terminalErrors: TerminalError[]
│   ├── message: string
│   ├── timestamp: Date
│   ├── terminalName: string
│   └── errorType: 'error' | 'exception' | 'failure'
├── summary?: string (AI-generated)
├── notes?: string (user-added)
├── tags?: string[] (user-defined)
└── productivityScore?: number (0-100)
```

### Storage Strategy

**File-Based JSON Storage**:
- Location: `{globalStorageUri}/sessions/{sessionId}.session.json`
- Format: JSON with schema versioning
- Migration: Automatic schema migration support

**Storage Flow**:
```
SessionData (Runtime)
    ↓
DataConverter.toStoredSession()
    ↓
StoredSession (Serializable)
    ↓
JSON.stringify()
    ↓
fs.writeFile()
    ↓
{sessionId}.session.json
```

---

## 🎨 Frontend Architecture

### Webview Communication Pattern

**Two-Way Communication**:

```typescript
// Extension → Webview
webview.postMessage({
    type: 'updateSession',
    sessionData: sessionData
});

// Webview → Extension
webview.onDidReceiveMessage((message) => {
    switch (message.type) {
        case 'fileClick':
            openFile(message.filePath);
            break;
    }
});
```

### UI Rendering Strategy

**Dynamic HTML Generation**:
- HTML/CSS/JS embedded as template strings
- No external dependencies
- Uses VS Code CSS variables for theming
- Client-side rendering with JavaScript

**Update Flow**:
```
Session Data Changed
    ↓
SidebarPanelProvider.updateContent()
    ↓
webview.postMessage({ type: 'updateSession', sessionData })
    ↓
Webview JavaScript receives message
    ↓
updateSessionDisplay(sessionData)
    ↓
DOM manipulation (innerHTML)
    ↓
UI Updated
```

---

## 🔐 Error Handling Strategy

### Multi-Layer Error Handling

1. **Service Level**: Try-catch in each service method
2. **Extension Level**: ErrorHandlingService wrapper
3. **User Level**: Friendly error messages

**Implementation**:
```typescript
await errorHandlingService.executeWithErrorHandling(
    async () => {
        // Operation that might fail
        await riskyOperation();
    },
    { 
        component: 'Extension', 
        operation: 'operationName' 
    },
    fallbackValue // Optional fallback
);
```

**Error Flow**:
```
Error Occurs
    ↓
Caught by executeWithErrorHandling()
    ↓
Logged to Output Channel
    ↓
Telemetry Recorded
    ↓
Fallback Value Returned (if provided)
    ↓
User Notification (if critical)
```

---

## 📊 Performance Monitoring

### Metrics Tracked

1. **Activation Time**: Extension startup duration
2. **Operation Timings**: Individual service operations
3. **Memory Usage**: Tracked via cleanup intervals
4. **Error Rates**: Tracked via ErrorHandlingService

### Performance Optimization Strategies

1. **Debouncing**: File changes (500ms)
2. **Throttling**: UI updates (1s)
3. **Caching**: Git operations (30s)
4. **Lazy Loading**: Previous session loading
5. **Memory Limits**: Max collections sizes
6. **Periodic Cleanup**: Old data removal

---

## 🔄 State Management

### Session State Flow

```
Initialization
    ↓
Create New Session (UUID + timestamp)
    ↓
Start Tracking
    ├─→ FileChangeMonitor active
    ├─→ GitActivityMonitor polling
    └─→ TerminalErrorMonitor listening
    ↓
Activity Detected
    ├─→ Update Session Data
    ├─→ Throttled UI Update
    └─→ Continue Tracking
    ↓
VS Code Shutdown
    ├─→ Stop Tracking
    ├─→ Calculate Productivity Score
    ├─→ Save Session
    └─→ Dispose Resources
```

---

## 🧪 Testing Strategy

### Test Types

1. **Unit Tests**: Individual service methods
2. **Integration Tests**: Service interactions
3. **E2E Tests**: Full workflow scenarios

### Mock Strategy

- VS Code API: Mocked using `@vscode/test-electron`
- File System: Mocked file operations
- Git Commands: Mocked exec results
- Terminal: Mocked terminal events

---

## 📦 Build & Compilation

### TypeScript Compilation

```
TypeScript Source (src/)
    ↓
tsc compiler
    ↓
JavaScript Output (out/)
    ↓
VSIX Package
    ↓
VS Code Marketplace
```

### Dependencies

- **Runtime**: `uuid` (for session IDs)
- **Dev**: TypeScript, Jest, ESLint, VS Code types

---

## 🎯 Key Technical Decisions

### 1. **Why File-Based Storage?**
- Simple, no external dependencies
- Works offline
- Easy to debug and migrate
- VS Code provides storage path

### 2. **Why Debouncing/Throttling?**
- File saves trigger multiple events
- Prevents UI flickering
- Reduces CPU usage
- Better user experience

### 3. **Why Polling for Git?**
- VS Code doesn't provide Git change events
- Polling every 30s is acceptable
- Caching reduces overhead
- Async operations don't block

### 4. **Why Embedded HTML?**
- No external dependencies
- Faster loading
- Works offline
- Full control over UI

### 5. **Why Service-Oriented Architecture?**
- Separation of concerns
- Easy to test
- Easy to extend
- Maintainable codebase

---

## 🚀 Scalability Considerations

### Current Limitations

1. **Memory**: Limited to 1000 tracked files per session
2. **Storage**: No automatic cleanup (manual via config)
3. **Git**: Polls every 30s (not real-time)
4. **Terminal**: Limited by VS Code API access

### Future Optimizations

1. **IndexedDB**: For browser-based storage
2. **Web Workers**: For heavy processing
3. **Incremental Updates**: Only update changed UI parts
4. **Background Processing**: Move heavy operations off main thread

---

## 📚 Code Organization

```
src/
├── extension.ts              # Entry point, initialization
├── models/                   # Data structures
│   ├── SessionData.ts
│   ├── FileEdit.ts
│   └── ...
├── services/                 # Business logic
│   ├── SessionTracker.ts    # Main coordinator
│   ├── FileChangeMonitor.ts # File watching
│   ├── GitActivityMonitor.ts # Git operations
│   └── ...
├── providers/                # UI providers
│   ├── SidebarPanelProvider.ts
│   └── TeamDashboardProvider.ts
├── interfaces/              # TypeScript interfaces
└── utils/                   # Helper functions
```

---

## 🎓 Learning Points

### Best Practices Demonstrated

1. ✅ **Separation of Concerns**: Clear service boundaries
2. ✅ **Error Handling**: Comprehensive error management
3. ✅ **Performance**: Multiple optimization strategies
4. ✅ **Type Safety**: Strong TypeScript typing
5. ✅ **Memory Management**: Proactive cleanup
6. ✅ **User Experience**: Throttling, debouncing
7. ✅ **Extensibility**: Interface-based design
8. ✅ **Testing**: Testable architecture

---

**This architecture provides a robust, performant, and maintainable foundation for the Session Recap extension!** 🚀
