# AI ACCOUNTING AUTOMATION
## Business Case Document

**Version:** 1.0  
**Date:** February 1, 2026  
**Author:** Hi (WeldQAi Founder)  
**Product:** AI-Powered Document Processing for UK Accounting Firms

---

## EXECUTIVE SUMMARY

### Opportunity
UK accounting firms waste 30+ hours/week on manual data entry from bank statements and receipts. Current solutions (Dext, Hubdoc) cost £6,750-9,000/month and deliver only 80-85% accuracy. There's a massive gap for an AI-powered solution that delivers 99% accuracy at 85% lower cost.

### Solution
Multi-tenant SaaS platform using Claude AI to automatically extract, categorize, and reconcile financial documents with 99% accuracy. Target market: UK accounting firms with 100-500 clients.

### Design Partner
Tax company with 450 clients processing 11,000 documents/month (1,000 bank statements + 10,000 receipts). Currently spending £6,120/month in wasted labor on manual data entry.

### Financial Projections (3 Years)
- **Year 1:** 4 customers, £2,850 profit
- **Year 2:** 20 customers, £53,550 profit  
- **Year 3:** 30 customers, £126,000 profit

### Investment Required
- **Development:** 3 months personal time (AI-assisted coding)
- **Infrastructure:** £750-800/month (scales with usage)
- **Total Year 1 Cost:** ~£9,000

### Key Metrics
- **Pricing:** £800-1,200/month per customer
- **Gross Margin:** 30-38% (after optimization)
- **CAC:** £500-1,000 (estimated)
- **Payback Period:** 6-8 months
- **Churn Target:** <10%/year

---

## PROBLEM STATEMENT

### Current Pain Points

**1. Manual Data Entry (Biggest Pain)**
- UK accounting firms process thousands of documents monthly
- Average: 30+ hours/week per accountant spent on data entry
- Cost: £6,000-10,000/month in wasted labor per firm
- Error-prone: 10-15% error rate with manual entry

**2. Existing Solutions Are Inadequate**
- **Dext (Receipt Bank):** £6,750-9,000/month, 80-85% accuracy
- **Hubdoc:** £2,250-6,750/month, basic OCR only
- **AutoEntry:** £4,500-11,250/month, limited UK bank support
- **Problem:** All are expensive, low accuracy, no AI learning

**3. Poor Quality Documents**
- 10-25% of receipts have quality issues (faded, blurry, handwritten)
- Existing OCR fails on poor quality images
- Manual fallback required

**4. Complex UK Banking Landscape**
- 10+ major UK banks (Lloyds, HSBC, Barclays, NatWest, Monzo, Starling, etc.)
- Inconsistent statement formats
- "Pots" (Monzo/Starling virtual accounts) cause categorization headaches
- Cryptic merchant names ("POS PURCHASE 1234")

**5. Time-Consuming Reconciliation**
- Matching receipts to bank transactions is manual
- Need fuzzy matching (amount + merchant + ±3 days for posting delays)
- 20-30% of receipts don't match cleanly

---

## MARKET ANALYSIS

### Target Market Size (UK)

**Total Addressable Market (TAM):**
- 35,000+ accounting practices in UK
- Average 100-500 clients per practice
- TAM: £420M/year (35K firms × £1,000/month average)

**Serviceable Available Market (SAM):**
- Firms with 100-500 clients (10,000 firms)
- Currently using manual processes or low-end tools
- SAM: £120M/year (10K firms × £1,000/month)

**Serviceable Obtainable Market (SOM):**
- Year 1-3 target: 30 firms
- SOM: £360K/year (30 firms × £1,000/month)

### Competitive Landscape

| Competitor | Pricing | Accuracy | UK Banks | AI Learning | Market Position |
|------------|---------|----------|----------|-------------|-----------------|
| **Dext** | £6,750-9,000/mo | 80-85% | Most | No | Market leader |
| **Hubdoc** | £2,250-6,750/mo | 75-80% | Most | No | Xero-owned |
| **AutoEntry** | £4,500-11,250/mo | 80% | Limited | No | QB-focused |
| **YOU** | £800-1,200/mo | 95-99% | ALL | YES | New entrant |

### Competitive Advantages

1. **AI-Powered (Claude 3.5 Sonnet + Haiku)**
   - 95-99% accuracy vs 80-85% for OCR
   - Understands context, not just text extraction
   - Handles poor quality images better

2. **Learning System**
   - Learns from accountant corrections
   - Improves categorization over time
   - Merchant-to-category memory

3. **Smart Matching**
   - Fuzzy matching on amount + merchant + date range
   - Handles posting delays (±3 days)
   - Detects duplicates automatically

4. **All UK Banks**
   - Supports ALL major UK banks including neobanks (Monzo, Starling, Revolut)
   - Handles "pots" properly
   - All formats: PDF, CSV, Excel, API feeds

5. **Price Disruption**
   - 83-88% cheaper than Dext
   - 50% cheaper than hiring a person
   - Pay-as-you-grow model

---

## DESIGN PARTNER CASE STUDY

### Tax Company Profile

**Company Details:**
- 450 clients (sole traders, small limited companies, freelancers)
- Industries: Construction, Hospitality, Leisure, Professional Services
- 3 accountants on staff
- Using: IRIS Kashflow, IRIS VAT software, Sage Payroll

**Document Volume (Monthly):**
- Bank statements: 1,000
- Receipts: 10,000
- Invoices (sales): 1,000
- Invoices (purchase): 10,000
- **Total primary documents: 11,000/month**

**Current Process:**
- 100% manual data entry
- 30+ hours/week PER accountant (90 hours/week total)
- NO receipt processing software (no Dext/Hubdoc)
- Top pain points:
  1. Manual data entry (biggest time waste)
  2. Chasing clients for receipts
  3. Fixing errors/discrepancies
  4. Categorization
  5. Matching receipts to transactions

**Current Costs:**
- Labor on data entry: 360 hours/month × £17/hour = **£6,120/month**
- Software: IRIS (£2,250/mo) + VAT (£333/mo) + Other (£250/mo) = **£2,833/month**
- **Total: £8,953/month**

### Value Proposition to Design Partner

**With AI System:**

**Time Savings:**
- Reduce manual work from 90 hrs/week to 9 hrs/week (90% reduction)
- Save: 84 hours/month × 3 staff = 252 hours/month
- Value: 252 hrs × £17 = **£4,284/month saved**

**Cost Analysis:**

| Item | Current | With AI | Savings |
|------|---------|---------|---------|
| Labor (data entry) | £6,120/mo | £612/mo | £5,508/mo |
| Software (existing) | £2,833/mo | £2,833/mo | £0 |
| AI System | £0 | £800/mo | -£800/mo |
| **TOTAL** | **£8,953/mo** | **£4,245/mo** | **£4,708/mo** |

**ROI Calculation:**
- Investment: £800/month (Year 1 design partner rate)
- Savings: £5,508/month (labor reduction)
- **Net Benefit: £4,708/month**
- **ROI: 589%**

**Annual Impact:**
- Investment: £9,600/year
- Savings: £66,096/year
- **Net Benefit: £56,496/year**

### What They Get

**Features:**
- Automatic extraction from bank statements (all UK banks, all formats)
- Automatic extraction from receipts (all formats including poor quality)
- AI-powered categorization (learns their 20-30 categories)
- Smart receipt-to-transaction matching (fuzzy logic)
- Duplicate detection
- VAT extraction (amount, rate, registration number)
- Box 1-9 calculations for VAT returns
- Direct IRIS Kashflow integration
- Batch processing
- Review/approval interface
- Correction learning system

**Support:**
- 24-48 hour processing SLA
- Email + phone support
- Monthly check-ins
- Free training
- Feature requests priority

**Contract Terms:**
- Year 1: £800/month (50% design partner discount)
- Year 2+: £1,200/month (standard rate)
- 12-month minimum contract
- Monthly billing

---

## PRICING STRATEGY

### Pricing Model: Tiered Volume-Based

| Tier | Documents/Month | Price/Month | Target Customer |
|------|----------------|-------------|-----------------|
| **Starter** | 0-3,000 | £400 | Solo accountants, 1-50 clients |
| **Growth** | 3,001-8,000 | £800 | Small practices, 51-150 clients |
| **Professional** | 8,001-15,000 | £1,200 | Medium practices, 151-300 clients |
| **Enterprise** | 15,001-30,000 | £1,800 | Large practices, 301-500 clients |
| **Custom** | 30,001+ | Custom | Enterprise, 500+ clients |

### Pricing Rationale

**Why NOT per-seat pricing:**
- Accountants share workload dynamically
- Hard to enforce
- Competitors don't do it

**Why NOT per-client pricing:**
- Client volume varies (10-10,000 docs/month per client)
- Unfair to high-document-volume clients
- Complex to explain

**Why volume-based tiers:**
- ✅ Fair: Pay for what you process
- ✅ Simple: Easy to understand
- ✅ Scalable: Grows with customer
- ✅ Predictable: Monthly caps, no surprises

### Competitive Price Comparison

**For Medium Practice (10,000 docs/month):**

| Solution | Monthly Cost | Savings vs YOU |
|----------|-------------|----------------|
| **Dext** | £6,750-9,000 | 83-88% more expensive |
| **Hubdoc** | £2,250-6,750 | 47-82% more expensive |
| **AutoEntry** | £4,500-11,250 | 73-89% more expensive |
| **Hire Person** | £2,000-2,500 | 40-52% more expensive |
| **YOU** | £1,200 | **BASELINE** |

### Design Partner Pricing

**Year 1 Special Rate:**
- £800/month (33% off standard £1,200 rate)
- Justification: Beta testing, feedback, testimonial, referrals
- 12-month lock-in

**Year 2 Standard Rate:**
- £1,200/month (Professional tier for 11,000 docs)
- OR: Loyalty lock at £1,000/month if good relationship

### Revenue Projections

**Year 1 (4 customers):**
| Customer | Tier | Price | Annual |
|----------|------|-------|--------|
| Design Partner | Professional | £800 | £6,400 |
| Customer 2 | Growth | £800 | £9,600 |
| Customer 3 | Starter | £400 | £4,800 |
| Customer 4 | Growth | £800 | £9,600 |
| **TOTAL** | - | - | **£30,400** |

**Year 2 (20 customers):**
- Mix of tiers, average £1,000/month
- MRR: £20,000
- **ARR: £240,000**

**Year 3 (30 customers):**
- Mix of tiers, average £1,100/month
- MRR: £33,000
- **ARR: £396,000**

---

## COST STRUCTURE

### Variable Costs (Per Customer)

**For Medium Practice (11,000 docs/month):**

**Unoptimized Costs:**
| Item | Cost/Month |
|------|------------|
| Claude API (Sonnet for all) | £1,350 |
| Railway (backend hosting) | £70 |
| Supabase (database + storage) | £120 |
| Vercel (frontend) | £16 |
| **TOTAL** | **£1,556** |
| **Margin @ £1,200 pricing** | **-23% (LOSS)** ❌ |

**Optimized Costs:**
| Item | Cost/Month |
|------|------------|
| Claude API (80% Haiku, 20% Sonnet) | £550 |
| Railway (batch processing) | £50 |
| Supabase (optimized) | £100 |
| Vercel (frontend) | £16 |
| **TOTAL** | **£716** |
| **Margin @ £1,200 pricing** | **40%** ✅ |

### Cost Optimization Strategies

**1. Use Claude Haiku for Simple Receipts (80% of volume)**
- Haiku cost: £0.01-0.02 per receipt
- Sonnet cost: £0.10 per receipt
- Savings: £800/month per 10,000 receipts
- **Rule:** Use Haiku unless:
  - Receipt is low quality (blurry, faded)
  - Receipt is handwritten
  - First time seeing this merchant

**2. Batch Processing (vs Real-Time)**
- Process documents overnight in batches
- Reduce Railway worker instances from 3 to 1
- Reduce Supabase concurrent connections
- Savings: £20-50/month

**3. Smart Caching**
- Hash check all uploaded documents
- Skip re-processing duplicates
- Cache merchant-to-category mappings
- Savings: £50-100/month in API calls

**4. Incremental Processing**
- Only process new transactions from bank statements
- Don't re-process entire statement every time
- Savings: 30% reduction in statement processing costs

### Fixed Costs (Monthly)

| Item | Cost/Month |
|------|------------|
| Domain + SSL | £2 |
| Error monitoring (Sentry) | £0 (free tier) |
| Analytics (Posthog) | £0 (free tier) |
| Email (SendGrid) | £15 |
| Your time/salary | £0 (sweat equity Year 1) |
| **TOTAL** | **£17/month** |

### Scaling Economics

| Customers | Docs/Month | Revenue @£1,000 | Costs (Opt.) | Profit | Margin |
|-----------|------------|-----------------|--------------|--------|--------|
| 1 | 11,000 | £1,000 | £733 | £267 | 27% |
| 5 | 55,000 | £5,000 | £3,665 | £1,335 | 27% |
| 10 | 110,000 | £10,000 | £7,330 | £2,670 | 27% |
| 20 | 220,000 | £20,000 | £14,660 | £5,340 | 27% |
| 30 | 330,000 | £30,000 | £21,990 | £8,010 | 27% |

**Key Insight:** Margins stay consistent at scale (27-30%) because API costs are linear with volume.

---

## FINANCIAL PROJECTIONS (3 YEARS)

### Year 1: Foundation & Design Partner

**Assumptions:**
- Month 1-4: Development phase (0 revenue)
- Month 5: Design partner goes live (£800/month)
- Month 7: Customer 2 (£800/month)
- Month 9: Customer 3 (£400/month)
- Month 11: Customer 4 (£800/month)

| Month | Customers | MRR | Costs | Profit | Cumulative |
|-------|-----------|-----|-------|--------|------------|
| 1-4 | 0 (dev) | £0 | £0 | £0 | £0 |
| 5 | 1 | £800 | £733 | £67 | £67 |
| 6 | 1 | £800 | £733 | £67 | £134 |
| 7 | 2 | £1,600 | £1,466 | £134 | £268 |
| 8 | 2 | £1,600 | £1,466 | £134 | £402 |
| 9 | 3 | £2,000 | £1,833 | £167 | £569 |
| 10 | 3 | £2,000 | £1,833 | £167 | £736 |
| 11 | 4 | £2,800 | £2,566 | £234 | £970 |
| 12 | 4 | £2,800 | £2,566 | £234 | £1,204 |

**Year 1 Totals:**
- Revenue: £16,400
- Costs: £13,196
- **Profit: £3,204**

### Year 2: Growth Phase

**Assumptions:**
- Start with 4 customers (from Year 1)
- Add 2 customers/month (months 1-8)
- Average price: £900/month

| Quarter | Starting | Ending | Avg MRR | Revenue | Costs | Profit |
|---------|----------|--------|---------|---------|-------|--------|
| Q1 | 4 | 10 | £6,300 | £18,900 | £13,797 | £5,103 |
| Q2 | 10 | 16 | £11,700 | £35,100 | £25,641 | £9,459 |
| Q3 | 16 | 20 | £16,200 | £48,600 | £35,532 | £13,068 |
| Q4 | 20 | 20 | £18,000 | £54,000 | £39,600 | £14,400 |

**Year 2 Totals:**
- Revenue: £156,600
- Costs: £114,570
- **Profit: £42,030**

### Year 3: Scale Phase

**Assumptions:**
- Start with 20 customers
- Add 1 customer/month (months 1-10)
- Average price: £1,100/month

| Quarter | Starting | Ending | Avg MRR | Revenue | Costs | Profit |
|---------|----------|--------|---------|---------|-------|--------|
| Q1 | 20 | 23 | £22,650 | £67,950 | £49,797 | £18,153 |
| Q2 | 23 | 26 | £26,950 | £80,850 | £59,283 | £21,567 |
| Q3 | 26 | 29 | £30,250 | £90,750 | £66,525 | £24,225 |
| Q4 | 29 | 30 | £32,725 | £98,175 | £71,979 | £26,196 |

**Year 3 Totals:**
- Revenue: £337,725
- Costs: £247,584
- **Profit: £90,141**

### 3-Year Summary

| Year | Customers | Revenue | Costs | Profit | Margin |
|------|-----------|---------|-------|--------|--------|
| 1 | 4 | £16,400 | £13,196 | £3,204 | 20% |
| 2 | 20 | £156,600 | £114,570 | £42,030 | 27% |
| 3 | 30 | £337,725 | £247,584 | £90,141 | 27% |
| **TOTAL** | - | **£510,725** | **£375,350** | **£135,375** | **26%** |

---

## GO-TO-MARKET STRATEGY

### Phase 1: Design Partner (Months 1-6)

**Goal:** Build product with real customer, prove ROI, get testimonial

**Actions:**
1. ✅ Complete requirements questionnaire (DONE)
2. Sign design partner agreement (£800/month Year 1)
3. Build MVP (3 months development)
4. Beta test with 2-3 of their accountants (1 month)
5. Go live with all 450 clients (Month 5)
6. Measure results (Month 6):
   - Time saved
   - Accuracy achieved
   - Issues encountered
   - ROI delivered
7. Get testimonial + case study
8. Get 3-5 referrals to similar firms

**Success Criteria:**
- ✅ 95%+ accuracy on extraction
- ✅ 25 hours/week saved (per their requirement)
- ✅ 90% reduction in manual data entry
- ✅ Customer satisfaction score 8+/10
- ✅ Willing to refer others

### Phase 2: Early Customers (Months 7-12)

**Goal:** Get to 5 paying customers, validate product-market fit

**Customer Acquisition Channels:**
1. **Referrals from Design Partner** (best source)
   - Ask for 3-5 warm intros
   - Offer £500 referral bonus per paying customer

2. **Direct Outreach** (LinkedIn + Email)
   - Target: Accounting firms with 100-500 clients
   - Message: "We helped [Tax Company] save £56K/year"
   - Offer: Free audit of their current process

3. **Content Marketing**
   - Case study: "[Tax Company] Saves 25 Hours/Week with AI"
   - Blog: "Why UK Accountants Are Switching from Dext"
   - SEO: "AI accounting automation UK", "Dext alternative"

4. **Industry Events**
   - AccountingWEB Live
   - Accountex
   - Local accounting networking events

**Conversion Process:**
1. Discovery call (30 mins)
   - Understand their pain
   - Calculate their ROI
2. Demo (30 mins)
   - Show actual extraction from their documents
   - Live categorization demo
3. Free trial (14 days)
   - Process 500 documents free
   - Show accuracy results
4. Close (contract + onboarding)

**Target:** 1-2 new customers per quarter

### Phase 3: Growth (Year 2)

**Goal:** Get to 20 customers, £20K MRR

**Customer Acquisition:**
- Scale direct outreach (hire VA for LinkedIn/email)
- Launch Xero/QuickBooks app marketplace listings
- Partner with accounting software resellers
- Paid ads (Google Ads, LinkedIn Ads)
- Webinars: "How to 10x Your Accounting Practice with AI"

**Sales Process:**
- Hire part-time salesperson (commission-only Year 1, salary Year 2)
- Create self-service demo
- Implement product-led growth (free tier for solo accountants)

**Target:** 2 new customers per month

### Phase 4: Scale (Year 3)

**Goal:** Get to 30-50 customers, £30-50K MRR

**Customer Acquisition:**
- Full-time sales team (1-2 people)
- Channel partnerships (accounting software VARs)
- Reseller program (white-label for large practices)
- International expansion (Australia, Canada, US)

**Target:** 1-2 new customers per month (more selective, higher quality)

---

## RISKS & MITIGATION

### Technical Risks

**Risk 1: Claude API Accuracy Below 99%**
- Impact: Customer dissatisfaction, churn
- Probability: Medium
- Mitigation:
  - Test extensively in beta with real documents
  - Use ensemble approach (Haiku for simple, Sonnet for complex)
  - Human-in-the-loop for low-confidence predictions
  - Continuous learning from corrections

**Risk 2: Claude API Costs Higher Than Expected**
- Impact: Negative margins, unprofitable
- Probability: Medium
- Mitigation:
  - ✅ Already calculated worst-case (£1,556/month unoptimized)
  - Implement optimization strategies (Haiku, batching, caching)
  - Monitor costs daily
  - Adjust pricing if needed (have room to go to £1,500)

**Risk 3: Claude API Rate Limits**
- Impact: Processing delays, SLA breaches
- Probability: Low
- Mitigation:
  - Batch processing (not real-time)
  - Queue system with retry logic
  - Multiple API keys if needed
  - Negotiate enterprise rate limits with Anthropic

**Risk 4: Integration Challenges (IRIS Kashflow)**
- Impact: Customer can't use the product
- Probability: Medium
- Mitigation:
  - CSV export fallback (always works)
  - Partner with IRIS for official integration
  - Support multiple accounting software (Xero, QuickBooks, Sage)

### Business Risks

**Risk 5: Design Partner Doesn't Convert**
- Impact: No testimonial, no referrals, wasted effort
- Probability: Low-Medium
- Mitigation:
  - Clear contract with deliverables
  - Weekly check-ins during development
  - Measure ROI from Month 1
  - Provide exceptional support

**Risk 6: Dext Lowers Prices**
- Impact: Lost competitive advantage
- Probability: Low
- Mitigation:
  - Our cost structure is lower (AI vs traditional OCR)
  - Differentiate on accuracy and learning (not just price)
  - Lock customers in with annual contracts
  - Dext can't easily match 99% accuracy

**Risk 7: Slow Customer Acquisition**
- Impact: Takes 5 years instead of 3 to reach profitability
- Probability: Medium-High
- Mitigation:
  - Multiple acquisition channels (referrals, outreach, ads, events)
  - Offer free trials to reduce friction
  - Hire commission-based salesperson (no fixed cost)
  - Pivot to different customer segment if needed (bookkeepers vs accountants)

**Risk 8: High Churn Rate**
- Impact: Revenue plateaus, can't grow
- Probability: Medium
- Mitigation:
  - Deliver exceptional value (10x ROI minimum)
  - Monthly check-ins with customers
  - Implement feature requests quickly
  - Annual contracts with discount (reduce churn)
  - NPS surveys to catch issues early

### Market Risks

**Risk 9: AI Commoditization**
- Impact: Every accounting software adds AI, we're not differentiated
- Probability: High (long-term)
- Mitigation:
  - Build for UK-specific workflows (hard to replicate)
  - Accumulate customer data (improves accuracy over time)
  - Focus on customer relationships (switching costs)
  - Add adjacent features (tax planning, advisory tools)
  - Acquire customers NOW before market consolidates

**Risk 10: Regulatory Changes (HMRC, GDPR)**
- Impact: Product needs major rework, compliance costs
- Probability: Medium
- Mitigation:
  - Build GDPR-compliant from Day 1
  - UK-based data storage (Supabase EU region)
  - Follow HMRC MTD guidelines
  - Legal review before launch (£1,000 one-time)

---

## SUCCESS METRICS

### North Star Metric
**Hours Saved Per Customer Per Month**
- Target: 25+ hours/month per customer
- Measure: Self-reported in monthly check-ins
- Why: This is what they actually care about

### Financial Metrics

**Monthly Recurring Revenue (MRR):**
- Month 6: £800
- Month 12: £2,800
- Month 24: £20,000
- Month 36: £30,000+

**Customer Acquisition Cost (CAC):**
- Target: <£1,000 per customer
- Measure: Total sales/marketing spend ÷ new customers

**Lifetime Value (LTV):**
- Target: £15,000+ per customer (based on 18-month avg retention)
- Measure: Avg revenue per customer × avg customer lifetime

**LTV:CAC Ratio:**
- Target: >3:1
- Healthy SaaS benchmark: 3:1 to 5:1

**Gross Margin:**
- Target: 30%+ (after optimization)
- Measure: (Revenue - Variable Costs) ÷ Revenue

**Monthly Burn Rate:**
- Year 1 Target: £0 (profitable from Month 5)
- Measure: Total costs - Total revenue

### Product Metrics

**Extraction Accuracy:**
- Target: 95%+ for bank statements, 95%+ for receipts
- Measure: Correct extractions ÷ Total extractions (human-validated sample)

**Categorization Accuracy:**
- Target: 90%+ first attempt, 95%+ after learning
- Measure: Correct categories ÷ Total transactions (validated by accountant)

**Matching Accuracy:**
- Target: 85%+ automatic matches accepted
- Measure: Auto-matches approved ÷ Total auto-matches suggested

**Processing Time:**
- Target: <24 hours for batch, <5 minutes per document
- Measure: Time from upload to results ready

**User Satisfaction:**
- Target: NPS 50+, CSAT 8+/10
- Measure: Quarterly surveys

### Operational Metrics

**Uptime:**
- Target: 99.5%+
- Measure: Uptime monitoring (UptimeRobot)

**Support Response Time:**
- Target: <4 hours for email, <1 hour for urgent
- Measure: Time from ticket creation to first response

**Customer Churn:**
- Target: <10% annual churn
- Measure: Churned customers ÷ Total customers (annual)

**Feature Request Fulfillment:**
- Target: 70%+ of requests implemented within 3 months
- Measure: Implemented requests ÷ Total requests

---

## EXIT STRATEGY (OPTIONAL)

### Potential Acquirers (Years 3-5)

**Strategic Buyers:**
1. **Dext / Hubdoc** - Eliminate competitor, acquire customer base
2. **Xero / Intuit (QuickBooks)** - Add AI capabilities to core product
3. **Sage / IRIS** - Modernize product offering for UK market
4. **Private Equity (Accounting Tech Rollup)** - Consolidation play

### Valuation Metrics

**SaaS Valuation Multiples (2025-2026):**
- Early-stage (£0-500K ARR): 2-4x ARR
- Growth-stage (£500K-2M ARR): 4-8x ARR
- Mature (£2M+ ARR): 6-12x ARR

**Year 3 Valuation Scenario:**
- ARR: £400,000
- Multiple: 5x (conservative for profitable SaaS)
- **Valuation: £2,000,000**

**Year 5 Valuation Scenario:**
- ARR: £1,200,000 (100 customers)
- Multiple: 7x (proven track record)
- **Valuation: £8,400,000**

### Alternative: Keep Running

**Lifestyle Business Option:**
- 50 customers × £1,000/month = £50,000 MRR = £600K ARR
- 30% margin = £180K profit/year
- Passive income, minimal time required (automated + support team)
- Keep running indefinitely

---

## CONCLUSION

### Why This Business Makes Sense

1. **Real Problem:** UK accountants waste 30+ hrs/week on manual data entry
2. **Large Market:** 35,000 accounting firms in UK, 10,000 in target segment
3. **Weak Competitors:** Existing solutions are expensive and low-accuracy
4. **AI Advantage:** Claude delivers 95-99% accuracy vs 80-85% for OCR
5. **Price Disruption:** 85% cheaper than Dext, still 30% gross margin
6. **Validated Demand:** Design partner has 450 clients, willing to pay £800/month
7. **Proven ROI:** £56K/year savings for £9.6K/year investment (589% ROI)
8. **Scalable:** SaaS model, low marginal cost per customer
9. **Defensible:** Learning system improves over time, UK-specific workflows

### Why Now

1. **AI Breakthrough:** Claude 3.5 (Oct 2024) made 99% accuracy possible
2. **Market Timing:** Accounting firms digitizing post-COVID
3. **Competitor Weakness:** Dext/Hubdoc haven't added AI yet
4. **Personal Positioning:** Oxford AI Engineering course + WeldQAi experience = credibility
5. **Low Risk:** 3 months development, £9K Year 1 cost, profitable from Month 5

### Investment Required

**Time:**
- 3 months full-time development (AI-assisted with Claude/Cursor)
- 3-6 months part-time support/sales (after launch)

**Money:**
- Year 1: £9,000 infrastructure costs
- No salary (sweat equity)
- Total cash requirement: £9,000

**Return:**
- Year 1: £3,200 profit (35% ROI)
- Year 2: £42,000 profit (467% ROI)
- Year 3: £90,000 profit (1,000% ROI)
- Exit (Year 5): £2-8M valuation

### Recommendation

**PROCEED WITH BUILD.**

The business case is solid:
- ✅ Real customer willing to pay
- ✅ Massive ROI for them (589%)
- ✅ Profitable from Month 5
- ✅ Scalable to £200K+ ARR in 3 years
- ✅ Low risk (£9K investment, proven demand)
- ✅ High learning value (adds to WeldQAi expertise)

**Next Steps:**
1. Sign design partner agreement with tax company
2. Build MVP (Weeks 1-12)
3. Beta test (Weeks 13-16)
4. Go live (Week 17)
5. Get testimonial + referrals (Week 20)
6. Close Customer 2 (Month 7)

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Next Review:** After Design Partner Beta (Month 4)
