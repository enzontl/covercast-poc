// CoverCast v3.1 — Clear Chef Order Sheet + Live Voice Transcript + Explicit AI Diff & Undo + Direct Email Dispatch

const DAY_PROFILES = {
  saturday:  { label: "Saturday",  short: "Sat", baseCovers: 360, expectedBookings: 186, habitualCovers: 395, ciBase: 19 },
  friday:    { label: "Friday",    short: "Fri", baseCovers: 330, expectedBookings: 170, habitualCovers: 340, ciBase: 18 },
  thursday:  { label: "Thursday",  short: "Thu", baseCovers: 275, expectedBookings: 142, habitualCovers: 285, ciBase: 16 },
  wednesday: { label: "Wednesday", short: "Wed", baseCovers: 245, expectedBookings: 125, habitualCovers: 255, ciBase: 15 },
  tuesday:   { label: "Tuesday",   short: "Tue", baseCovers: 220, expectedBookings: 112, habitualCovers: 235, ciBase: 14 }
};

const WEATHER_EFFECTS = {
  heavy_rain: { icon: "🌧️", label: "Heavy Rain (14mm)", factor: -0.2444, ciAdd: 4, pillText: "Heavy rain (terrace closed)", phrase: "Heavy rain closes the terrace and cuts walk-ins" },
  light_rain: { icon: "🌦️", label: "Light Showers (3mm)", factor: -0.10, ciAdd: 3, pillText: "Light showers", phrase: "Light evening rain trims walk-in traffic" },
  cloudy:     { icon: "⛅", label: "Mild Overcast", factor: 0.0, ciAdd: 0, pillText: "Mild weather", phrase: "Neutral weather keeps walk-ins on baseline" },
  sunny:      { icon: "☀️", label: "Clear & Warm (22°C)", factor: 0.14, ciAdd: 3, pillText: "Sunny terrace (22°C)", phrase: "Warm terrace weather boosts spontaneous walk-ins" }
};

const EVENT_EFFECTS = {
  tradeshow: { icon: "🎪", label: "Porte de Versailles Expo", coversDelta: 28, ciAdd: 2, pillText: "Porte de Versailles Expo", phrase: "nearby trade-show diners add extra evening covers" },
  none:      { icon: "📍", label: "No local event", coversDelta: 0, ciAdd: 0, pillText: "", phrase: "" },
  match:     { icon: "⚽", label: "Match Night Surge", coversDelta: 36, ciAdd: 5, pillText: "Match night nearby", phrase: "match-night crowds drive a pre-game rush" },
  strike:    { icon: "🚇", label: "Metro Line 12 Strike", coversDelta: -34, ciAdd: 4, pillText: "Metro Line 12 strike", phrase: "the metro strike cuts cross-city commuters" }
};

const VENDOR_EMAILS = {
  "Rungis Marée Express":   "commandes@rungis-maree.fr",
  "Boucherie Francilienne": "atelier@boucherie-francilienne.fr",
  "Boulangerie Lutetia":    "pro@boulangerie-lutetia.fr",
  "Primeurs de Paris":      "livraison@primeurs-paris.fr",
  "Crèmerie des Halles":    "commandes@cremerie-halles.fr"
};

const BASE_SKUS = [
  { id: "cod",      name: "Fresh Atlantic Cod Fillet",    supplier: "Rungis Marée Express",   unit: "kg",    unitPrice: 19, ratePerCover: 0.03397, habitualSat: 13, defaultStock: 2.6 },
  { id: "bavette",  name: "Aged Bavette d'Aloyau Beef",   supplier: "Boucherie Francilienne", unit: "kg",    unitPrice: 22, ratePerCover: 0.05032, habitualSat: 14, defaultStock: 5.7 },
  { id: "buns",     name: "Artisanal Brioche Buns (x20)", supplier: "Boulangerie Lutetia",    unit: "trays", unitPrice: 15, ratePerCover: 0.01154, habitualSat: 5,  defaultStock: 0.6 },
  { id: "mesclun",  name: "Organic Mesclun Greens",       supplier: "Primeurs de Paris",      unit: "kg",    unitPrice: 8,  ratePerCover: 0.0391,  habitualSat: 11, defaultStock: 4.2 },
  { id: "cream",    name: "Normandy Heavy Cream AOP",     supplier: "Crèmerie des Halles",    unit: "L",     unitPrice: 6,  ratePerCover: 0.03205, habitualSat: 7,  defaultStock: 4.0 },
  { id: "tomatoes", name: "Heirloom Tomatoes & Herbs",    supplier: "Primeurs de Paris",      unit: "kg",    unitPrice: 3,  ratePerCover: 0.03974, habitualSat: 9,  defaultStock: 4.4 }
];

const PRESETS = {
  reference: {
    day: "saturday", bookings: 198, weather: "heavy_rain", event: "tradeshow",
    stocks: { cod: 2.6, bavette: 5.7, buns: 0.6, mesclun: 4.2, cream: 4.0, tomatoes: 4.4 }
  },
  surge: {
    day: "friday", bookings: 212, weather: "sunny", event: "match",
    stocks: { cod: 1.5, bavette: 3.0, buns: 0.4, mesclun: 2.0, cream: 2.5, tomatoes: 2.5 }
  },
  strike: {
    day: "tuesday", bookings: 96, weather: "light_rain", event: "strike",
    stocks: { cod: 2.8, bavette: 4.5, buns: 0.8, mesclun: 3.5, cream: 3.5, tomatoes: 3.8 }
  }
};

function cloneBaseSkus() {
  return BASE_SKUS.map((s) => ({ ...s }));
}

const state = {
  preset: "reference",
  scopeMultiplier: 1,       // 1 = Site #04 (Chef Karim) | 12 = Bistrot Urbain Group CFO view
  liveWeatherBanner: "",    // Populated when 🌐 Live Paris Open-Meteo is clicked
  day: "saturday",
  bookings: 198,
  weather: "heavy_rain",
  event: "tradeshow",
  extraCovers: 0,
  extraCoversNote: "",
  stocks: { ...PRESETS.reference.stocks },
  skus: cloneBaseSkus(),
  overrides: {},
  historyStack: [],
  aiRowNotes: {},
  pendingProposal: null,    // { draftState, heard, reflection, diffPills, rowNotes, costUsd }
  lastApplied: null,        // { heard, reflection, diffPills, costUsd }
  lastInfo: null,           // { heard, reflection }
  lastCostUsd: 0.000345,
  claudeApiKey: sessionStorage.getItem("covercast_claude_key") || "",
  claudeModel: sessionStorage.getItem("covercast_claude_model") || "claude-haiku-5-5",
  voiceLang: "en-US",
  sent: false,
  activeVendor: "",
  startTime: Date.now()
};

// DOM Refs
const daySelect = document.getElementById("daySelect");
const bookingsRange = document.getElementById("bookingsRange");
const weatherSelect = document.getElementById("weatherSelect");
const eventSelect = document.getElementById("eventSelect");
const signalsDrawer = document.getElementById("signalsDrawer");
const fridgeInputsGrid = document.getElementById("fridgeInputsGrid");
const aiDiffCard = document.getElementById("aiDiffCard");
const sendFooter = document.getElementById("sendFooter");
const sentCard = document.getElementById("sentCard");
const resetOrderBtn = document.getElementById("resetOrderBtn");

function fmtSigned(n) {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

// Deterministic Quantile Forecast Engine
function computeForecast() {
  const prof = DAY_PROFILES[state.day];
  const weather = WEATHER_EFFECTS[state.weather];
  const ev = EVENT_EFFECTS[state.event];

  const bookingDelta = Math.round(state.bookings - prof.expectedBookings);
  const weatherDelta = Math.round(prof.baseCovers * weather.factor);
  const eventDelta = ev.coversDelta;

  const p50 = Math.max(60, prof.baseCovers + bookingDelta + weatherDelta + eventDelta + state.extraCovers);
  const halfWidth = prof.ciBase + weather.ciAdd + ev.ciAdd;
  return {
    dayLabel: prof.label,
    shortDay: prof.short,
    habitualCovers: prof.habitualCovers,
    bookingDelta,
    weatherDelta,
    eventDelta,
    extraCovers: state.extraCovers,
    p50,
    p05: Math.max(45, p50 - halfWidth),
    p95: p50 + halfWidth
  };
}

function computeLines(forecast) {
  const habitualScale = forecast.habitualCovers / DAY_PROFILES.saturday.habitualCovers;
  return state.skus.map((sku) => {
    const grossNeed = Number((forecast.p50 * sku.ratePerCover).toFixed(1));
    const stock = state.stocks[sku.id] ?? sku.defaultStock;
    const recQty = Math.max(0, Math.ceil(Number((grossNeed - stock).toFixed(2))));
    const overrideDelta = state.overrides[sku.id] || 0;
    const finalQty = Math.max(0, recQty + overrideDelta);
    const habitualQty = state.day === "saturday" ? sku.habitualSat : Math.max(1, Math.round(sku.habitualSat * habitualScale));
    const lineEur = finalQty * sku.unitPrice;
    const habitualEur = habitualQty * (BASE_SKUS.find((b) => b.id === sku.id)?.unitPrice || sku.unitPrice);

    return {
      ...sku,
      stock,
      grossNeed,
      recQty,
      overrideDelta,
      finalQty,
      habitualQty,
      lineEur,
      habitualEur,
      deltaEur: lineEur - habitualEur
    };
  });
}

function renderFridgeDrawer() {
  document.getElementById("bookingsValLabel").textContent = state.bookings;
  fridgeInputsGrid.innerHTML = state.skus
    .map(
      (sku) => `
      <div class="fridge-mini">
        <span>${sku.name.split(" ").slice(0, 2).join(" ")}</span>
        <input type="number" step="0.1" min="0" max="40" data-fridge-id="${sku.id}" value="${(state.stocks[sku.id] ?? sku.defaultStock).toFixed(1)}" />
      </div>
    `
    )
    .join("");

  fridgeInputsGrid.querySelectorAll("input[data-fridge-id]").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      state.stocks[e.target.dataset.fridgeId] = Math.max(0, parseFloat(e.target.value) || 0);
      render();
    });
  });
}

function render() {
  const forecast = computeForecast();
  const lines = computeLines(forecast);
  const totalOrder = lines.reduce((s, l) => s + l.lineEur, 0);
  const totalHabitual = lines.reduce((s, l) => s + l.habitualEur, 0);
  const saved = totalHabitual - totalOrder;
  const pct = totalHabitual > 0 ? ((totalOrder - totalHabitual) / totalHabitual) * 100 : 0;

  // Quiet context line
  document.getElementById("contextSummaryText").textContent =
    (state.liveWeatherBanner ? `${state.liveWeatherBanner} · ` : "") +
    `Tomorrow (${forecast.dayLabel} 06:00 delivery) · ${state.bookings} Zenchef bookings · POS stock synced`;

  // 3 Hero Numbers (scales cleanly between 1 site and 12-site Bistrot Urbain Group CFO view)
  const mult = state.scopeMultiplier;
  const isGroup = mult > 1;
  document.getElementById("scopeTitle").textContent = isGroup
    ? "Group CFO Ripple · All 12 Bistrot Urbain Paris Sites"
    : "Chef Karim View · Site #04 Montparnasse";
  document.getElementById("cfoRippleBar").hidden = !isGroup;

  document.getElementById("metricCovers").textContent = (forecast.p50 * mult).toLocaleString("en-US");
  document.getElementById("metricCoversLabel").textContent = isGroup
    ? "group covers expected (12 sites)"
    : "covers expected tomorrow";
  document.getElementById("metricCoversSub").textContent = isGroup
    ? `likely ${(forecast.p05 * mult).toLocaleString("en-US")}–${(forecast.p95 * mult).toLocaleString("en-US")} · usually ${(forecast.habitualCovers * mult).toLocaleString("en-US")}`
    : `likely ${forecast.p05}–${forecast.p95} · usually ${forecast.habitualCovers}`;

  document.getElementById("metricOrder").textContent = `€${(totalOrder * mult).toLocaleString("en-US")}`;
  document.getElementById("metricOrderLabel").textContent = isGroup
    ? "group order total (12 sites)"
    : "tomorrow’s order total";
  document.getElementById("metricOrderSub").textContent = `instead of €${(totalHabitual * mult).toLocaleString("en-US")} usual`;

  const savedEl = document.getElementById("metricSaved");
  if (saved >= 0) {
    savedEl.className = "metric-val emerald";
    savedEl.textContent = `−€${(saved * mult).toLocaleString("en-US")}`;
    document.getElementById("metricSavedLabel").textContent = isGroup ? "saved tonight (12 sites)" : "waste avoided";
    document.getElementById("metricSavedSub").textContent = `${pct.toFixed(1)}% food spend`;
  } else {
    savedEl.className = "metric-val amber";
    savedEl.textContent = `+€${(Math.abs(saved) * mult).toLocaleString("en-US")}`;
    document.getElementById("metricSavedLabel").textContent = isGroup ? "group stockout buffer" : "stockout buffer";
    document.getElementById("metricSavedSub").textContent = `+${Math.abs(pct).toFixed(1)}% surge prep`;
  }

  // Beautiful Forecast Comparison Bar
  const minS = Math.min(forecast.p05, forecast.habitualCovers) - 35;
  const maxS = Math.max(forecast.p95, forecast.habitualCovers) + 35;
  const toPct = (v) => Math.min(96, Math.max(4, ((v - minS) / (maxS - minS)) * 100));

  const ccPct = toPct(forecast.p50);
  const habPct = toPct(forecast.habitualCovers);
  const p05Pct = toPct(forecast.p05);
  const p95Pct = toPct(forecast.p95);
  const coverDiff = forecast.p50 - forecast.habitualCovers;
  const isSurge = coverDiff > 0;

  document.getElementById("fvCcText").textContent = `${forecast.p50} covers (${forecast.p05}–${forecast.p95})`;
  document.getElementById("fvHabitText").textContent = `${forecast.habitualCovers}`;

  const gapBadge = document.getElementById("fvGapBadge");
  gapBadge.className = `fv-gap-badge ${isSurge ? "surge" : ""}`;
  gapBadge.textContent = isSurge
    ? `+${coverDiff} covers vs. usual (stockout risk)`
    : `${coverDiff} covers vs. usual (waste risk)`;

  const gapBar = document.getElementById("fvGapBar");
  gapBar.className = `fv-gap-bar ${isSurge ? "surge" : ""}`;
  gapBar.style.left = `${Math.min(ccPct, habPct)}%`;
  gapBar.style.width = `${Math.abs(habPct - ccPct)}%`;

  const ciBand = document.getElementById("fvCiBand");
  ciBand.style.left = `${p05Pct}%`;
  ciBand.style.width = `${Math.max(4, p95Pct - p05Pct)}%`;

  document.getElementById("fvCcMarker").style.left = `${ccPct}%`;
  document.getElementById("fvHabitMarker").style.left = `${habPct}%`;

  // Scannable "Why" Driver Pills + 1 Clean Sentence
  const w = WEATHER_EFFECTS[state.weather];
  const ev = EVENT_EFFECTS[state.event];
  const pills = [];
  if (forecast.bookingDelta !== 0) {
    pills.push(`<span class="why-pill ${forecast.bookingDelta > 0 ? "pos" : "neg"}">📅 Bookings ${fmtSigned(forecast.bookingDelta)}</span>`);
  }
  if (forecast.weatherDelta !== 0) {
    pills.push(`<span class="why-pill ${forecast.weatherDelta > 0 ? "pos" : "neg"}">${w.icon} ${w.pillText} ${fmtSigned(forecast.weatherDelta)}</span>`);
  }
  if (forecast.eventDelta !== 0 && ev.pillText) {
    pills.push(`<span class="why-pill ${forecast.eventDelta > 0 ? "pos" : "neg"}">${ev.icon} ${ev.pillText} ${fmtSigned(forecast.eventDelta)}</span>`);
  }
  if (state.extraCovers !== 0) {
    pills.push(`<span class="why-pill pos">🎙️ ${state.extraCoversNote || "Chef update"} ${fmtSigned(state.extraCovers)}</span>`);
  }
  document.getElementById("whyPills").innerHTML = pills.join("");

  const whySentence =
    saved >= 0
      ? `${w.phrase}${ev.phrase ? `, partly offset as ${ev.phrase}` : ""} — so CoverCast trims €${saved} of 24–48h perishables automatically.`
      : `${w.phrase}${ev.phrase ? ` while ${ev.phrase}` : ""} — so CoverCast adds +€${Math.abs(saved)} to prevent mid-service stockouts.`;
  document.getElementById("whyLine").textContent = whySentence;

  // Reflective AI Card (3 clean states: Pending Proposal [Yes/Cancel/Refine] | Applied [Undo] | Info Reflection)
  const undoBtn = document.getElementById("undoCmdBtn");
  const badgeEl = document.getElementById("aiCardBadge");
  const heardEl = document.getElementById("aiHeardQuote");
  const reflEl = document.getElementById("aiReflectionText");
  const pillsEl = document.getElementById("aiDiffPills");
  const confirmBar = document.getElementById("aiConfirmBar");
  const refineHint = document.getElementById("aiRefineHint");

  aiDiffCard.classList.remove("proposal-mode", "info-mode");

  if (state.pendingProposal) {
    const p = state.pendingProposal;
    aiDiffCard.hidden = false;
    aiDiffCard.classList.add("proposal-mode");
    badgeEl.textContent = "🧠 AI Reflection · Awaiting your OK";
    heardEl.textContent = `heard “${p.heard}”`;
    document.getElementById("aiCostMini").textContent = `$${p.costUsd.toFixed(6)}`;
    reflEl.textContent = p.reflection;
    pillsEl.innerHTML = p.diffPills.map((txt) => `<span class="diff-pill">${txt}</span>`).join("");
    undoBtn.hidden = true;
    confirmBar.hidden = false;
    refineHint.hidden = false;
  } else if (state.lastApplied) {
    const a = state.lastApplied;
    aiDiffCard.hidden = false;
    badgeEl.textContent = "✓ Confirmed & Applied";
    heardEl.textContent = `from “${a.heard}”`;
    document.getElementById("aiCostMini").textContent = `$${a.costUsd.toFixed(6)}`;
    reflEl.textContent = a.reflection;
    pillsEl.innerHTML = a.diffPills.map((txt) => `<span class="diff-pill">${txt}</span>`).join("");
    undoBtn.hidden = state.historyStack.length === 0;
    confirmBar.hidden = true;
    refineHint.hidden = true;
  } else if (state.lastInfo) {
    aiDiffCard.hidden = false;
    aiDiffCard.classList.add("info-mode");
    badgeEl.textContent = "🧠 AI Reflection · No changes proposed";
    heardEl.textContent = state.lastInfo.heard ? `heard “${state.lastInfo.heard}”` : "";
    document.getElementById("aiCostMini").textContent = "$0.000345";
    reflEl.textContent = state.lastInfo.reflection;
    pillsEl.innerHTML = "";
    undoBtn.hidden = true;
    confirmBar.hidden = true;
    refineHint.hidden = true;
  } else {
    aiDiffCard.hidden = true;
  }

  // Clear 6-Row Shopping List
  const hasChanges =
    state.historyStack.length > 0 ||
    Object.values(state.overrides).some((v) => v !== 0);
  resetOrderBtn.hidden = !hasChanges;

  const rowsEl = document.getElementById("orderRows");
  rowsEl.innerHTML = lines
    .map((line) => {
      const aiNote = state.aiRowNotes[line.id];
      const deltaClass = line.deltaEur < 0 ? "save" : line.deltaEur > 0 ? "up" : "flat";
      const savingsLabel =
        line.deltaEur < 0
          ? `saves €${Math.abs(line.deltaEur)}`
          : line.deltaEur > 0
          ? `+€${line.deltaEur} vs usual`
          : "same as usual";

      return `
      <div class="order-row ${aiNote ? "ai-changed" : ""}">
        <div>
          <div class="row-item-name">${line.name}</div>
          <div class="row-item-sub">${line.supplier} · €${line.unitPrice}/${line.unit}</div>
          ${aiNote ? `<div class="row-ai-badge">✦ ${aiNote}</div>` : ""}
        </div>

        <div class="row-fridge">
          ${line.stock.toFixed(1)} ${line.unit}
          <span class="row-fridge-sub">est. on hand</span>
        </div>

        <div class="row-qty-cell">
          <div class="stepper">
            <button type="button" class="step-btn" data-step="-1" data-sku="${line.id}" aria-label="Decrease">−</button>
            <span class="step-qty">${line.finalQty} ${line.unit}</span>
            <button type="button" class="step-btn" data-step="1" data-sku="${line.id}" aria-label="Increase">+</button>
          </div>
          <span class="usual-hint">usual: ${line.habitualQty} ${line.unit}</span>
        </div>

        <div class="row-money">
          <div class="row-total-main">€${line.lineEur}</div>
          <div class="row-savings-sub ${deltaClass}">${savingsLabel}</div>
        </div>
      </div>
    `;
    })
    .join("");

  rowsEl.querySelectorAll("button[data-sku]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.sku;
      state.overrides[id] = (state.overrides[id] || 0) + parseInt(btn.dataset.step, 10);
      render();
    });
  });

  // Big Green Button
  const vendorCount = new Set(lines.filter((l) => l.finalQty > 0).map((l) => l.supplier)).size;
  document.getElementById("sendOrderBtn").innerHTML =
    `Draft &amp; Send ${vendorCount} Supplier Emails · <span id="sendTotalSpan">€${totalOrder}</span>`;

  sendFooter.hidden = state.sent;
  sentCard.hidden = !state.sent;
  if (state.sent) renderSentEmails(forecast, lines, totalOrder, saved);
}

// Snapshot helpers (works on both live state and proposed draft state)
function captureSnapshot(src = state) {
  return {
    day: src.day,
    bookings: src.bookings,
    weather: src.weather,
    event: src.event,
    extraCovers: src.extraCovers,
    extraCoversNote: src.extraCoversNote,
    stocks: { ...src.stocks },
    skus: src.skus.map((s) => ({ ...s })),
    overrides: { ...src.overrides }
  };
}

function computeForecastFor(s) {
  const prof = DAY_PROFILES[s.day];
  const weather = WEATHER_EFFECTS[s.weather];
  const ev = EVENT_EFFECTS[s.event];
  const bookingDelta = Math.round(s.bookings - prof.expectedBookings);
  const weatherDelta = Math.round(prof.baseCovers * weather.factor);
  const eventDelta = ev.coversDelta;
  const p50 = Math.max(60, prof.baseCovers + bookingDelta + weatherDelta + eventDelta + s.extraCovers);
  const halfWidth = prof.ciBase + weather.ciAdd + ev.ciAdd;
  return { p50, p05: Math.max(45, p50 - halfWidth), p95: p50 + halfWidth, habitualCovers: prof.habitualCovers };
}

function computeLinesFor(s, forecast) {
  const habitualScale = forecast.habitualCovers / DAY_PROFILES.saturday.habitualCovers;
  return s.skus.map((sku) => {
    const grossNeed = Number((forecast.p50 * sku.ratePerCover).toFixed(1));
    const stock = s.stocks[sku.id] ?? sku.defaultStock;
    const recQty = Math.max(0, Math.ceil(Number((grossNeed - stock).toFixed(2))));
    const overrideDelta = s.overrides[sku.id] || 0;
    const finalQty = Math.max(0, recQty + overrideDelta);
    const habitualQty = s.day === "saturday" ? sku.habitualSat : Math.max(1, Math.round(sku.habitualSat * habitualScale));
    const lineEur = finalQty * sku.unitPrice;
    return { ...sku, stock, recQty, finalQty, habitualQty, lineEur };
  });
}

const SKU_KEYWORDS = [
  { id: "cod",      keys: ["cod", "cabillaud", "fish", "poisson", "sea bass", "bar", "salmon", "saumon"] },
  { id: "bavette",  keys: ["bavette", "beef", "steak", "boeuf", "bœuf", "meat", "viande"] },
  { id: "buns",     keys: ["bun", "buns", "brioche", "bread", "pain", "burger"] },
  { id: "mesclun",  keys: ["salad", "salade", "green", "greens", "mesclun", "lettuce"] },
  { id: "cream",    keys: ["cream", "crème", "creme", "dairy"] },
  { id: "tomatoes", keys: ["tomato", "tomatoes", "tomate", "tomates", "herb", "herbs", "herbes"] }
];

function findMentionedSkus(text) {
  return SKU_KEYWORDS.filter((item) => item.keys.some((k) => text.includes(k))).map((i) => i.id);
}

// Builds a non-destructive DRAFT proposal on top of a base snapshot (never mutates live order until Chef says YES!)
function buildReflectiveProposal(rawText) {
  const t = rawText.toLowerCase().trim();

  // Conversational confirmation / cancel when a proposal is already open
  if (state.pendingProposal) {
    if (/^(yes|yeah|yep|ok|okay|sure|apply|confirm|do it|go ahead|oui|ouais|d'accord|vas-y|valide|applique)\b/.test(t)) {
      return { action: "confirm-yes" };
    }
    if (/^(no|nope|cancel|stop|nevermind|forget it|non|annule|annuler|laisse tomber)\b/.test(t) && t.split(/\s+/).length <= 3) {
      return { action: "confirm-cancel" };
    }
  }

  if (/^(undo|annule|annuler|revert)\b/.test(t)) return { action: "undo" };
  if (/^(reset|réinitialise|remettre)\b/.test(t)) return { action: "reset" };
  if (/\b(send order|send email|approve order|envoie|envoyer la commande)\b/.test(t)) return { action: "send" };

  // Start from current pending draft if refining, otherwise from current live order
  const liveSnapshot = captureSnapshot(state);
  const draft = state.pendingProposal ? captureSnapshot(state.pendingProposal.draftState) : captureSnapshot(state);
  const baseForecast = computeForecastFor(liveSnapshot);
  const baseLines = computeLinesFor(liveSnapshot, baseForecast);
  const curDraftForecast = computeForecastFor(draft);
  const curDraftLines = computeLinesFor(draft, curDraftForecast);

  let matched = false;
  const reasoningParts = [];

  // 1. Keep / exclude an item during refinement ("keep cod at 8", "don't change cod", "leave bavette")
  const mentionedSkus = findMentionedSkus(t);
  if (state.pendingProposal && mentionedSkus.length > 0 && /\b(keep|leave|don'?t change|garder|garde|laisse|touche pas)\b/.test(t)) {
    const exactNum = t.match(/\b(\d{1,2})\b/);
    mentionedSkus.forEach((id) => {
      const liveLine = baseLines.find((l) => l.id === id);
      const draftLine = curDraftLines.find((l) => l.id === id);
      if (liveLine && draftLine) {
        const target = exactNum ? parseInt(exactNum[1], 10) : liveLine.finalQty;
        draft.overrides[id] = target - draftLine.recQty;
        matched = true;
        reasoningParts.push(`keeping ${liveLine.name.split(" ")[1] || id} locked at ${target} ${liveLine.unit} as requested`);
      }
    });
  }

  // 2. Fish / Cod swap -> Sea Bass or Salmon
  if (
    !matched &&
    (t.includes("cod") || t.includes("cabillaud") || t.includes("fish") || t.includes("poisson")) &&
    (t.includes("sea bass") || t.includes("bar") || t.includes("salmon") || t.includes("saumon") || t.includes("swap") || t.includes("replace") || t.includes("remplace") || t.includes("out of") || t.includes("plus de"))
  ) {
    const isSalmon = t.includes("salmon") || t.includes("saumon");
    const codSku = draft.skus.find((s) => s.id === "cod");
    if (codSku) {
      codSku.name = isSalmon ? "Fresh Scottish Salmon Fillet" : "Wild Sea Bass Fillet (Bar de ligne)";
      codSku.unitPrice = isSalmon ? 21 : 23;
      draft.stocks.cod = 0;
      matched = true;
      reasoningParts.push(`swapping Cod for ${codSku.name} (€${codSku.unitPrice}/kg) and zeroing old Cod fridge stock`);
    }
  }

  // 3. Group booking / refinement ("make it 15 people", "group of 25", "15 cancelled")
  const cancelMatch = t.match(/(?:cancel\w*|annul\w*|drop|lost)\s*(?:of|for|de|pour)?\s*(\d{1,3})\b/) ||
                      t.match(/\b(\d{1,3})\s*(?:people|guests|covers|couverts|personnes|pax)\s*(?:cancel\w*|annul\w*)/);
  const refineGroupMatch = state.pendingProposal && t.match(/(?:make it|instead|plutôt|actually)\s*(?:of|for)?\s*(\d{1,3})\b/);
  const groupMatch = t.match(/(?:group|party|table|birthday|anniversaire|groupe|extra|booked|réserv\w*)\s*(?:of|for|de|pour)?\s*(\d{1,3})\b/) ||
                     t.match(/(?:\+|add|plus)\s*(\d{1,3})\s*(?:people|guests|covers|couverts|personnes|pax)\b/) ||
                     t.match(/\b(\d{1,3})\s*(?:more|extra)?\s*(?:people|guests|covers|couverts|personnes|pax)\b/);

  if (!matched && cancelMatch && !/\b(kg|kilo|l|liter|litre|tray)\b/.test(t)) {
    const n = Math.min(120, Math.max(2, parseInt(cancelMatch[1], 10)));
    draft.extraCovers = liveSnapshot.extraCovers - n;
    draft.extraCoversNote = "Group cancellation";
    matched = true;
    reasoningParts.push(`removing ${n} cancelled covers so we trim extra perishables before midnight`);
  } else if (!matched && refineGroupMatch && !/\b(kg|kilo|l|liter|litre|tray)\b/.test(t)) {
    const n = Math.min(120, Math.max(2, parseInt(refineGroupMatch[1], 10)));
    draft.extraCovers = liveSnapshot.extraCovers + n;
    draft.extraCoversNote = `Adjusted group (+${n})`;
    matched = true;
    reasoningParts.push(`adjusting the proposed group size to +${n} covers instead`);
  } else if (!matched && groupMatch && !/\b(kg|kilo|l|liter|litre|tray)\b/.test(t)) {
    const n = Math.min(120, Math.max(2, parseInt(groupMatch[1], 10)));
    draft.extraCovers = (state.pendingProposal ? draft.extraCovers : liveSnapshot.extraCovers) + n;
    draft.extraCoversNote = "Group booking";
    matched = true;
    reasoningParts.push(`adding +${n} covers to tomorrow’s forecast and scaling perishable packs proportionally`);
  }

  // 4. Fridge stock updates
  const isFridgeMention = /\b(fridge|frigo|stock|left|reste|empty|vide|threw|spoiled|jeté|out of|plus de|no |zero|0\s*kg)\b/.test(t);
  if (mentionedSkus.length > 0 && isFridgeMention && !matched) {
    const exactStockNum = t.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|kilo|l|liter|litre|trays?)\b/);
    const setZero = /\b(empty|vide|threw|spoiled|jeté|out of|plus de|no |zero)\b/.test(t) || (exactStockNum && parseFloat(exactStockNum[1]) === 0);
    mentionedSkus.forEach((id) => {
      if (setZero) {
        draft.stocks[id] = 0;
        matched = true;
        reasoningParts.push(`setting ${id} fridge stock to 0 and adding replacement quantity`);
      } else if (exactStockNum) {
        draft.stocks[id] = Math.max(0, parseFloat(exactStockNum[1]));
        matched = true;
        reasoningParts.push(`updating ${id} fridge stock to ${exactStockNum[1]}`);
      }
    });
  }

  // 5. Direct item quantity edits
  if (mentionedSkus.length > 0 && !matched) {
    const removeIntent = /\b(remove|delete|skip|don'?t order|pas de|enlève|supprime)\b/.test(t);
    const minusIntent = /\b(cut|less|minus|reduce|decrease|drop|baisse|moins|-)\b/.test(t);
    const plusIntent = /\b(add|more|plus|extra|increase|bump|ajoute|\+)\b/.test(t);
    const setOrderIntent = /\b(order|set|make|put|commande|mets)\s*(\d{1,2})\b/.test(t);
    const numMatch = t.match(/\b(\d{1,2})\b/);

    mentionedSkus.forEach((id) => {
      const curLine = curDraftLines.find((l) => l.id === id);
      if (!curLine) return;
      if (removeIntent) {
        draft.overrides[id] = -curLine.recQty;
        matched = true;
        reasoningParts.push(`removing ${curLine.name.split(" ")[1] || id} from tomorrow’s order`);
      } else if (setOrderIntent && numMatch) {
        const target = parseInt(numMatch[1], 10);
        draft.overrides[id] = target - curLine.recQty;
        matched = true;
        reasoningParts.push(`setting ${curLine.name.split(" ")[1] || id} order to ${target} ${curLine.unit}`);
      } else if (minusIntent) {
        const amt = numMatch ? parseInt(numMatch[1], 10) : 2;
        draft.overrides[id] = (draft.overrides[id] || 0) - amt;
        matched = true;
        reasoningParts.push(`cutting ${amt} ${curLine.unit} of ${curLine.name.split(" ")[1] || id}`);
      } else if (plusIntent) {
        const amt = numMatch ? parseInt(numMatch[1], 10) : 2;
        draft.overrides[id] = (draft.overrides[id] || 0) + amt;
        matched = true;
        reasoningParts.push(`adding +${amt} ${curLine.unit} of ${curLine.name.split(" ")[1] || id}`);
      }
    });
  }

  // 6. Weather change
  if (!matched && /\b(sunny|clear|warm|no rain|soleil|beau temps)\b/.test(t)) {
    draft.weather = "sunny";
    matched = true;
    reasoningParts.push("switching tomorrow’s forecast to sunny terrace weather (+14% walk-ins)");
  } else if (!matched && /\b(heavy rain|storm|pouring|grosse pluie|orage)\b/.test(t)) {
    draft.weather = "heavy_rain";
    matched = true;
    reasoningParts.push("switching forecast to heavy rain (terrace closed, −24% walk-ins)");
  } else if (!matched && /\b(light rain|drizzle|showers|pluie légère)\b/.test(t)) {
    draft.weather = "light_rain";
    matched = true;
    reasoningParts.push("switching forecast to light evening showers (−10% walk-ins)");
  } else if (!matched && /\b(cloudy|overcast|nuageux)\b/.test(t)) {
    draft.weather = "cloudy";
    matched = true;
    reasoningParts.push("switching forecast to mild overcast baseline");
  }

  // If unclear or greeting -> reflect clearly without modifying anything!
  if (!matched) {
    const curTotal = baseLines.reduce((s, l) => s + l.lineEur, 0);
    const isGreeting = /^(hi|hello|hey|bonjour|salut|coucou|test|yo|merci|thanks)\b/.test(t);
    return {
      action: "info",
      heard: rawText,
      reflection: isGreeting
        ? `Hi Chef Karim! Tomorrow’s €${curTotal} order is ready for review. Tell me if anything changed tonight—like an extra group booking, a supplier item swap, a fridge stock update, or a weather shift—and I’ll propose the exact adjustments for your approval.`
        : `I thought about “${rawText}”, and I don’t see a specific cover, fridge, or ingredient change to propose yet—so your €${curTotal} order is untouched. Tell me what you’d like adjusted (e.g., “group of 25 just booked”, “add 2 kg bavette”, or “swap cod to sea bass”) and I’ll draft the update for your yes/no.`
    };
  }

  // Build transparent proposal diff (live vs. proposed draft)
  const nextForecast = computeForecastFor(draft);
  const nextLines = computeLinesFor(draft, nextForecast);
  const diffPills = [];
  const rowNotes = {};

  if (nextForecast.p50 !== baseForecast.p50) {
    diffPills.push(`Covers: ${baseForecast.p50} → ${nextForecast.p50} (${fmtSigned(nextForecast.p50 - baseForecast.p50)})`);
  }

  nextLines.forEach((nl, idx) => {
    const bl = baseLines[idx];
    const parts = [];
    if (nl.name !== bl.name) {
      parts.push(`Swapped → ${nl.name.split(" ").slice(0, 3).join(" ")} (€${nl.unitPrice}/${nl.unit})`);
      diffPills.push(`Item: Cod → ${nl.name.split(" ").slice(0, 3).join(" ")}`);
    }
    if (nl.stock !== bl.stock) {
      parts.push(`Fridge ${bl.stock.toFixed(1)} → ${nl.stock.toFixed(1)} ${nl.unit}`);
    }
    if (nl.finalQty !== bl.finalQty) {
      parts.push(`Qty ${bl.finalQty} → ${nl.finalQty} ${nl.unit}`);
      diffPills.push(`${nl.name.split(" ")[1] || nl.name}: ${bl.finalQty} → ${nl.finalQty} ${nl.unit}`);
    }
    if (parts.length > 0) rowNotes[nl.id] = parts.join(" · ");
  });

  const baseEur = baseLines.reduce((s, l) => s + l.lineEur, 0);
  const nextEur = nextLines.reduce((s, l) => s + l.lineEur, 0);
  if (nextEur !== baseEur) {
    diffPills.push(`Total: €${baseEur} → €${nextEur} (${fmtSigned(nextEur - baseEur)}€)`);
  }

  if (diffPills.length === 0) {
    return {
      action: "info",
      heard: rawText,
      reflection: `I checked “${rawText}” against your current order and the quantities already match—nothing needs to change.`
    };
  }

  const combinedHeard = state.pendingProposal
    ? `${state.pendingProposal.heard} + ${rawText}`
    : rawText;

  return {
    action: "propose",
    proposal: {
      draftState: draft,
      heard: combinedHeard,
      reflection: `Based on your note, I recommend ${reasoningParts.join(" and ")}. Here is the exact impact before anything changes:`,
      diffPills,
      rowNotes,
      costUsd: 0.000345
    }
  };
}

function commitPendingProposal() {
  const p = state.pendingProposal;
  if (!p) return;
  state.historyStack.push(captureSnapshot(state));
  Object.assign(state, captureSnapshot(p.draftState));
  state.aiRowNotes = p.rowNotes;
  state.lastApplied = {
    heard: p.heard,
    reflection: p.reflection.replace("I recommend", "Applied:"),
    diffPills: p.diffPills,
    costUsd: p.costUsd
  };
  state.pendingProposal = null;
  state.lastInfo = null;
  state.sent = false;
  daySelect.value = state.day;
  bookingsRange.value = state.bookings;
  weatherSelect.value = state.weather;
  eventSelect.value = state.event;
  renderFridgeDrawer();
  render();
}

function cancelPendingProposal() {
  if (!state.pendingProposal) return;
  const cancelledHeard = state.pendingProposal.heard;
  state.pendingProposal = null;
  state.lastInfo = {
    heard: cancelledHeard,
    reflection: "Cancelled — no changes were applied to tomorrow’s order."
  };
  render();
}

// Pricing per 1M tokens (USD) for live cost telemetry display
const CLAUDE_PRICING = {
  "claude-haiku-5-5":  { inPerM: 0.80,  outPerM: 4.00,  label: "Haiku 5.5" },
  "claude-sonnet-5-5": { inPerM: 3.00,  outPerM: 15.00, label: "Sonnet 5.5" },
  "claude-opus-5-5":   { inPerM: 15.00, outPerM: 75.00, label: "Opus 5.5" },
  "claude-fable-5-2":  { inPerM: 15.00, outPerM: 75.00, label: "Fable 5.2" }
};

function getClaudeShortLabel(modelId) {
  return CLAUDE_PRICING[modelId]?.label || modelId;
}

function updateClaudeBadgeUI() {
  const btn = document.getElementById("claudeConfigBtn");
  const txt = document.getElementById("claudeStatusText");
  if (state.claudeApiKey) {
    btn.classList.add("connected");
    txt.textContent = `Claude ${getClaudeShortLabel(state.claudeModel)} · Live`;
  } else {
    btn.classList.remove("connected");
    txt.textContent = "Claude API · Connect";
  }
}

// Direct Browser Call to Anthropic Messages API (Works natively on GitHub Pages via official CORS header!)
async function callClaudeLive(rawText) {
  const liveSnapshot = captureSnapshot(state);
  const draftBase = state.pendingProposal ? captureSnapshot(state.pendingProposal.draftState) : captureSnapshot(state);
  const baseForecast = computeForecastFor(liveSnapshot);
  const baseLines = computeLinesFor(liveSnapshot, baseForecast);
  const curDraftForecast = computeForecastFor(draftBase);
  const curDraftLines = computeLinesFor(draftBase, curDraftForecast);

  const systemPrompt = `You are CoverCast, a calm, hyper-practical kitchen order copilot for Head Chef Karim at Bistrot Urbain #04 (Montparnasse, Paris).
CRITICAL RULES:
1. NEVER do order total arithmetic — our deterministic engine computes exact quantities and euros from your structured mutation.
2. NEVER make random changes on greetings ("Hi", "Bonjour") or unclear comments — return action "info" with a warm, brief reply instead.
3. If there is a pendingProposal open:
   - If the chef confirms ("yes", "oui", "apply", "ok"), return action "confirm-yes".
   - If the chef cancels ("no", "cancel", "non"), return action "confirm-cancel".
   - If the chef refines it ("keep cod at 8 kg", "make it 15 people instead"), return action "propose" with the adjusted mutation.
4. Valid SKU ids: "cod", "bavette", "buns", "mesclun", "cream", "tomatoes".
5. Valid weather values: "heavy_rain", "light_rain", "cloudy", "sunny".
6. Respond with STRICT JSON ONLY (no markdown fences):
{
  "action": "propose | info | confirm-yes | confirm-cancel | undo | reset | send",
  "reflection": "1-2 crisp sentences of transparent kitchen reasoning",
  "mutation": {
    "coverDelta": 0,
    "coverReason": "",
    "weather": null,
    "skuEdits": [
      { "id": "cod", "newName": null, "newUnitPrice": null, "setStock": null, "qtyDelta": 0, "setQty": null }
    ]
  }
}`;

  const userPayload = {
    chefMessage: rawText,
    hasPendingProposal: Boolean(state.pendingProposal),
    pendingProposalSummary: state.pendingProposal ? state.pendingProposal.diffPills : [],
    currentForecast: { covers: curDraftForecast.p50, weather: draftBase.weather, day: draftBase.day, bookings: draftBase.bookings },
    currentOrderLines: curDraftLines.map((l) => ({
      id: l.id, name: l.name, unit: l.unit, unitPrice: l.unitPrice, fridgeStock: l.stock, currentQty: l.finalQty, usualQty: l.habitualQty
    }))
  };

  const t0 = Date.now();
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": state.claudeApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: state.claudeModel,
      max_tokens: 550,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: "user", content: JSON.stringify(userPayload) }]
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${errText.slice(0, 140)}`);
  }

  const data = await resp.json();
  const inTok = data.usage?.input_tokens || 650;
  const outTok = data.usage?.output_tokens || 160;
  const rate = CLAUDE_PRICING[state.claudeModel] || { inPerM: 3.0, outPerM: 15.0 };
  const costUsd = Number(((inTok * rate.inPerM + outTok * rate.outPerM) / 1_000_000).toFixed(6));

  const rawContent = data.content?.find((c) => c.type === "text")?.text || "{}";
  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);

  if (parsed.action !== "propose") {
    return {
      action: parsed.action || "info",
      heard: rawText,
      reflection: parsed.reflection || "No order changes proposed.",
      costUsd,
      modelUsed: getClaudeShortLabel(state.claudeModel),
      latencyMs: Date.now() - t0
    };
  }

  // Apply Claude's structured mutation onto a non-destructive DRAFT snapshot
  const draft = captureSnapshot(draftBase);
  const m = parsed.mutation || {};
  if (typeof m.coverDelta === "number" && m.coverDelta !== 0) {
    draft.extraCovers += Math.round(m.coverDelta);
    draft.extraCoversNote = m.coverReason || "Claude update";
  }
  if (m.weather && WEATHER_EFFECTS[m.weather]) {
    draft.weather = m.weather;
  }

  // Precompute draft lines after cover/weather shift so setQty is exact
  const midForecast = computeForecastFor(draft);
  const midLines = computeLinesFor(draft, midForecast);

  if (Array.isArray(m.skuEdits)) {
    m.skuEdits.forEach((ed) => {
      const sku = draft.skus.find((s) => s.id === ed.id);
      if (!sku) return;
      if (ed.newName) sku.name = ed.newName;
      if (typeof ed.newUnitPrice === "number" && ed.newUnitPrice > 0) sku.unitPrice = ed.newUnitPrice;
      if (typeof ed.setStock === "number") draft.stocks[ed.id] = Math.max(0, ed.setStock);
    });
  }

  // Recompute recQty after stock changes, then apply qtyDelta / setQty
  const postStockForecast = computeForecastFor(draft);
  const postStockLines = computeLinesFor(draft, postStockForecast);
  if (Array.isArray(m.skuEdits)) {
    m.skuEdits.forEach((ed) => {
      const line = postStockLines.find((l) => l.id === ed.id) || midLines.find((l) => l.id === ed.id);
      if (!line) return;
      if (typeof ed.setQty === "number") {
        draft.overrides[ed.id] = Math.max(0, Math.round(ed.setQty)) - line.recQty;
      } else if (typeof ed.qtyDelta === "number" && ed.qtyDelta !== 0) {
        draft.overrides[ed.id] = (draft.overrides[ed.id] || 0) + Math.round(ed.qtyDelta);
      }
    });
  }

  // Build exact before -> after diff vs live order
  const nextForecast = computeForecastFor(draft);
  const nextLines = computeLinesFor(draft, nextForecast);
  const diffPills = [];
  const rowNotes = {};

  if (nextForecast.p50 !== baseForecast.p50) {
    diffPills.push(`Covers: ${baseForecast.p50} → ${nextForecast.p50} (${fmtSigned(nextForecast.p50 - baseForecast.p50)})`);
  }
  nextLines.forEach((nl, idx) => {
    const bl = baseLines[idx];
    const parts = [];
    if (nl.name !== bl.name) {
      parts.push(`Swapped → ${nl.name.split(" ").slice(0, 3).join(" ")} (€${nl.unitPrice}/${nl.unit})`);
      diffPills.push(`Item: ${bl.name.split(" ")[1] || bl.id} → ${nl.name.split(" ").slice(0, 3).join(" ")}`);
    }
    if (nl.stock !== bl.stock) parts.push(`Fridge ${bl.stock.toFixed(1)} → ${nl.stock.toFixed(1)} ${nl.unit}`);
    if (nl.finalQty !== bl.finalQty) {
      parts.push(`Qty ${bl.finalQty} → ${nl.finalQty} ${nl.unit}`);
      diffPills.push(`${nl.name.split(" ")[1] || nl.name}: ${bl.finalQty} → ${nl.finalQty} ${nl.unit}`);
    }
    if (parts.length > 0) rowNotes[nl.id] = parts.join(" · ");
  });

  const baseEur = baseLines.reduce((s, l) => s + l.lineEur, 0);
  const nextEur = nextLines.reduce((s, l) => s + l.lineEur, 0);
  if (nextEur !== baseEur) diffPills.push(`Total: €${baseEur} → €${nextEur} (${fmtSigned(nextEur - baseEur)}€)`);

  if (diffPills.length === 0) {
    return {
      action: "info",
      heard: rawText,
      reflection: parsed.reflection || "Checked your note — current quantities already match.",
      costUsd
    };
  }

  const combinedHeard = state.pendingProposal ? `${state.pendingProposal.heard} + ${rawText}` : rawText;
  return {
    action: "propose",
    proposal: {
      draftState: draft,
      heard: combinedHeard,
      reflection: `[Claude ${getClaudeShortLabel(state.claudeModel)} · ${inTok + outTok} tok] ${parsed.reflection}`,
      diffPills,
      rowNotes,
      costUsd
    }
  };
}

async function handleChefCommand(rawText) {
  const cmd = rawText.trim();
  if (!cmd) return;

  const btn = document.getElementById("commandSubmitBtn");
  btn.disabled = true;
  btn.textContent = state.claudeApiKey ? `Claude…` : "Thinking…";

  let res;
  if (state.claudeApiKey) {
    try {
      res = await callClaudeLive(cmd);
    } catch (err) {
      // Graceful fallback to built-in reflective engine + visible note
      res = buildReflectiveProposal(cmd);
      if (res.proposal) {
        res.proposal.reflection = `(Claude API error — used local fallback: ${err.message}) ` + res.proposal.reflection;
      } else if (res.reflection) {
        res.reflection = `(Claude API error: ${err.message}) ` + res.reflection;
      }
    }
  } else {
    await new Promise((r) => setTimeout(r, 240));
    res = buildReflectiveProposal(cmd);
  }

  if (res.action === "confirm-yes") {
    commitPendingProposal();
  } else if (res.action === "confirm-cancel") {
    cancelPendingProposal();
  } else if (res.action === "undo") {
    const snap = state.historyStack.pop();
    if (snap) {
      Object.assign(state, snap);
      state.aiRowNotes = {};
      state.lastApplied = null;
      state.pendingProposal = null;
      state.lastInfo = { heard: cmd, reflection: "Reverted your last confirmed AI change." };
      daySelect.value = state.day;
      bookingsRange.value = state.bookings;
      weatherSelect.value = state.weather;
      eventSelect.value = state.event;
      renderFridgeDrawer();
      render();
    } else {
      state.lastInfo = { heard: cmd, reflection: "Nothing to undo — you’re already on the baseline order." };
      render();
    }
  } else if (res.action === "reset") {
    applyPreset(state.preset);
  } else if (res.action === "send") {
    state.pendingProposal = null;
    state.sent = true;
    render();
  } else if (res.action === "propose") {
    state.pendingProposal = res.proposal;
    state.lastInfo = null;
    state.lastApplied = null;
    render();
  } else if (res.action === "info") {
    if (!state.pendingProposal) {
      state.lastApplied = null;
      state.lastInfo = { heard: res.heard, reflection: res.reflection };
    } else {
      state.pendingProposal.reflection = `${res.reflection} (Your pending proposal below is still waiting—say “yes” to apply, “cancel” to discard, or specify a tweak.)`;
    }
    render();
  }

  document.getElementById("commandInput").value = "";
  btn.disabled = false;
  btn.textContent = "Apply";
}

// Drafted & Sent Supplier Emails (with real mailto: launcher!)
function renderSentEmails(forecast, lines, totalOrder, saved) {
  const byVendor = {};
  lines
    .filter((l) => l.finalQty > 0)
    .forEach((l) => {
      if (!byVendor[l.supplier]) byVendor[l.supplier] = [];
      byVendor[l.supplier].push(l);
    });
  const vendors = Object.keys(byVendor);
  if (!state.activeVendor || !byVendor[state.activeVendor]) {
    state.activeVendor = vendors[0] || "";
  }

  const elapsed = Math.max(15, Math.round((Date.now() - state.startTime) / 1000));
  const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  document.getElementById("sentTitle").textContent = `${vendors.length} supplier emails drafted & sent (€${totalOrder})`;
  document.getElementById("sentSubtitle").textContent =
    saved >= 0
      ? `Approved by Chef Karim at ${nowStr} (${elapsed}s) · €${saved} waste avoided tonight`
      : `Approved by Chef Karim at ${nowStr} (${elapsed}s) · +€${Math.abs(saved)} surge buffer included`;

  const tabsEl = document.getElementById("vendorTabs");
  tabsEl.innerHTML = vendors
    .map(
      (v) =>
        `<button type="button" class="vendor-tab ${v === state.activeVendor ? "active" : ""}" data-vendor="${v}">
          <span class="sent-dot">●</span> ${v}
        </button>`
    )
    .join("");

  tabsEl.querySelectorAll("button[data-vendor]").forEach((b) => {
    b.addEventListener("click", () => {
      state.activeVendor = b.dataset.vendor;
      renderSentEmails(forecast, lines, totalOrder, saved);
    });
  });

  const items = byVendor[state.activeVendor] || [];
  const sub = items.reduce((s, i) => s + i.lineEur, 0);
  const vendorEmail = VENDOR_EMAILS[state.activeVendor] || "orders@supplier.fr";
  const subject = `Order for ${forecast.dayLabel} 06:00 delivery — Bistrot Urbain #04 Montparnasse`;
  const msgLines = items.map((i) => `  • ${i.finalQty} ${i.unit} — ${i.name} (€${i.lineEur})`).join("\n");
  const body = `Bonjour ${state.activeVendor},

Please confirm our fresh delivery for tomorrow (${forecast.dayLabel}, 06:00 slot):

${msgLines}

Estimated total: €${sub}
Approved by Chef Karim via CoverCast (${nowStr}).`;

  document.getElementById("emailToField").textContent = vendorEmail;
  document.getElementById("emailSubjectField").textContent = subject;
  document.getElementById("vendorMessagePreview").textContent = body;

  // Wire real mailto: link so clicking opens user's actual email client pre-filled!
  document.getElementById("mailtoLinkBtn").href =
    `mailto:${encodeURIComponent(vendorEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  state.preset = name;
  state.liveWeatherBanner = "";
  state.day = p.day;
  state.bookings = p.bookings;
  state.weather = p.weather;
  state.event = p.event;
  state.extraCovers = 0;
  state.extraCoversNote = "";
  state.stocks = { ...p.stocks };
  state.skus = cloneBaseSkus();
  state.overrides = {};
  state.historyStack = [];
  state.aiRowNotes = {};
  state.pendingProposal = null;
  state.lastApplied = null;
  state.lastInfo = null;
  state.sent = false;

  daySelect.value = state.day;
  bookingsRange.value = state.bookings;
  weatherSelect.value = state.weather;
  eventSelect.value = state.event;

  renderFridgeDrawer();
  render();
}

// WOW #1: Real Live Paris 15e Tomorrow Weather via Free Keyless Open-Meteo API
async function fetchLiveParisWeather() {
  const liveBtn = document.getElementById("liveParisBtn");
  liveBtn.textContent = "🌐 Fetching…";
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=48.842&longitude=2.300&daily=temperature_2m_max,precipitation_sum&timezone=Europe%2FParis&forecast_days=2";
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Weather fetch failed");
    const data = await resp.json();
    const tempMax = Math.round(data.daily?.temperature_2m_max?.[1] ?? 14);
    const rainMm = Number((data.daily?.precipitation_sum?.[1] ?? 0).toFixed(1));

    // Map real tomorrow day-of-week & weather into CoverCast model
    const tomorrow = new Date(Date.now() + 86400000);
    const dayMap = ["saturday", "tuesday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    state.day = dayMap[tomorrow.getDay()] || "saturday";
    state.bookings = DAY_PROFILES[state.day].expectedBookings + 8;
    state.event = "none";
    state.extraCovers = 0;
    state.extraCoversNote = "";
    state.overrides = {};
    state.aiRowNotes = {};
    state.pendingProposal = null;
    state.lastApplied = null;
    state.lastInfo = null;

    if (rainMm >= 6) state.weather = "heavy_rain";
    else if (rainMm >= 1) state.weather = "light_rain";
    else if (tempMax >= 19) state.weather = "sunny";
    else state.weather = "cloudy";

    state.liveWeatherBanner = `🌐 Live Open-Meteo Paris 15e (${tempMax}°C · ${rainMm}mm rain)`;
    daySelect.value = state.day;
    bookingsRange.value = state.bookings;
    weatherSelect.value = state.weather;
    eventSelect.value = state.event;
    renderFridgeDrawer();
    render();
    liveBtn.textContent = `🌐 Paris ${tempMax}°C`;
  } catch {
    state.liveWeatherBanner = "🌐 Live Paris Weather unavailable offline";
    liveBtn.textContent = "🌐 Live Paris";
    render();
  }
}

// Event Listeners
document.querySelectorAll(".preset-tab[data-preset]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".preset-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("liveParisBtn").textContent = "🌐 Live Paris";
    applyPreset(tab.dataset.preset);
  });
});

document.getElementById("liveParisBtn").addEventListener("click", () => {
  document.querySelectorAll(".preset-tab").forEach((t) => t.classList.remove("active"));
  document.getElementById("liveParisBtn").classList.add("active");
  fetchLiveParisWeather();
});

// WOW #2: 1 Site <-> 12 Sites (Group CFO) Toggle
document.querySelectorAll(".scope-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".scope-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.scopeMultiplier = parseInt(btn.dataset.scope, 10) || 1;
    render();
  });
});

// WOW #3: Closed-Loop Yesterday's Scorecard Toggle
const scorecardDrawer = document.getElementById("scorecardDrawer");
document.getElementById("toggleScorecardBtn").addEventListener("click", () => {
  scorecardDrawer.hidden = !scorecardDrawer.hidden;
});
document.getElementById("closeScorecardBtn").addEventListener("click", () => {
  scorecardDrawer.hidden = true;
});

document.getElementById("toggleSignalsBtn").addEventListener("click", () => {
  signalsDrawer.hidden = !signalsDrawer.hidden;
  document.getElementById("toggleSignalsBtn").textContent = signalsDrawer.hidden ? "Edit signals" : "Hide signals";
});

bookingsRange.addEventListener("input", () => {
  state.bookings = parseInt(bookingsRange.value, 10);
  document.getElementById("bookingsValLabel").textContent = state.bookings;
  render();
});

[daySelect, weatherSelect, eventSelect].forEach((sel) => {
  sel.addEventListener("change", () => {
    state.day = daySelect.value;
    state.weather = weatherSelect.value;
    state.event = eventSelect.value;
    render();
  });
});

document.getElementById("commandForm").addEventListener("submit", (e) => {
  e.preventDefault();
  handleChefCommand(document.getElementById("commandInput").value);
});

document.querySelectorAll(".prompt-pill").forEach((pill) => {
  pill.addEventListener("click", () => handleChefCommand(pill.dataset.cmd));
});

// Confirm Yes / Cancel / Undo Buttons
document.getElementById("confirmYesBtn").addEventListener("click", commitPendingProposal);
document.getElementById("confirmCancelBtn").addEventListener("click", cancelPendingProposal);

document.getElementById("undoCmdBtn").addEventListener("click", () => {
  const snap = state.historyStack.pop();
  if (!snap) return;
  Object.assign(state, snap);
  state.aiRowNotes = {};
  state.lastApplied = null;
  state.pendingProposal = null;
  state.lastInfo = { heard: "Undo", reflection: "Reverted your last confirmed AI change." };
  daySelect.value = state.day;
  bookingsRange.value = state.bookings;
  weatherSelect.value = state.weather;
  eventSelect.value = state.event;
  renderFridgeDrawer();
  render();
});

resetOrderBtn.addEventListener("click", () => applyPreset(state.preset));

// LIVE ON-SCREEN VOICE TRANSCRIPTION (Web Speech API with interimResults!)
const micBtn = document.getElementById("micBtn");
const micLangBtn = document.getElementById("micLangBtn");
const voiceBar = document.getElementById("voiceBar");
const voiceStatusText = document.getElementById("voiceStatusText");
const voiceLiveWords = document.getElementById("voiceLiveWords");
const commandInput = document.getElementById("commandInput");

micLangBtn.addEventListener("click", () => {
  state.voiceLang = state.voiceLang === "en-US" ? "fr-FR" : "en-US";
  micLangBtn.textContent = state.voiceLang === "en-US" ? "EN" : "FR";
});

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRec = null;
let isListening = false;

micBtn.addEventListener("click", () => {
  if (!SpeechRec) {
    voiceBar.hidden = false;
    voiceStatusText.textContent = "Voice not supported in this browser:";
    voiceLiveWords.textContent = "use Chrome/Edge or type directly in the box above.";
    return;
  }

  if (isListening && activeRec) {
    activeRec.stop();
    return;
  }

  activeRec = new SpeechRec();
  activeRec.lang = state.voiceLang;
  activeRec.interimResults = true; // Transcribe live word-by-word on screen!
  activeRec.continuous = false;

  let finalTranscript = "";
  isListening = true;
  micBtn.classList.add("listening");
  voiceBar.hidden = false;
  voiceStatusText.textContent = `Listening (${micLangBtn.textContent})…`;
  voiceLiveWords.textContent = "Speak now (e.g., “Group of 25 just booked”)";

  activeRec.onresult = (event) => {
    let interim = "";
    finalTranscript = "";
    for (let i = 0; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += piece;
      } else {
        interim += piece;
      }
    }
    const combined = (finalTranscript + " " + interim).trim();
    commandInput.value = combined;
    voiceLiveWords.textContent = combined ? `“${combined}”` : "Listening…";
  };

  activeRec.onerror = (ev) => {
    isListening = false;
    micBtn.classList.remove("listening");
    voiceStatusText.textContent = ev.error === "not-allowed" ? "Mic permission blocked:" : "Mic stopped:";
    voiceLiveWords.textContent = "allow microphone access in browser bar or type above.";
  };

  activeRec.onend = () => {
    isListening = false;
    micBtn.classList.remove("listening");
    const spoken = (finalTranscript || commandInput.value).trim();
    if (spoken) {
      voiceStatusText.textContent = "Transcribed:";
      voiceLiveWords.textContent = `“${spoken}”`;
      handleChefCommand(spoken);
      setTimeout(() => { voiceBar.hidden = true; }, 2200);
    } else {
      voiceBar.hidden = true;
    }
  };

  activeRec.start();
});

// Send & Draft Email Actions
document.getElementById("sendOrderBtn").addEventListener("click", () => {
  state.sent = true;
  render();
});

document.getElementById("editOrderBtn").addEventListener("click", () => {
  state.sent = false;
  render();
});

document.getElementById("downloadPoBtn").addEventListener("click", () => {
  const forecast = computeForecast();
  const lines = computeLines(forecast);
  const total = lines.reduce((s, l) => s + l.lineEur, 0);
  const txt = [
    "COVERCAST — VALIDATED SUPPLIER ORDERS",
    `Site: Bistrot Urbain #04 Montparnasse | Service: ${forecast.dayLabel}`,
    `Forecast: ${forecast.p50} covers (${forecast.p05}–${forecast.p95}) | Total: €${total}`,
    "",
    ...lines.map((l) => `- ${l.name} (${l.supplier} <${VENDOR_EMAILS[l.supplier]}>): ${l.finalQty} ${l.unit} = €${l.lineEur}`)
  ].join("\n");
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `CoverCast_Orders_${forecast.shortDay}.txt`;
  a.click();
});

// Live Prep Timer
setInterval(() => {
  if (state.sent) return;
  const sec = Math.min(3599, Math.floor((Date.now() - state.startTime) / 1000) + 28);
  document.getElementById("prepTimer").textContent =
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}, 1000);

// Claude API Key Modal Wiring (Haiku, Sonnet, Opus, Fable + Custom Model ID)
const claudeModal = document.getElementById("claudeModal");
const claudeModelSelect = document.getElementById("claudeModelSelect");
const customModelWrap = document.getElementById("customModelWrap");
const customModelInput = document.getElementById("customModelInput");
const claudeKeyInput = document.getElementById("claudeKeyInput");
const claudeModalStatus = document.getElementById("claudeModalStatus");
const disconnectClaudeBtn = document.getElementById("disconnectClaudeBtn");

document.getElementById("claudeConfigBtn").addEventListener("click", () => {
  claudeKeyInput.value = state.claudeApiKey;
  const knownModels = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-2"];
  if (knownModels.includes(state.claudeModel)) {
    claudeModelSelect.value = state.claudeModel;
    customModelWrap.hidden = true;
  } else {
    claudeModelSelect.value = "custom";
    customModelWrap.hidden = false;
    customModelInput.value = state.claudeModel;
  }
  disconnectClaudeBtn.hidden = !state.claudeApiKey;
  claudeModalStatus.hidden = true;
  claudeModal.hidden = false;
});

claudeModelSelect.addEventListener("change", () => {
  customModelWrap.hidden = claudeModelSelect.value !== "custom";
});

document.getElementById("closeClaudeModalBtn").addEventListener("click", () => {
  claudeModal.hidden = true;
});

disconnectClaudeBtn.addEventListener("click", () => {
  state.claudeApiKey = "";
  sessionStorage.removeItem("covercast_claude_key");
  updateClaudeBadgeUI();
  claudeModal.hidden = true;
});

document.getElementById("saveClaudeBtn").addEventListener("click", () => {
  const key = claudeKeyInput.value.trim();
  const model = claudeModelSelect.value === "custom" ? customModelInput.value.trim() : claudeModelSelect.value;

  if (!key) {
    claudeModalStatus.className = "modal-status";
    claudeModalStatus.textContent = "Please paste your Anthropic API key (starts with sk-ant-…).";
    claudeModalStatus.hidden = false;
    return;
  }
  if (!model) {
    claudeModalStatus.className = "modal-status";
    claudeModalStatus.textContent = "Please select or enter a Claude model ID.";
    claudeModalStatus.hidden = false;
    return;
  }

  state.claudeApiKey = key;
  state.claudeModel = model;
  sessionStorage.setItem("covercast_claude_key", key);
  sessionStorage.setItem("covercast_claude_model", model);
  updateClaudeBadgeUI();
  claudeModal.hidden = true;
});

// Boot
updateClaudeBadgeUI();
renderFridgeDrawer();
render();
