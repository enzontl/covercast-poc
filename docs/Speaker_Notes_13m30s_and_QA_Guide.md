# CoverCast — 13m30s Pitch Script, Live Demo Choreography & Individual Q&A Battlecards

> **Target Total Time:** `13 min 30 sec` (leaves a safe `1 min 30 sec` buffer before the `15:00` `-1 pt/min` penalty).
> **Followed by:** `5 min 00 sec` Jury Q&A (`1` individual question per team member).

---

## 1. Speaker Allocation & Minute-by-Minute Run-of-Show

| Slide | Imposed Title | Speaker | Target Time | Cumulative Clock |
| :--- | :--- | :--- | :---: | :---: |
| **01** | `Problem` | **Alexis Arnaud** (COO) | `1m 15s` | `01:15` |
| **02** | `Solution` | **Waleston Trinh** (CEO) | `1m 15s` | `02:30` |
| **03** | `Live demo` (Slide + Live Browser PoC) | **Enzo Natali** (CPO) | `2m 45s` | `05:15` |
| **04** | `Market analysis` | **Alexis Arnaud** (COO) | `1m 15s` | `06:30` |
| **05** | `Business model and price` | **Alessandro Arensberg** (CFO) | `1m 15s` | `07:45` |
| **06** | `Traction` | **Alexis Arnaud** (COO) | `1m 15s` | `09:00` |
| **07** | `Competition and defensibility` | **Waleston Trinh** (CEO) | `1m 30s` | `10:30` |
| **08** | `Team` | **Enzo Natali** (CPO) | `0m 45s` | `11:15` |
| **09** | `Financials` | **Alessandro Arensberg** (CFO) | `1m 25s` | `12:40` |
| **10** | `The ask` | **Waleston Trinh** (CEO) | `0m 50s` | `13:30` |

**Total Speaking Balance:**
- **Waleston Trinh:** `3m 35s` (Slides 2, 7, 10)
- **Enzo Natali:** `3m 30s` (Slide 3 + Live PoC Demo, Slide 8)
- **Alexis Arnaud:** `3m 45s` (Slides 1, 4, 6)
- **Alessandro Arensberg:** `2m 40s` (Slides 5, 9)

---

## 2. Verbatim Speaker Notes (Slide by Slide)

### Slide 1 — `Problem` (`00:00 – 01:15` · Alexis Arnaud)
- "Good afternoon everyone. Meet **Chef Karim**, Head Chef at **Bistrot Urbain #04** in Paris Montparnasse—part of a 12-restaurant bistro group spending **€10 million a year** on food and beverage."
- "Karim leads an 8-person kitchen brigade and lives by three KPIs: keeping food cost under 28%, serving 24-to-48-hour fresh produce, and **never running out of a dish mid-service**."
- "Every night at **10:45 PM**, after 12 hours on his feet, Karim spends **45 minutes** juggling Zenchef bookings, Lightspeed POS, weather apps, and walk-in fridge clipboards before the midnight Rungis cutoff. Because running out of Bavette or fresh Cod on a Saturday ruins guest reviews, Karim pads his orders by 20 to 30 percent."
- "When rain or a local event swings walk-ins by **±22%**, that safety buffer goes straight into the bin on Monday morning. Today, Bistrot Urbain throws away **8% of its purchases—€67,000 per restaurant per year**, or **€800,000 across the group**. Moving from 8% to the industry’s **5% benchmark** represents **€300,000 per year in directly avoidable perishable waste**."

### Slide 2 — `Solution` (`01:15 – 02:30` · Waleston Trinh)
- "To capture that €300,000 without turning chefs into data scientists, we built **CoverCast**."
- "For multi-site casual-dining Head Chefs and Operations Directors whose gut-feel nightly orders burn 8% of food purchases and 45 minutes after service, **CoverCast** is a **nightly order-preparation copilot** that cuts waste toward 5% in one click. **Unlike** heavy restaurant ERPs like **Nory or Inpulse** that require months of full-suite onboarding, or static inventory trackers like **MarketMan and Restoke** that are blind to tomorrow’s rain and local events, CoverCast plugs into existing POS and booking tools in **48 hours**, explains every driver in plain kitchen English, and leaves the final sign-off in the Chef’s hands."
- "At 10:30 PM, CoverCast syncs automatically. At 10:45 PM, Karim opens one screen, reviews the cover confidence interval and net ingredient packs, adjusts a pack if physical produce looks ripe, and validates in under **3 minutes**. Zero autonomous purchasing—100% human-in-the-loop."

### Slide 3 — `Live demo` + Browser PoC (`02:30 – 05:15` · Enzo Natali)
- *(On Slide 3 — 30 sec)*: "Let’s show you our **Moment of Truth** live: *In under 3 seconds, CoverCast turns tonight’s bookings, heavy rain forecast, nearby trade show, and fridge stock into a **312-cover forecast (90% CI: 287–337)** and an **explained €541 supplier order versus €787 habitual**—saving **€246** in one click.* Switching to the live browser PoC now."
- *(Switch to Browser Tab — `2 min 15 sec` choreography)*:
  1. **Point out Zero-Friction Thin Wrapper (15s):** "No login wall, no settings maze—this is Karim’s single 10:45 PM screen for Bistrot Urbain Montparnasse."
  2. **Show Reference Scenario Output (45s):** "Tonight is Friday preparing **Saturday’s order**. Normally Karim assumes **395 covers** and orders **€787** of perishables. Look at the conflicting signals on the left: **198 Zenchef bookings** (+12 above norm), **Heavy Rain (14mm)** closing the terrace (−88 walk-ins), and the **Porte de Versailles Trade Show** 450m away (+28 spillover diners). CoverCast outputs **312 covers** with a **90% statistical interval of 287 to 337**, and a net order of **€541—saving €246 (−31.3%) tonight alone**, mainly trimming 24-hour Cod (−€95) and Bavette (−€88). Look at the top-right telemetry card: this entire AI call costs **$0.000345**."
  3. **Prove Live Interactivity & Upside Protection (45s):** "What if the jury tests an upside surge? Let’s click **Preset #2: Sunny Friday + Match Night**. Instantly, CoverCast forecasts **418 covers (CI 395–441)** and adds a targeted buffer so Karim doesn't stock out of high-margin burgers and steaks. Now let’s click back to our **Saturday Demo**, suppose Karim spots less Cod in the fridge—we tap `+` on Cod (`8 kg → 9 kg`), the deterministic engine updates the cart to **€560** with zero LLM math risk."
  4. **1-Click Chef Validation (30s):** "We reset to `8 kg` (**€541**), click **Approve & Send Supplier Orders**, and in **42 seconds**—versus 45 minutes—all 5 supplier POs are dispatched with an EU AI Act human sign-off log."

### Slide 4 — `Market analysis` (`05:15 – 06:30` · Alexis Arnaud)
- "How big is this opportunity? At **€300 per site per month**, an average 10-site group represents **€36,000 in ARPA**."
- "Bottom-up across Western Europe, **8,000 multi-site commercial restaurant groups** represent a **€288M TAM**."
- "Within France’s **102,000 traditional table-service restaurants** under INSEE code **NAF 56.10A**, our **SAM** focuses on **480 structured urban casual-dining and bistro groups** of 5 to 25 sites—worth **€17.3M in ARR**."
- "Our 3-year **SOM** is **10% of that French beachhead: 48 groups (~480 sites), or €1.73M ARR**—signing roughly 1.3 groups per month. We sell by aligning three distinct stakeholders: **Chef Karim** (daily user who needs speed and zero stockouts), the **Executive Chef** (technical champion), and the **Group COO/CFO** (economic buyer funding rapid EBITDA expansion)."

### Slide 5 — `Business model and price` (`06:30 – 07:45` · Alessandro Arensberg)
- "Our business model is a straightforward **B2B SaaS subscription paid by Group HQ at €300 per restaurant per month**, including unlimited nightly AI runs."
- "Why €300? First, it is anchored cleanly against verified market benchmarks: **Restoke Pro ($249)** and **MarketMan Growth ($299)** lack predictive weather/event forecasting, while enterprise suites like **Nory and Inpulse (€199–€329+ custom quotes)** require heavy multi-week ERP rollouts."
- "Second, €300 captures just **14% of the €2,083/site/month addressable waste reduction**. Even at 50% Year-1 capture, the client keeps over 71% of net savings. With **€60/site/month** in all-in cost to serve, CoverCast delivers an **80% SaaS gross margin**. For Bistrot Urbain, a 3-month 3-site paid pilot followed by 9 months across all 12 sites plus turnkey setup totals exactly **€36,600 in Year 1**."

### Slide 6 — `Traction` (`07:45 – 09:00` · Alexis Arnaud)
- "On traction, we ran **7 field discovery sessions** in Paris—5 Head and Sous-Chefs plus 2 multi-site Bistro Ops Directors—structured around the **Pay, Switch, and Degrade** tests, alongside live usability tests on PoC v1.0."
- "On **Pay**: both Ops Directors validated €300/site/month inside site opex budgets, provided we prove ≥2 points of food-cost drop over a 60-day pilot—which directly shaped our commercial offer."
- "On **Switch**: 4 out of 5 chefs told us they quit prior inventory tools because of 200-item nightly counts. Scoping CoverCast to the **6 to 10 Pareto perishables** driving 74% of spoilage brought median PoC validation time down to **52 seconds**."
- "On **Degrade**: chefs rejected black-box point numbers, but rated trust **4.6/5** when shown the **90% interval + causal waterfall + 1-tap override**. Backtesting across 52 weeks cut forecast MAPE from **21.4% to 6.8%**, and **2 Paris groups** are now scoping Q1 shadow pilots."

### Slide 7 — `Competition and defensibility` (`09:00 – 10:30` · Waleston Trinh)
- "We never claim we have no competitors—**Inpulse and Nory** are strong enterprise platforms. We win mid-market bistro groups on **48-hour deployment, glass-box causal explainability, and 60-second kitchen UX**."
- "Looking at the **7 AI Layers**, we never pretend our IP is the LLM. Layers 1 and 2 are rented commodities: EU serverless cloud and swappable compact models (`gpt-4o-mini` or `gemini-2.5-flash`) at **$0.000345 per call**."
- "Our defensible moat sits in **Layers 3 through 7**: turnkey French hospitality connectors (*Zelty, Lightspeed, Zenchef, Rungis packs*), per-site quantile elasticity calibration that learns from every chef override, **strict Layer-5 orchestration where deterministic code locks 100% of the math and the LLM only writes the explanation**, and neighborhood demand curves that compound with every Paris bistro added."
- "On compliance: we process **zero diner PII** under GDPR, and under the **EU AI Act** (including **Article 4 literacy** and **Article 50 transparency** active since August 2026), CoverCast is **Minimal/Limited Risk**—strictly outside Annex III High-Risk because we forbid HR scoring of chefs and enforce mandatory human sign-off."

### Slide 8 — `Team` (`10:30 – 11:15` · Enzo Natali)
- "Executing this are four complementary co-founders with zero outsourcing:"
- "**Waleston Trinh (CEO)** built our statistical quantile engine and LLM guardrail router. **I’m Enzo Natali (CPO)**, leading the single-screen Chef UX and 48-hour POS integrations. **Alexis Arnaud (COO)** leads Paris kitchen discovery, recipe card mapping, and pilot GTM. And **Alessandro Arensberg (CFO)** owns our CFO-grade invoice audit methodology, financial modeling, and AI Act governance."

### Slide 9 — `Financials` (`11:15 – 12:40` · Alessandro Arensberg)
- "Let’s look at how operational improvements become **hard euros**—without any fake 'soft time saved' inflation."
- "Although CoverCast frees **2,170 hours/year** of chef closing time across 12 sites, we value soft time at **€0** in our base ROI. Every euro comes from **Direct Supplier Invoice Compression (hard COGS)**: fewer wasted crates billed by Rungis and Metro at constant revenue."
- "Modeling a realistic **50% Year-1 capture** (within a 30%–60% range), Bistrot Urbain saves **€150,000** against **€36,600** Year-1 cost: a **€113,400 net gain, 310% net ROI, and 1.4-month payback**. Even under a **severe 25% capture stress test (€75k saved)**, ROI remains **105%**."
- "For CoverCast, AI compute is under **€0.01/site/month** against **€240/site/month gross margin (80%)**. Against lean fixed opex of **€25,000/month**, each 10-site group contributes €2,400/month—putting **monthly cash breakeven at exactly 11 groups in Month 11**, scaling to **48 groups and €1.73M ARR (+€446k EBITDA) in Year 3**."

### Slide 10 — `The ask` (`12:40 – 13:30` · Waleston Trinh)
- "To move from our working PoC to Month-11 profitability, we are raising **€250,000 in Pre-Seed over 18 months**: **40% (€100k)** for production POS and Rungis EDI connectors, **30% (€75k)** for Paris/Lyon bistro GTM and 48h onboarding, **20% (€50k)** for 99.9% nightly SLA and compliance, and **10% (€25k)** working capital buffer."
- "Alongside capital, we are signing **3 Paid 60-Day Design Partner Pilots** governed by three objective **Go / No-Go gates**: `<8.5%` cover MAPE, `≥80%` nightly chef sign-off in under 5 minutes, and `≥2.0 points` of verified supplier invoice food-cost drop to trigger full-group annual contracts. Thank you—we’re ready for your questions."

---

## 3. Individual Jury Q&A Battlecards (5-Min Defense — 1 Question Per Member)

### For Waleston Trinh (AI Architecture, 7 Layers & Forecasting Accuracy)
1. **Q: Why use an LLM at all if a statistical model computes the cover forecast and order quantities?**
   - **A:** "Precisely because LLMs are terrible at arithmetic and great at synthesis! In Layer 5, our quantile statistical model deterministically computes `312 covers (287–337)` and `€541`—zero hallucination risk. The compact LLM (`$0.000345/call`) translates structured feature weights—rain `−88`, Porte de Versailles expo `+28`, 24h cod shelf life—into a 2-sentence plain-English kitchen brief that earns Chef Karim’s trust in 10 seconds instead of showing cryptic regression coefficients."
2. **Q: How do you cold-start a new bistro with messy POS data in 48 hours?**
   - **A:** "We only need 90 days of daily POS dish-sales exports and Zenchef party totals—available in 3 clicks from Lightspeed or Zelty—paired with Météo-France historical weather for that Paris arrondissement and the group’s top 8–10 perishable recipe cards (*fiches techniques*)."
3. **Q: What happens if OpenAI or Gemini has an outage at 10:45 PM?**
   - **A:** "First, our multi-provider router fails over from `gpt-4o-mini` to `gemini-2.5-flash` in 800ms. Second, even under total external API blackout, our deterministic statistical engine and template causal brief run locally with **zero degradation to the order numbers**—which you can test right now in our PoC."

### For Enzo Natali (PoC UX, Workflow & POS/Supplier Integrations)
1. **Q: Chefs hate typing fridge stock at 11 PM—won’t manual stock input kill adoption?**
   - **A:** "That’s the #1 lesson from our Switch test! Instead of 200-SKU shelf counts, CoverCast pre-fills theoretical end-of-service stock (`yesterday’s delivery − tonight’s POS dish sales`) and only asks Karim to visually spot-check the **6 to 8 ultra-perishable items** in walk-in #1—taking under 40 seconds."
2. **Q: How do supplier orders actually reach Rungis, Metro, or local butchers?**
   - **A:** "In Phase 1 (PoC & Pilot), 1-click approval dispatches formatted POs via each supplier’s existing order email/WhatsApp webhook or EDI CSV—zero change required on the supplier side. In Phase 2 (funded by our €100k product budget), we add direct Choco / Metro EDI API push."
3. **Q: What if the chef overrides CoverCast every night back to habitual high orders?**
   - **A:** "Every `- / +` override is logged with next-day waste/stockout feedback. During the weekly Ops review, if CoverCast’s `8 kg` Cod recommendation would have covered actual Saturday sales without stockout while Karim overrode to `13 kg`, showing that concrete proof side-by-side builds rapid habit trust within 2–3 weeks."

### For Alexis Arnaud (Persona, Market Sizing, Traction & Competition)
1. **Q: Inpulse and Nory already exist in Europe with VC funding—why won’t they crush you?**
   - **A:** "Inpulse and Nory target large QSR chains and enterprise groups with heavy 6-to-12-week ERP and HR-rostering rollouts. Independent 8-to-20-site bistro groups in France (our **480-group SAM** under `NAF 56.10A`) reject heavy ERPs. CoverCast wins that mid-market wedge with a **48-hour overlay**, transparent €300 pricing, and chef-first explainability."
2. **Q: Is 48 groups in 3 years (€1.73M ARR) realistic or wishful thinking?**
   - **A:** "48 groups is 10% of our 480-group French bistro beachhead—just **8–12 groups in Year 1, 26 in Year 2, and 48 in Year 3**, averaging **1.3 new groups per month**. Because bistro executive chefs move frequently across Paris groups and share tools, 3 successful reference pilots create strong word-of-mouth referrals."
3. **Q: Who could kill this deal internally—the Chef or the Operations Director?**
   - **A:** "The COO signs the check, but **Chef Karim can silently kill it by ignoring it at 10:45 PM**. That is why we designed CoverCast as a copilot that protects Karim from stockouts first and never strips away his final override button."

### For Alessandro Arensberg (ROI Mechanics, Pricing, P&L & AI Act Compliance)
1. **Q: Walk me through how you get exactly 310% Year-1 ROI and why freed hours aren’t counted.**
   - **A:** "Bistrot Urbain spends €10M/yr on F&B and wastes 8% (€800k). Dropping to 5% makes €300k/yr addressable. We conservatively assume **50% capture in Year 1 = €150,000 in hard supplier invoice savings**. Subtracting **€36,600 Year-1 TCO** (3-month 3-site pilot €2.7k + €1.5k setup + 9-month 12-site rollout €32.4k) leaves **€113,400 net cash gain**: `113,400 / 36,600 = 310% ROI` and **1.4-month payback**. We count **€0** for the 2,170 freed hours because salaried chefs don’t automatically reduce payroll—making our ROI 100% CFO-audit-proof."
2. **Q: Is €25,000/month in Year-1 fixed costs realistic for a 4-person team in Paris?**
   - **A:** "Yes for an 18-month Pre-Seed founder-stage structure: lean early founder compensation + French BPI/student-entrepreneur social reliefs (~€18k/mo loaded), cloud/dev tooling (€2k/mo), and GTM/travel/legal (€5k/mo) = **€25k/mo**. At €2,400 monthly gross profit per 10-site group, **11 groups in Month 11 (€26.4k/mo GM)** covers fixed burn before we scale Year-2 salaries."
3. **Q: Could CoverCast fall under EU AI Act High-Risk if HQ uses override logs to evaluate or fire chefs?**
   - **A:** "Great question—that’s the exact Annex III employment boundary! Both our **terms of service (DPA)** and **product permissions** strictly prohibit individual HR ranking or disciplinary scoring of chefs; HQ sees site-level waste trends, never worker surveillance scores. That keeps CoverCast firmly in **Minimal/Limited Risk**, fully compliant with **Art. 4 AI Literacy** and **Art. 50 Transparency** enforced since August 2026."

---

## 4. Ready-to-Send Submission Email (Before Monday, Nov 23)

**To:** Guillaume Saint-Cirgue  
**Subject:** `[CC1 Submission] CoverCast — 10-Slide Pitch Deck (PDF) & Live PoC Link`

```text
Dear Guillaume,

Please find attached and linked below our deliverables for CoverCast (Team: Waleston Trinh, Enzo Natali, Alexis Arnaud, Alessandro Arensberg):

1. 10-Slide Pitch Deck (PDF attached): CoverCast_Pitch_Deck.pdf
   - Covers all 10 mandatory slides in exact order (Problem → The ask) on the Bistrot Urbain case (12 Paris bistros, €10M F&B purchases).

2. Working Single-Screen PoC (Shareable Browser URL — zero login / zero install):
   👉 [PASTE YOUR LIVE VERCEL OR NETLIFY URL HERE, e.g. https://covercast-poc.vercel.app]
   - Pre-loaded 1-click scenarios (including the Saturday + Heavy Rain + Porte de Versailles Trade Show demo: 312 covers [287–337 CI], €541 recommended order vs. €787 habitual, $0.000345/call AI telemetry, and 1-click Chef Karim validation).

Best regards,
Waleston Trinh, Enzo Natali, Alexis Arnaud & Alessandro Arensberg
Team CoverCast
```
