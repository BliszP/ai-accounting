# QUICK START GUIDE
## From Zero to Production in 15 Weeks

**Version:** 1.0  
**Purpose:** One-page reference to start building immediately

---

## 📋 YOUR COMPLETE TOOLKIT

**Documentation (450+ pages):**
- 01_BUSINESS_CASE.md - Why you're building this
- 02_PRD.md - What to build (63 user stories)
- 03_TECHNICAL_ARCHITECTURE.md - How to build (database, API, workers)
- 04_ACCOUNTING_CALCULATIONS.md - Financial logic
- 05_UI_UX_SPECIFICATION.md - All 30+ screens
- 06_TESTING_STRATEGY.md - How to test
- 07_PERFORMANCE_MONITORING.md - How to monitor
- 08_IMPLEMENTATION_PLAYBOOK.md - Daily step-by-step guide

---

## 🚀 START HERE (Day 1 - Hour 1)

### **Step 1: Install Software** (30 min)
```
1. Cursor: https://cursor.sh (AI code editor)
2. Node.js: https://nodejs.org (v20 LTS)
3. Git: https://git-scm.com
```

### **Step 2: Create Accounts** (30 min)
```
1. GitHub: https://github.com
2. Railway: https://railway.app (backend hosting)
3. Supabase: https://supabase.com (database)
4. Vercel: https://vercel.com (frontend hosting)
5. Anthropic: https://console.anthropic.com (Claude API)
```

### **Step 3: Create Project** (30 min)
```bash
# Terminal commands
mkdir ai-accounting && cd ai-accounting
npx create-react-app frontend --template typescript
mkdir backend && cd backend && npm init -y
git init
git remote add origin https://github.com/YOUR-USERNAME/ai-accounting.git
```

### **Step 4: Copy Documentation** (5 min)
```
Copy all .md files to: ai-accounting/docs/
```

---

## 🎯 THE CURSOR AI METHOD (Use 100+ Times)

**Every feature follows this pattern:**

```
1. FIND SPEC
   → Open docs/05_UI_UX_SPECIFICATION.md
   → Search for screen name (Ctrl+F)

2. OPEN CURSOR
   → Create or open file
   → Press Cmd+K (Mac) or Ctrl+K (Windows)

3. PROMPT CURSOR
   → Type: "Create [component] based on this spec:"
   → Paste ENTIRE specification from docs
   → Press Enter

4. REVIEW
   → Read generated code
   → If wrong: Cmd+K → "Fix this: [explain]"
   → If good: Save (Cmd+S)

5. TEST
   → npm start
   → Test in browser
   → Fix bugs

6. COMMIT
   → git add .
   → git commit -m "Add [feature]"
   → git push
```

---

## 📅 15-WEEK ROADMAP

**Week 1:** Setup + Auth  
**Week 2:** Document Upload  
**Week 3:** Claude API Integration  
**Week 4:** Client Management  
**Week 5:** Review Queue  
**Week 6:** Categorization  
**Week 7:** Matching  
**Week 8:** Accounting (CRITICAL - 100% accuracy required)  
**Week 9:** Reports  
**Week 10:** Export  
**Week 11:** Testing + Monitoring  
**Week 12:** Optimization  
**Week 13-14:** Beta Testing (500-1,000 real documents)  
**Week 15:** Production Launch 🚀

---

## 💻 DAILY ROUTINE

**Every Morning:**
```bash
cd ~/ai-accounting
git pull
cd frontend && npm start  # Terminal 1
cd backend && npm run dev  # Terminal 2
```

**Every Feature:**
```
1. Open docs → Find spec
2. Cursor → Generate code
3. Test locally
4. Write test
5. Commit
```

**Every Evening:**
```bash
git add .
git commit -m "Descriptive message"
git push
```

---

## 🛠️ KEY COMMANDS

### **Cursor:**
- `Cmd+K` / `Ctrl+K` - AI chat
- `Tab` - Accept suggestion
- `Esc` - Reject

### **Terminal:**
```bash
npm start          # Start frontend
npm run dev        # Start backend
npm test           # Run tests
npm install [pkg]  # Install package
```

### **Git:**
```bash
git status
git add .
git commit -m "message"
git push
```

---

## 📖 WHICH DOC TO USE WHEN

**Building UI?** → 05_UI_UX_SPECIFICATION.md  
**Building API?** → 03_TECHNICAL_ARCHITECTURE.md  
**Accounting logic?** → 04_ACCOUNTING_CALCULATIONS.md  
**Writing tests?** → 06_TESTING_STRATEGY.md  
**Adding monitoring?** → 07_PERFORMANCE_MONITORING.md  
**Confused what to build?** → 02_PRD.md (find next user story)  
**Lost or need help?** → 08_IMPLEMENTATION_PLAYBOOK.md (day-by-day)

---

## ⚠️ CRITICAL RULES

**NEVER:**
- ❌ Skip accounting tests (MUST be 100%)
- ❌ Commit without testing
- ❌ Use Sonnet for all documents (use Haiku 80%)
- ❌ Ignore Sentry errors
- ❌ Deploy without testing

**ALWAYS:**
- ✅ Review Cursor-generated code
- ✅ Test locally before committing
- ✅ Run test suite before deploying
- ✅ Check costs daily (<£30/day Claude API)
- ✅ Commit at end of each day

---

## 🆘 TROUBLESHOOTING

**Cursor generates wrong code?**  
→ Cmd+K → "Fix this: [explain what's wrong]"

**Tests failing?**  
→ Read error → Ask Cursor to fix → Test again

**API not working?**  
→ Check Railway logs + Supabase logs + .env

**Too expensive?**  
→ Use Haiku more, batch API calls, check cost dashboard

**Confused?**  
→ Open 08_IMPLEMENTATION_PLAYBOOK.md → Today's section

---

## ✅ SUCCESS CHECKLIST

**Week 1:**
- [ ] All software installed
- [ ] All accounts created
- [ ] GitHub repo created
- [ ] Can log in to app

**Week 8:**
- [ ] Accounting tests 100% pass
- [ ] Trial balance always balances
- [ ] Assets = Liabilities + Equity

**Week 12:**
- [ ] All features built
- [ ] Tests pass
- [ ] Monitoring set up

**Week 14:**
- [ ] 95%+ extraction accuracy
- [ ] Beta users happy
- [ ] Bugs fixed

**Week 15:**
- [ ] Production deployed
- [ ] Design partner onboarded
- [ ] 450 clients using system 🎉

---

## 🎯 YOUR NEXT ACTION

**Right now (5 minutes):**
```
1. Open 08_IMPLEMENTATION_PLAYBOOK.md
2. Read "Day 1"
3. Follow the steps
4. Install Cursor
5. Create GitHub account
6. Start building!
```

**You have everything you need.**  
**No more planning.**  
**Just execute.**  
**Go!** 🚀

---

**Created:** February 1, 2026  
**Status:** Complete  
**Next:** Start Day 1 → Install software
