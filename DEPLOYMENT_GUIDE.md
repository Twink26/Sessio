# Complete Deployment Guide - Publishing Your Extension

This guide walks you through deploying your Session Recap extension to the VS Code Marketplace for public use.

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ Node.js installed (16.x or higher)
- ✅ VS Code extension compiled successfully (`npm run compile`)
- ✅ All tests passing (`npm run test:all`)
- ✅ A Microsoft account (for VS Code Marketplace)
- ✅ A GitHub account (recommended for hosting)

---

## 🚀 Step-by-Step Deployment Process

### Step 1: Prepare Your Extension

#### 1.1 Update package.json

First, you need to add a **publisher** field to your `package.json`. This is required for publishing.

```json
{
  "name": "session-recap-extension",
  "displayName": "Session Recap",
  "publisher": "your-publisher-name",  // ← Add this (must be unique)
  "version": "0.0.1",
  "description": "Provides an AI-generated summary of your previous coding session...",
  ...
}
```

**Important Notes:**
- Publisher name must be **unique** across the marketplace
- Use lowercase letters, numbers, and hyphens only
- Cannot be changed after first publication
- Examples: `john-doe`, `mycompany`, `devtools`

#### 1.2 Verify Required Fields

Ensure these fields are present and correct in `package.json`:

- ✅ `name` - Extension identifier (lowercase, no spaces)
- ✅ `displayName` - Human-readable name
- ✅ `publisher` - Your publisher ID
- ✅ `version` - Semantic version (e.g., "0.0.1")
- ✅ `description` - Clear description (max 200 chars)
- ✅ `engines.vscode` - Minimum VS Code version
- ✅ `categories` - At least one category
- ✅ `repository` - (Optional but recommended) GitHub repo URL
- ✅ `license` - License type (e.g., "MIT")
- ✅ `icon` - (Optional) 128x128 PNG icon

#### 1.3 Add Repository Information (Recommended)

Add repository info to help users find your source code:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/session-recap-extension.git"
  },
  "bugs": {
    "url": "https://github.com/your-username/session-recap-extension/issues"
  },
  "homepage": "https://github.com/your-username/session-recap-extension#readme"
}
```

#### 1.4 Create an Icon (Optional but Recommended)

Create a 128x128 PNG icon and save it as `icon.png` in the project root, then add to `package.json`:

```json
{
  "icon": "icon.png"
}
```

---

### Step 2: Create a Publisher Account

#### 2.1 Go to Visual Studio Marketplace

1. Visit: https://marketplace.visualstudio.com/manage
2. Sign in with your **Microsoft account** (or create one)
3. If prompted, accept the terms of service

#### 2.2 Create Publisher Profile

1. Click **"Create Publisher"** or **"New Publisher"**
2. Fill in the form:
   - **Publisher ID**: Choose a unique ID (e.g., `your-username` or `your-company`)
     - This will be your `publisher` field in `package.json`
     - Must be unique across all publishers
     - Cannot be changed later
   - **Publisher Name**: Display name (can be changed later)
   - **Support Email**: Your contact email
3. Click **"Create"**

**Important:** Save your Publisher ID - you'll need it for `package.json`!

---

### Step 3: Get Personal Access Token

#### 3.1 Create Azure DevOps Account

1. Go to: https://dev.azure.com
2. Sign in with the same Microsoft account
3. Create a new organization (if you don't have one)

#### 3.2 Generate Personal Access Token

1. Click your profile icon (top right)
2. Select **"Personal Access Tokens"**
3. Click **"New Token"**
4. Configure the token:
   - **Name**: "VS Code Extension Publishing"
   - **Organization**: Select your organization
   - **Expiration**: Choose duration (90 days recommended)
   - **Scopes**: Select **"Marketplace (Manage)"**
5. Click **"Create"**
6. **IMPORTANT**: Copy the token immediately - you won't see it again!

---

### Step 4: Install vsce (VS Code Extension Manager)

Install the VS Code Extension Manager globally:

```bash
npm install -g @vscode/vsce
```

Verify installation:

```bash
vsce --version
```

---

### Step 5: Prepare for Publishing

#### 5.1 Final Checks

```bash
# Ensure dependencies are installed
npm install

# Compile TypeScript
npm run compile

# Run tests (optional but recommended)
npm run test:all

# Check for linting errors
npm run lint
```

#### 5.2 Update Version Number

If this is not your first publish, update the version in `package.json`:

```json
{
  "version": "0.0.2"  // Increment from previous version
}
```

**Version Format:** Use semantic versioning (MAJOR.MINOR.PATCH)
- **Patch** (0.0.1 → 0.0.2): Bug fixes
- **Minor** (0.0.1 → 0.1.0): New features, backward compatible
- **Major** (0.0.1 → 1.0.0): Breaking changes

---

### Step 6: Login to vsce

Login with your publisher ID:

```bash
vsce login your-publisher-name
```

When prompted, paste your **Personal Access Token** from Step 3.

**Note:** The token is stored securely. You only need to login once per machine.

---

### Step 7: Package Your Extension

Create a VSIX file (this is what gets published):

```bash
vsce package
```

This will:
- Run `npm run compile` automatically
- Create a `.vsix` file (e.g., `session-recap-extension-0.0.1.vsix`)
- Validate your extension

**Verify the VSIX file was created:**

```bash
# Windows PowerShell
dir *.vsix

# Linux/Mac
ls -lh *.vsix
```

---

### Step 8: Test the VSIX Locally (Recommended)

Before publishing, test the VSIX file:

1. Open VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Run: `Extensions: Install from VSIX...`
4. Select your `.vsix` file
5. Verify the extension works correctly

---

### Step 9: Publish to Marketplace

#### 9.1 First-Time Publishing

```bash
vsce publish
```

This will:
- Package your extension
- Upload to VS Code Marketplace
- Make it publicly available

**First publish may take a few minutes to appear in the marketplace.**

#### 9.2 Publishing Updates

For subsequent versions, you can use:

```bash
# Patch version (0.0.1 → 0.0.2)
vsce publish patch

# Minor version (0.0.1 → 0.1.0)
vsce publish minor

# Major version (0.0.1 → 1.0.0)
vsce publish major

# Or specify version manually
vsce publish 0.0.2
```

---

### Step 10: Verify Publication

1. Visit: https://marketplace.visualstudio.com/vscode
2. Search for your extension name
3. Click on your extension to view the marketplace page
4. Verify all information is correct

**Your extension URL will be:**
```
https://marketplace.visualstudio.com/items?itemName=your-publisher-name.session-recap-extension
```

---

## 📤 Alternative: Publishing to Open VSX Registry

Open VSX is an open-source alternative marketplace (used by VSCodium and other editors).

### Step 1: Install ovsx

```bash
npm install -g ovsx
```

### Step 2: Create Account

1. Go to: https://open-vsx.org/
2. Sign in with GitHub
3. Create a namespace (your publisher name)

### Step 3: Get Access Token

1. Go to your account settings
2. Generate an access token
3. Copy the token

### Step 4: Publish

```bash
# First, package your extension
vsce package

# Then publish to Open VSX
ovsx publish session-recap-extension-0.0.1.vsix -p <your-access-token>
```

---

## 🔄 Updating Your Extension

### Process for Updates

1. **Make your changes** to the code
2. **Update version** in `package.json`
3. **Test thoroughly** (`npm run compile`, `npm run test:all`)
4. **Package** (`vsce package`)
5. **Test VSIX** locally
6. **Publish** (`vsce publish patch/minor/major`)

### Version Bumping

You can automate version bumping:

```bash
# Patch version
vsce publish patch

# Minor version  
vsce publish minor

# Major version
vsce publish major
```

These commands automatically update `package.json` and publish.

---

## 📝 Post-Publishing Checklist

After publishing, ensure:

- [ ] Extension appears in marketplace search
- [ ] Extension page displays correctly
- [ ] README.md is visible and formatted
- [ ] Screenshots/GIFs display (if added)
- [ ] Installation works for new users
- [ ] All features work as expected
- [ ] License is displayed correctly

---

## 🎨 Enhancing Your Marketplace Listing

### Add Screenshots

1. Create screenshots of your extension in action
2. Save as PNG files (recommended: 1280x720 or 1920x1080)
3. Add to `package.json`:

```json
{
  "galleryBanner": {
    "color": "#1e1e1e",
    "theme": "dark"
  },
  "screenshots": [
    {
      "path": "screenshots/screenshot1.png",
      "label": "Session Recap Panel"
    }
  ]
}
```

### Add README Content

Your `README.md` will automatically appear on the marketplace page. Make it:
- Clear and concise
- Include screenshots/GIFs
- Explain features
- Include usage examples
- List requirements

### Add Badges

Add badges to your README.md:

```markdown
[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://marketplace.visualstudio.com/items?itemName=your-publisher.session-recap-extension)
[![Installs](https://img.shields.io/vscode-marketplace/i/your-publisher.session-recap-extension.svg)](https://marketplace.visualstudio.com/items?itemName=your-publisher.session-recap-extension)
[![Rating](https://img.shields.io/vscode-marketplace/r/your-publisher.session-recap-extension.svg)](https://marketplace.visualstudio.com/items?itemName=your-publisher.session-recap-extension)
```

---

## 🔧 Troubleshooting

### "Publisher not found" Error

**Problem:** `vsce login` fails with "Publisher not found"

**Solution:**
1. Verify publisher ID matches exactly (case-sensitive)
2. Ensure publisher account was created successfully
3. Try logging out and back in: `vsce logout` then `vsce login`

### "Version already exists" Error

**Problem:** Publishing fails because version already exists

**Solution:**
1. Update version number in `package.json`
2. Use `vsce publish patch/minor/major` to auto-increment

### "Invalid Personal Access Token" Error

**Problem:** Token expired or invalid

**Solution:**
1. Generate a new token in Azure DevOps
2. Login again: `vsce login your-publisher-name`
3. Enter the new token

### Extension Not Appearing in Marketplace

**Problem:** Published but can't find it

**Solution:**
1. Wait 5-10 minutes (propagation delay)
2. Search by full name: `publisher.extension-name`
3. Check publisher dashboard for status
4. Verify no errors during publish

### VSIX Packaging Fails

**Problem:** `vsce package` fails

**Solution:**
1. Ensure `out/` directory exists with compiled files
2. Run `npm run compile` manually
3. Check for TypeScript errors
4. Verify all dependencies are in `package.json` (not just `devDependencies`)

---

## 📊 Monitoring Your Extension

### Marketplace Dashboard

Visit: https://marketplace.visualstudio.com/manage

Here you can:
- View download statistics
- See ratings and reviews
- Manage extension versions
- Update extension details
- View analytics

### Analytics

Track:
- Daily/weekly/monthly installs
- User ratings
- Review comments
- Version adoption rates

---

## 🚨 Important Notes

### Security

- **Never commit** your Personal Access Token
- Store tokens securely (use password manager)
- Rotate tokens periodically
- Use tokens with minimal required scopes

### Best Practices

1. **Test thoroughly** before publishing
2. **Version appropriately** (semantic versioning)
3. **Update README** with each release
4. **Respond to reviews** and issues
5. **Keep dependencies updated**
6. **Follow VS Code extension guidelines**

### Publishing Guidelines

- Extensions must comply with VS Code Marketplace policies
- No malicious code or data collection without disclosure
- Respect user privacy
- Provide clear documentation
- Respond to user feedback

---

## 📚 Additional Resources

- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extensions)
- [VS Code Marketplace](https://marketplace.visualstudio.com/)
- [vsce Documentation](https://github.com/microsoft/vscode-vsce)
- [Open VSX Registry](https://open-vsx.org/)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

---

## 🎯 Quick Reference Commands

```bash
# Install vsce
npm install -g @vscode/vsce

# Login
vsce login your-publisher-name

# Package
vsce package

# Publish (first time)
vsce publish

# Publish update (patch)
vsce publish patch

# Publish update (minor)
vsce publish minor

# Publish update (major)
vsce publish major

# Logout
vsce logout

# Check extension info
vsce ls

# Show extension info
vsce show your-publisher-name.session-recap-extension
```

---

## ✅ Pre-Publishing Checklist

Before publishing, ensure:

- [ ] `publisher` field added to `package.json`
- [ ] Version number is correct
- [ ] All code compiles without errors
- [ ] Tests pass
- [ ] README.md is complete and accurate
- [ ] Extension tested locally with VSIX
- [ ] Publisher account created
- [ ] Personal Access Token generated
- [ ] Logged in with `vsce login`
- [ ] Icon added (optional but recommended)
- [ ] Repository URL added (recommended)
- [ ] License specified

---

**Ready to publish? Follow the steps above and your extension will be available to millions of VS Code users! 🚀**

For questions or issues, check the [VS Code Extension API documentation](https://code.visualstudio.com/api) or the [Marketplace support](https://marketplace.visualstudio.com/support).
