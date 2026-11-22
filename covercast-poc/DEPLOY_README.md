# CoverCast PoC — 30-Second Public Link Deployment & Backup Video Guide

Your PoC in `e:\projet-money\covercast-poc` is built to run **anywhere in a browser with zero installation for the jury**.

---

## Option A — Fastest Zero-CLI Shareable Link (15 Seconds via Netlify Drop)

1. Open **https://app.netlify.com/drop** in your browser.
2. Drag and drop the folder **`e:\projet-money\covercast-poc`** directly onto the page.
3. Netlify immediately gives you a live public `https://...netlify.app` URL (you can rename the site subdomain to **`covercast-poc.netlify.app`** in Site Settings → Change site name).
4. Open the URL in an Incognito window to confirm: it loads straight into **Chef Karim’s Saturday Rain + Trade Show scenario (`312 covers`, `€541 vs €787`)** with zero login!

---

## Option B — Vercel Deployment with Serverless Live LLM Backend (1 Minute)

If you want `/api/analyze` running live on Vercel (supporting `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY` server-side so visitors never need a key):

```powershell
cd e:\projet-money\covercast-poc
npx vercel --prod
```

*(Optional)* In your Vercel project dashboard → **Settings → Environment Variables**, add `OPENAI_API_KEY` (or `GEMINI_API_KEY`). Even without any environment variable, the app automatically falls back to its calibrated statistical + structured causal engine with zero errors.

---

## Updating the PoC URL in the PDF Deck (If Your Final URL Differs from `https://covercast-poc.vercel.app`)

1. Open `e:\projet-money\pitch-deck\slides.html` and replace `https://covercast-poc.vercel.app` (on Slides 3 and 10) with your live URL.
2. Re-export the 10-page PDF in 3 seconds:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "e:\projet-money\pitch-deck\export-pdf.ps1"
   ```

---

## Recording the 60-Second Backup Demo Video (Checklist Item #6)

1. Start locally (`cd e:\projet-money\covercast-poc && npm start`) or open your live deployed URL.
2. Press **`Win + Alt + R`** (Windows Game Bar screen recorder) on the browser window:
   - **0:00–0:15:** Show default **Saturday + Heavy Rain + Porte de Versailles** (`312 covers`, `90% CI 287–337`, `€541 vs €787`, `−€246`, `$0.000345/call`).
   - **0:15–0:35:** Click **Sunny Fri · Match Surge** (`418 covers`), then click back to **Sat Demo** and click `+` on Cod (`8 kg → 9 kg`).
   - **0:35–0:50:** Click **Approve & Send Supplier Orders** → show dispatched PO confirmation & click **Download PO Summary**.
3. Save the `.mp4` next to your deck on a USB stick / Google Drive for Defense Day!
