# Launch & Publish Guide - Session Recap Extension

This guide explains how to launch the extension with its frontend UI and package it for distribution.

## 🎨 Frontend Architecture

The extension uses **VS Code Webviews** to display its UI. The frontend is embedded directly in the TypeScript code:

- **Location**: `src/providers/SidebarPanelProvider.ts` (lines 75-516)
- **Technology**: HTML, CSS, and JavaScript embedded as template strings
- **UI Components**: 
  - Session summary display
  - File list with clickable items
  - Git commits viewer
  - Terminal errors display
  - Loading and welcome states

The webview is automatically created by VS Code when the extension activates. The HTML is injected dynamically and communicates with the extension backend via `postMessage`.

---

## 🚀 Launching the Extension for Development

### Method 1: Using VS Code Debugger (Recommended)

1. **Open the project in VS Code**
   ```bash
   code .
   ```

2. **Install dependencies** (if not already done)
   ```bash
   npm install
   ```

3. **Compile TypeScript**
   ```bash
   npm run compile
   ```

4. **Press F5** or go to `Run > Start Debugging`
   - This opens a new "Extension Development Host" window
   - The extension will be automatically loaded and active
   - The "Session Recap" panel will appear in the Explorer sidebar

5. **View the Frontend UI**
   - Look for "Session Recap" in the Explorer sidebar (left panel)
   - Click on it to see the webview UI
   - The UI will show session data or a welcome message

### Method 2: Using Watch Mode (For Active Development)

1. **Start TypeScript compiler in watch mode**
   ```bash
   npm run watch
   ```
   This automatically recompiles when you make changes.

2. **In another terminal, press F5 in VS Code**
   - The Extension Development Host will launch
   - Changes will be reflected after recompilation

3. **Reload the Extension Development Host**
   - Press `Ctrl+R` (or `Cmd+R` on Mac) in the Extension Development Host window
   - Or use Command Palette: `Developer: Reload Window`

### Method 3: Using Test Script (Linux/Mac)

```bash
# Make script executable (first time only)
chmod +x test.sh

# Launch Extension Development Host
./test.sh manual
```

### Method 4: Command Line Launch

```bash
# Compile first
npm run compile

# Launch VS Code with extension
code --extensionDevelopmentPath=.
```

---

## 🎯 Testing the Frontend

### Viewing the UI

1. **Open the Session Recap Panel**
   - In the Extension Development Host window
   - Look for "Session Recap" in the Explorer sidebar
   - Click to expand and view the webview

2. **Test UI Interactions**
   - Click on file names to open them
   - Click on terminal errors to see details
   - Use the refresh button in the panel header

3. **Developer Tools for Webview**
   - Right-click in the webview panel
   - Select "Inspect" or "Open Developer Tools"
   - This opens Chrome DevTools for debugging the webview

### Testing with Real Data

1. **Create some activity**
   - Edit some files in the workspace
   - Make some Git commits
   - Run commands that produce terminal errors

2. **Restart the Extension Development Host**
   - Close and reopen VS Code
   - Or reload the window (`Ctrl+R`)
   - The previous session data should appear in the UI

---

## 📦 Packaging the Extension (VSIX File)

### Prerequisites

Install the VS Code Extension Manager (`vsce`):

```bash
npm install -g @vscode/vsce
```

### Step 1: Prepare for Packaging

1. **Ensure all dependencies are installed**
   ```bash
   npm install
   ```

2. **Compile TypeScript**
   ```bash
   npm run compile
   ```

3. **Run tests** (optional but recommended)
   ```bash
   npm run test:all
   ```

4. **Update version in package.json** (if needed)
   ```json
   {
     "version": "0.0.2"  // Increment version number
   }
   ```

### Step 2: Create VSIX Package

```bash
vsce package
```

This will:
- Run `npm run compile` automatically (via `vscode:prepublish` script)
- Create a `.vsix` file in the project root
- File will be named: `session-recap-extension-0.0.1.vsix`

### Step 3: Verify the Package

1. **Check the VSIX file was created**
   ```bash
   ls -lh *.vsix
   # or on Windows
   dir *.vsix
   ```

2. **Test install the VSIX locally**
   - Open VS Code
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Run: `Extensions: Install from VSIX...`
   - Select your `.vsix` file
   - The extension should install and activate

3. **Verify it works**
   - Check that "Session Recap" appears in the sidebar
   - Test the UI and functionality

---

## 🌐 Publishing to VS Code Marketplace

### Prerequisites

1. **Create a Publisher Account**
   - Go to [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
   - Sign in with your Microsoft account
   - Create a new publisher
   - Note your publisher ID (e.g., `your-publisher-name`)

2. **Get a Personal Access Token**
   - Go to [Azure DevOps](https://dev.azure.com)
   - User Settings > Personal Access Tokens
   - Create a new token with "Marketplace (Manage)" scope
   - Save the token securely

### Step 1: Update package.json

Add publisher information:

```json
{
  "name": "session-recap-extension",
  "displayName": "Session Recap",
  "publisher": "your-publisher-name",
  "version": "0.0.1",
  ...
}
```

### Step 2: Login to vsce

```bash
vsce login your-publisher-name
```

When prompted, enter your Personal Access Token.

### Step 3: Publish

```bash
vsce publish
```

This will:
- Package the extension
- Upload it to the marketplace
- Make it available for download

### Alternative: Publish Minor/Patch Version

```bash
vsce publish minor  # 0.0.1 -> 0.1.0
vsce publish patch  # 0.0.1 -> 0.0.2
```

---

## 📤 Publishing to Open VSX Registry (Alternative)

Open VSX is an open-source alternative to the VS Code Marketplace.

### Step 1: Install ovsx

```bash
npm install -g ovsx
```

### Step 2: Create Account

- Go to [Open VSX Registry](https://open-vsx.org/)
- Sign up for an account
- Create a namespace (publisher name)

### Step 3: Get Access Token

- Go to your account settings
- Generate an access token

### Step 4: Publish

```bash
ovsx publish session-recap-extension-0.0.1.vsix -p <your-access-token>
```

---

## 🔧 Troubleshooting

### Frontend Not Showing

**Problem**: Webview panel is empty or not visible

**Solutions**:
1. Check Developer Console: `Help > Toggle Developer Tools`
2. Verify extension activated: Check Output panel > "Session Recap"
3. Reload window: `Ctrl+R` or `Cmd+R`
4. Check for errors in `src/providers/SidebarPanelProvider.ts`

### VSIX Packaging Fails

**Problem**: `vsce package` fails with errors

**Solutions**:
1. **Missing dependencies**: Run `npm install`
2. **TypeScript errors**: Run `npm run compile` and fix errors
3. **Invalid package.json**: Check for syntax errors
4. **Missing files**: Ensure `out/` directory exists with compiled files

### Publishing Fails

**Problem**: `vsce publish` fails

**Solutions**:
1. **Authentication**: Re-login with `vsce login`
2. **Version conflict**: Version already exists - increment version in package.json
3. **Missing publisher**: Add `"publisher"` field to package.json
4. **Token expired**: Generate a new Personal Access Token

### Frontend Not Updating

**Problem**: Changes to webview HTML not appearing

**Solutions**:
1. **Reload window**: `Ctrl+R` in Extension Development Host
2. **Restart extension**: Close and reopen Extension Development Host
3. **Clear cache**: Close all VS Code windows and restart
4. **Check compilation**: Ensure TypeScript compiled successfully

---

## 📝 Pre-Publishing Checklist

Before packaging and publishing:

- [ ] All tests pass (`npm run test:all`)
- [ ] TypeScript compiles without errors (`npm run compile`)
- [ ] Linter passes (`npm run lint`)
- [ ] Version number updated in `package.json`
- [ ] README.md is complete and accurate
- [ ] Extension tested in Extension Development Host
- [ ] Frontend UI tested and working
- [ ] All features documented
- [ ] License file included
- [ ] Publisher name set in `package.json`
- [ ] Extension tested after installing from VSIX

---

## 🎯 Quick Reference Commands

```bash
# Development
npm install              # Install dependencies
npm run compile          # Compile TypeScript
npm run watch            # Watch mode for development
npm run test:all         # Run all tests
npm run lint             # Lint code

# Launch Extension
F5 in VS Code            # Launch Extension Development Host

# Packaging
npm install -g @vscode/vsce   # Install vsce (first time)
vsce package             # Create VSIX file

# Publishing
vsce login <publisher>   # Login to marketplace
vsce publish             # Publish to marketplace
vsce publish minor       # Publish minor version
vsce publish patch       # Publish patch version
```

---

## 📚 Additional Resources

- [VS Code Extension API Documentation](https://code.visualstudio.com/api)
- [Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [Publishing Extensions Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extensions)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [VS Code Marketplace](https://marketplace.visualstudio.com/)
- [Open VSX Registry](https://open-vsx.org/)

---

**Happy Publishing! 🚀**

