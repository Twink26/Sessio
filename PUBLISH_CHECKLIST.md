# Pre-Publishing Checklist

Use this checklist before publishing your extension to ensure everything is ready.

## 📋 Before Publishing

### 1. package.json Configuration

- [ ] **Publisher ID Added**
  ```json
  "publisher": "your-publisher-name"
  ```
  - Must be unique across marketplace
  - Lowercase, numbers, hyphens only
  - Cannot be changed after first publish

- [ ] **Version Number**
  ```json
  "version": "0.0.1"
  ```
  - Use semantic versioning (MAJOR.MINOR.PATCH)
  - First publish: 0.0.1 or 0.1.0

- [ ] **Required Fields Present**
  - [ ] `name` - Extension identifier
  - [ ] `displayName` - Human-readable name
  - [ ] `description` - Clear description (max 200 chars)
  - [ ] `engines.vscode` - Minimum VS Code version
  - [ ] `categories` - At least one category
  - [ ] `license` - License type (e.g., "MIT")

- [ ] **Optional but Recommended**
  - [ ] `repository` - GitHub repo URL
  - [ ] `icon` - 128x128 PNG icon
  - [ ] `homepage` - Project homepage
  - [ ] `bugs` - Issues URL

### 2. Code Quality

- [ ] **Compilation**
  ```bash
  npm run compile
  ```
  - No TypeScript errors
  - All files compile successfully

- [ ] **Tests**
  ```bash
  npm run test:all
  ```
  - All tests pass
  - No failing tests

- [ ] **Linting**
  ```bash
  npm run lint
  ```
  - No linting errors
  - Code follows style guidelines

- [ ] **Functionality**
  - Extension activates correctly
  - All features work as expected
  - No console errors
  - UI displays correctly

### 3. Documentation

- [ ] **README.md**
  - Clear description
  - Installation instructions
  - Usage examples
  - Configuration options
  - Screenshots/GIFs (if applicable)

- [ ] **CHANGELOG.md** (Optional but recommended)
  - Version history
  - Feature additions
  - Bug fixes

- [ ] **LICENSE**
  - License file present
  - Matches `package.json` license field

### 4. Marketplace Account

- [ ] **Publisher Account Created**
  - Visit: https://marketplace.visualstudio.com/manage
  - Created publisher profile
  - Publisher ID matches `package.json`

- [ ] **Personal Access Token**
  - Created in Azure DevOps
  - Scope: "Marketplace (Manage)"
  - Token saved securely

### 5. Testing

- [ ] **Local Testing**
  - Extension works in Extension Development Host (F5)
  - All commands work
  - UI displays correctly
  - No errors in console

- [ ] **VSIX Testing**
  ```bash
  vsce package
  ```
  - VSIX file created successfully
  - Installed from VSIX locally
  - Works correctly after installation

### 6. Assets (Optional but Recommended)

- [ ] **Icon**
  - 128x128 PNG file
  - Saved as `icon.png` in root
  - Added to `package.json`

- [ ] **Screenshots**
  - High-quality screenshots
  - Show extension in action
  - Saved in `screenshots/` folder

- [ ] **Badges**
  - Added to README.md
  - Version badge
  - Install badge (after first publish)

### 7. Pre-Publish Commands

Run these commands in order:

```bash
# 1. Install dependencies
npm install

# 2. Compile TypeScript
npm run compile

# 3. Run tests
npm run test:all

# 4. Lint code
npm run lint

# 5. Install vsce (if not already installed)
npm install -g @vscode/vsce

# 6. Login to vsce
vsce login your-publisher-name

# 7. Package extension
vsce package

# 8. Test VSIX locally
# Install from VSIX in VS Code and test

# 9. Publish
vsce publish
```

### 8. Post-Publish Verification

After publishing:

- [ ] Extension appears in marketplace
- [ ] Can be found via search
- [ ] Installation works
- [ ] All features work for new users
- [ ] README displays correctly
- [ ] Screenshots display (if added)

---

## 🚨 Common Issues to Avoid

### Before Publishing

- ❌ Don't publish without a publisher ID
- ❌ Don't use version 0.0.0
- ❌ Don't skip testing
- ❌ Don't forget to compile
- ❌ Don't publish with errors

### After Publishing

- ✅ Monitor reviews and ratings
- ✅ Respond to user feedback
- ✅ Fix bugs promptly
- ✅ Update documentation
- ✅ Keep dependencies updated

---

## 📝 Quick Command Reference

```bash
# Check if vsce is installed
vsce --version

# Login
vsce login your-publisher-name

# Check login status
vsce ls

# Package
vsce package

# Publish
vsce publish

# Publish with version bump
vsce publish patch   # 0.0.1 → 0.0.2
vsce publish minor   # 0.0.1 → 0.1.0
vsce publish major   # 0.0.1 → 1.0.0

# Show extension info
vsce show your-publisher-name.session-recap-extension

# Logout
vsce logout
```

---

## ✅ Final Check

Before clicking publish, ask yourself:

1. ✅ Does the extension work correctly?
2. ✅ Is the code quality good?
3. ✅ Is documentation complete?
4. ✅ Have I tested everything?
5. ✅ Am I ready to support users?

**If all answers are YES, you're ready to publish! 🚀**

---

**Need help?** Check `DEPLOYMENT_GUIDE.md` for detailed instructions.
