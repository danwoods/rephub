# 🔒 CODE QUALITY POLICY

## **ZERO-BYPASS MANDATE**

This repository enforces **MANDATORY CODE QUALITY CHECKS** that **CANNOT BE BYPASSED**.

### **📋 POLICY STATEMENT**

**ALL CODE must pass these validations before entering the repository:**

1. **🔍 ESLint** - Zero warnings tolerance
2. **💅 Prettier** - Consistent formatting enforced  
3. **🧪 Tests** - All related tests must pass
4. **🏗️ Build** - Code must compile successfully
5. **📊 Coverage** - Test coverage requirements must be met

### **🚫 PROHIBITED ACTIONS**

The following actions are **STRICTLY FORBIDDEN**:

```bash
# ❌ NEVER DO THIS - Bypassing pre-commit hooks
git commit --no-verify
git commit -n

# ❌ NEVER DO THIS - Bypassing pre-push hooks  
git push --no-verify
git push -n

# ❌ NEVER DO THIS - Force pushing without validation
git push --force
git push -f
```

### **✅ REQUIRED WORKFLOW**

**This is the ONLY acceptable workflow:**

```bash
# 1. Make changes
# 2. Stage changes
git add .

# 3. Commit (hooks run automatically - CANNOT be skipped)
git commit -m "Your message"

# 4. Push (hooks run automatically - CANNOT be skipped)  
git push
```

### **⚖️ ENFORCEMENT**

- **Git hooks** automatically block commits/pushes that fail validation
- **Zero warnings policy** - even minor issues block commits
- **All tests must pass** - no exceptions for "quick fixes"
- **Build must succeed** - broken code cannot be pushed

### **🎯 RATIONALE**

This policy ensures:
- **Consistent code quality** across the entire team
- **No broken code** in the main repository  
- **Reduced debugging time** from quality issues
- **Faster code reviews** with pre-validated code
- **Professional standards** in all deliverables

### **🆘 WHAT IF I NEED TO COMMIT URGENTLY?**

**There is NO emergency bypass.** Instead:

1. **Fix the quality issues** (usually takes < 2 minutes)
2. **Run the checks manually** to verify: `npm run lint:fix && npm test`
3. **Commit normally** once all checks pass

**Quality is never negotiable.**

---

**This policy is non-negotiable and applies to ALL team members, ALL branches, and ALL commits.** 