# Git Hooks & Code Quality

This project uses **Husky** and **lint-staged** to **ENFORCE MANDATORY** code quality and consistency. 

**🔒 IMPORTANT: Quality checks CANNOT be bypassed. All code MUST pass validation before entering the repository.**

## 🛡️ **Automated Quality Checks**

### **🔒 MANDATORY Pre-commit Hook**
**ALWAYS runs before every commit - CANNOT be skipped:**
- ✅ **ESLint** - Zero warnings allowed, fixes issues automatically
- ✅ **Prettier** - Enforces consistent formatting
- ✅ **Tests** - Related tests MUST pass for changed files
- ✅ **Hard failure** - Commit is BLOCKED if any check fails

### **🔒 MANDATORY Pre-push Hook**
**ALWAYS runs before every push - CANNOT be skipped:**
- ✅ **Full test suite** - ALL tests MUST pass with coverage
- ✅ **Build verification** - Code MUST compile successfully
- ✅ **Hard failure** - Push is BLOCKED if any check fails

## 🚀 **Quick Start**

### **Installation**
When you clone the repository, install dependencies:
```bash
npm install
```

Husky will automatically be set up via the `prepare` script.

### **Normal Development Workflow**
```bash
# Make your changes
git add .

# This will trigger pre-commit hooks automatically
git commit -m "Your commit message"

# This will trigger pre-push hooks automatically  
git push
```

## 🔧 **Manual Commands**

### **Run Quality Checks Manually**
```bash
# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Run tests with coverage
npm run test:ci

# Run pre-commit checks manually
npm run pre-commit

# Run pre-push checks manually
npm run pre-push
```

### **Prettier Formatting**
```bash
# Format all files
npx prettier --write .

# Check formatting without fixing
npx prettier --check .
```

## ⚠️ **What Happens if Checks Fail?**

### **🚫 Pre-commit Failures - COMMIT BLOCKED**
When pre-commit hook fails (commit will be REJECTED):
1. **Linting errors**: Zero warnings policy - fix ALL issues
2. **Test failures**: ALL related tests MUST pass  
3. **Formatting issues**: Code MUST be properly formatted

```bash
# Fix ALL issues before commit will be allowed
npm run lint:fix    # Fix linting issues
npm test           # Ensure tests pass
git add .          # Stage the fixes
git commit -m "Your message"  # Try commit again
```

### **🚫 Pre-push Failures - PUSH BLOCKED**
When pre-push hook fails (push will be REJECTED):
1. **Test failures**: ALL tests MUST pass
2. **Build errors**: Code MUST compile successfully
3. **Coverage requirements**: Test coverage MUST meet standards

```bash
# Fix ALL issues before push will be allowed
npm test           # Fix failing tests
npm run build      # Ensure build succeeds
git push           # Try push again
```

## 🔒 **NO BYPASS POLICY**

**This project enforces a ZERO-BYPASS policy:**
- ✅ Quality checks are **MANDATORY** and **CANNOT be skipped**
- ✅ All code **MUST** pass validation before entering the repository
- ✅ No `--no-verify` flags or bypass mechanisms are allowed
- ✅ This ensures **consistent quality** and **prevents broken code**

## 📋 **Configured Quality Standards**

### **ESLint Rules**
- Extends `react-app` and `react-app/jest` configurations
- Enforces React best practices
- Catches common JavaScript/React errors
- Auto-fixes formatting and simple issues

### **Prettier Configuration**
- **Single quotes** for JavaScript strings
- **Semicolons** required
- **2 spaces** for indentation
- **80 character** line width
- **Trailing commas** in ES5 contexts

### **Test Requirements**
- All tests must pass before pushing
- New code should include appropriate tests
- Coverage reports are generated on push

## 🔄 **Workflow Integration**

### **IDE Integration**
Configure your editor to:
- Run ESLint on save
- Format with Prettier on save
- Show test results inline

### **VS Code Settings**
Add to `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.format.enable": true
}
```

## 🛠️ **Maintenance**

### **Updating Husky**
```bash
npm update husky
npx husky install  # If needed
```

### **Updating Lint-staged Configuration**
Edit the `lint-staged` section in `package.json`:
```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "npm test -- --bail --findRelatedTests --passWithNoTests"
    ]
  }
}
```

## 🎯 **Benefits**

- ✅ **Consistent code style** across the team
- ✅ **Catch errors early** before they reach production
- ✅ **Automated quality assurance** without manual steps
- ✅ **Faster code reviews** with pre-validated code
- ✅ **Reduced bugs** through automated testing
- ✅ **Better collaboration** with standardized formatting

## 🆘 **Troubleshooting**

### **Hook Not Running**
```bash
# Reinstall Husky
rm -rf .husky
npx husky install
chmod +x .husky/pre-commit .husky/pre-push
```

### **Permission Issues**
```bash
chmod +x .husky/pre-commit .husky/pre-push
```

### **Node Version Issues**
Ensure you're using the correct Node.js version:
```bash
node --version
npm --version
```

---

**Remember**: These hooks are here to help maintain code quality and catch issues early. Work with them, not against them! 🎉 