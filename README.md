# CoverCast — Nightly Chef Order Copilot (PoC & Pitch Deck)

**Team:** Waleston Trinh · Enzo Natali · Alexis Arnaud · Alessandro Arensberg  
**Reference Case:** Bistrot Urbain (12 restaurants in Paris, €10M annual F&B purchases, cutting perishable waste from 8% → 5%).

## Live Single-Screen PoC (Zero Login · Zero Install)

- **GitHub Pages (root `index.html`):** https://enzontl.github.io/covercast-poc/
- **Local preview:**
  ```bash
  npm start
  # Opens at http://localhost:3000 (includes /api/analyze serverless LLM endpoint)
  ```
- **Vercel / Netlify:** Ready to deploy directly from repository root (`vercel.json`, `netlify.toml`, `api/analyze.js`). Works 100% out-of-the-box without API keys via the calibrated statistical quantile + causal engine, and automatically uses `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY` if configured.

## Repository Contents

| Path | Description |
| :--- | :--- |
| `index.html`, `styles.css`, `app.js`, `api/analyze.js` | Single-screen CoverCast v1.0 PoC (Moment of Truth: `312` covers `[287–337 CI]`, `€541` vs `€787` habitual, `-€246` saved, `$0.000345/call`) |
| `pitch-deck/slides.html` & `pitch-deck/export-pdf.ps1` | Editable HTML slide deck source + 1-command headless Chrome PDF exporter |
| `docs/Speaker_Notes_13m30s_and_QA_Guide.md` | Timed `13m 30s` speaker script, live demo choreography, individual Q&A battlecards & submission email |
| `docs/CoverCast_Financial_Model.csv` | Multi-scenario client ROI (`310%` base / `105%` stress test) & 3-year SaaS P&L model |
| `covercast-poc/` | Standalone deployable copy of the PoC (`DEPLOY_README.md` included) |
