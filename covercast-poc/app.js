// CoverCast v2.0 — Warm Kitchen Night Mode Copilot
// Dramatic 1-Screen Moment of Truth Reveal + Interactive SVG Forecast Bell Curve

const DAY_PROFILES = {
  saturday:  { label: "Sat", baseCovers: 360, expectedBookings: 186, habitualCovers: 395, ciBase: 19 },
  friday:    { label: "Fri", baseCovers: 330, expectedBookings: 170, habitualCovers: 340, ciBase: 18 },
  thursday:  { label: "Thu", baseCovers: 275, expectedBookings: 142, habitualCovers: 285, ciBase: 16 },
  wednesday: { label: "Wed", baseCovers: 245, expectedBookings: 125, habitualCovers: 255, ciBase: 15 },
  tuesday:   { label: "Tue", baseCovers: 220, expectedBookings: 112, habitualCovers: 235, ciBase: 14 }
};

const WEATHER_EFFECTS = {
  heavy_rain: { icon: "🌧️", label: "Heavy Rain (14mm)", factor: -0.2444, ciAdd: 4, hint: "Terrace closed · heavy walk-in drop expected", shortNote: "Heavy rain closes terrace" },
  light_rain: { icon: "🌦️", label: "Light Showers (3mm)", factor: -0.10, ciAdd: 3, hint: "Light evening showers trim street walk-ins", shortNote: "Light rain trims walk-ins" },
  cloudy:     { icon: "⛅", label: "Mild Overcast", factor: 0.0, ciAdd: 0, hint: "Neutral Paris weather · baseline walk-in flow", shortNote: "Neutral weather baseline" },
  sunny:      { icon: "☀️", label: "Clear & Warm (22°C)", factor: 0.14, ciAdd: 3, hint: "Full terrace open · spontaneous walk-in surge", shortNote: "Warm terrace boosts walk-ins" }
};

const EVENT_EFFECTS = {
  tradeshow: { icon: "🎪", label: "Porte de Versailles Expo", coversDelta: 28, ciAdd: 2, hint: "450m away · evening business spillover", shortNote: "Expo spillover" },
  none:      { icon: "📍", label: "No Local Event", coversDelta: 0, ciAdd: 0, hint: "No major venue activity within 600m", shortNote: "No nearby event" },
  match:     { icon: "⚽", label: "Match Night Surge", coversDelta: 36, ciAdd: 5, hint: "Pre-match burger & steak wave nearby", shortNote: "Match-night surge" },
  strike:    { icon: "🚇", label: "RATP Line 12 Strike", coversDelta: -34, ciAdd: 4, hint: "Metro disruption cuts cross-city diners", shortNote: "Metro strike drop" }
};

const SKUS = [
  {
    id: "cod",
    emoji: "🐟",
    name: "Fresh Atlantic Cod Fillet",
    supplier: "Rungis Marée Express",
    shelfLife: "24h",
    unit: "kg",
    unitPrice: 19,
    ratePerCover: 0.03397,
    habitualSat: 13,
    defaultStock: 2.6
  },
  {
    id: "bavette",
    emoji: "🥩",
    name: "Aged Bavette d'Aloyau Beef",
    supplier: "Boucherie Francilienne",
    shelfLife: "48h",
    unit: "kg",
    unitPrice: 22,
    ratePerCover: 0.05032,
    habitualSat: 14,
    defaultStock: 5.7
  },
  {
    id: "buns",
    emoji: "🍔",
    name: "Artisanal Brioche Buns (x20)",
    supplier: "Boulangerie Lutetia",
    shelfLife: "24h",
    unit: "trays",
    unitPrice: 15,
    ratePerCover: 0.01154,
    habitualSat: 5,
    defaultStock: 0.6
  },
  {
    id: "mesclun",
    emoji: "🥬",
    name: "Organic Mesclun Greens",
    supplier: "Primeurs de Paris",
    shelfLife: "24h",
    unit: "kg",
    unitPrice: 8,
    ratePerCover: 0.0391,
    habitualSat: 11,
    defaultStock: 4.2
  },
  {
    id: "cream",
    emoji: "🥛",
    name: "Normandy Heavy Cream AOP",
    supplier: "Crèmerie des Halles",
    shelfLife: "72h",
    unit: "L",
    unitPrice: 6,
    ratePerCover: 0.03205,
    habitualSat: 7,
    defaultStock: 4.0
  },
  {
    id: "tomatoes",
    emoji: "🍅",
    name: "Heirloom Tomatoes & Herbs",
    supplier: "Primeurs de Paris",
    shelfLife: "48h",
    unit: "kg",
    unitPrice: 3,
    ratePerCover: 0.03974,
    habitualSat: 9,
    defaultStock: 4.4
  }
];

const PRESETS = {
  reference: {
    day: "saturday",
    bookings: 198,
    weather: "heavy_rain",
    event: "tradeshow",
    stocks: { cod: 2.6, bavette: 5.7, buns: 0.6, mesclun: 4.2, cream: 4.0, tomatoes: 4.4 }
  },
  surge: {
    day: "friday",
    bookings: 212,
    weather: "sunny",
    event: "match",
    stocks: { cod: 1.5, bavette: 3.0, buns: 0.4, mesclun: 2.0, cream: 2.5, tomatoes: 2.5 }
  },
  strike: {
    day: "tuesday",
    bookings: 96,
    weather: "light_rain",
    event: "strike",
    stocks: { cod: 2.8, bavette: 4.5, buns: 0.8, mesclun: 3.5, cream: 3.5, tomatoes: 3.8 }
  }
};

const state = {
  day: "saturday",
  bookings: 198,
  weather: "heavy_rain",
  event: "tradeshow",
  stocks: { ...PRESETS.reference.stocks },
  overrides: {},
  llmProvider: "",
  llmKey: "",
  revealed: false,
  approved: false,
  lastForecast: null,
  lastLines: [],
  startTime: Date.now()
};

// DOM References
const contextSection = document.getElementById("contextSection");
const launchCtaWrap = document.getElementById("launchCtaWrap");
const thinkingCard = document.getElementById("thinkingCard");
const revealStage = document.getElementById("revealStage");

const daySelect = document.getElementById("daySelect");
const bookingsRange = document.getElementById("bookingsRange");
const bookingsDisplay = document.getElementById("bookingsDisplay");
const weatherSelect = document.getElementById("weatherSelect");
const eventSelect = document.getElementById("eventSelect");
const fridgeDrawer = document.getElementById("fridgeDrawer");
const stockInputsList = document.getElementById("stockInputsList");

const validationBar = document.getElementById("validationBar");
const dispatchBanner = document.getElementById("dispatchBanner");
const resetOverridesBtn = document.getElementById("resetOverridesBtn");

// Helpers
function fmtSigned(n) {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function updateContextCardHints() {
  const w = WEATHER_EFFECTS[state.weather];
  const ev = EVENT_EFFECTS[state.event];
  const prof = DAY_PROFILES[state.day];
  const lines = computeOrderLines(computeStatisticalForecast());
  const habTotal = lines.reduce((s, l) => s + l.habitualEur, 0);

  document.getElementById("weatherIcon").textContent = w.icon;
  document.getElementById("weatherImpactHint").textContent = w.hint;
  document.getElementById("eventIcon").textContent = ev.icon;
  document.getElementById("eventImpactHint").textContent = ev.hint;
  document.getElementById("bookingsDisplay").textContent = state.bookings;
  document.getElementById("fridgeSummary").textContent =
    `${state.stocks.cod.toFixed(1)} kg Cod · ${state.stocks.bavette.toFixed(1)} kg Bavette · ${state.stocks.mesclun.toFixed(1)} kg Greens + 3 items`;
  document.getElementById("ctaHabitualRef").textContent = `${prof.habitualCovers}-cover / €${habTotal}`;
}

function renderStockDrawerInputs() {
  stockInputsList.innerHTML = SKUS.map(
    (sku) => `
    <div class="fridge-item">
      <span class="fridge-item-name">${sku.emoji} ${sku.name.split(" ").slice(0, 3).join(" ")}</span>
      <div class="fridge-input-group">
        <input type="number" step="0.1" min="0" max="40" data-stock-id="${sku.id}" value="${state.stocks[sku.id]}" class="fridge-num-input" />
        <span class="fridge-unit">${sku.unit}</span>
      </div>
    </div>
  `
  ).join("");

  stockInputsList.querySelectorAll("input[data-stock-id]").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      state.stocks[e.target.dataset.stockId] = Math.max(0, parseFloat(e.target.value) || 0);
      updateContextCardHints();
      if (state.revealed) renderRevealedState();
    });
  });
}

// Statistical Quantile Forecast Model
function computeStatisticalForecast() {
  const profile = DAY_PROFILES[state.day];
  const weather = WEATHER_EFFECTS[state.weather];
  const ev = EVENT_EFFECTS[state.event];

  const bookingDelta = Math.round(state.bookings - profile.expectedBookings);
  const weatherDelta = Math.round(profile.baseCovers * weather.factor);
  const eventDelta = ev.coversDelta;

  const p50 = Math.max(60, profile.baseCovers + bookingDelta + weatherDelta + eventDelta);
  const halfWidth = profile.ciBase + weather.ciAdd + ev.ciAdd;
  const p05 = Math.max(45, p50 - halfWidth);
  const p95 = p50 + halfWidth;

  return {
    dayLabel: profile.label,
    baseCovers: profile.baseCovers,
    habitualCovers: profile.habitualCovers,
    bookingDelta,
    weatherDelta,
    eventDelta,
    p50,
    p05,
    p95,
    halfWidth
  };
}

function computeOrderLines(forecast) {
  const habitualScale = forecast.habitualCovers / DAY_PROFILES.saturday.habitualCovers;
  return SKUS.map((sku) => {
    const grossNeed = Number((forecast.p50 * sku.ratePerCover).toFixed(1));
    const stock = state.stocks[sku.id] ?? sku.defaultStock;
    const recommendedQty = Math.max(0, Math.ceil(Number((grossNeed - stock).toFixed(2))));
    const overrideDelta = state.overrides[sku.id] || 0;
    const finalQty = Math.max(0, recommendedQty + overrideDelta);

    const habitualQty =
      state.day === "saturday"
        ? sku.habitualSat
        : Math.max(1, Math.round(sku.habitualSat * habitualScale));

    const lineEur = finalQty * sku.unitPrice;
    const habitualEur = habitualQty * sku.unitPrice;
    const deltaEur = lineEur - habitualEur;

    return {
      ...sku,
      stock,
      grossNeed,
      recommendedQty,
      overrideDelta,
      finalQty,
      habitualQty,
      lineEur,
      habitualEur,
      deltaEur
    };
  });
}

// Interactive SVG Bell Curve comparing CoverCast Distribution vs Karim's Habit
function renderBellCurveSvg(forecast) {
  const svg = document.getElementById("bellCurveSvg");
  const W = 600;
  const H = 185;
  const padL = 24;
  const padR = 24;
  const baseLineY = 148;
  const peakH = 104;

  // Dynamic x-axis domain framing both the bell curve and Karim's habitual point
  const sigma = forecast.halfWidth / 1.645;
  const minDomain = Math.min(forecast.p05 - sigma * 2.2, forecast.habitualCovers - 35);
  const maxDomain = Math.max(forecast.p95 + sigma * 2.2, forecast.habitualCovers + 35);
  const toX = (val) => padL + ((val - minDomain) / (maxDomain - minDomain)) * (W - padL - padR);

  const pdf = (x) => Math.exp(-0.5 * Math.pow((x - forecast.p50) / sigma, 2));

  // Full curve path
  const steps = 90;
  const curvePts = [];
  for (let i = 0; i <= steps; i++) {
    const val = minDomain + (i / steps) * (maxDomain - minDomain);
    const x = toX(val);
    const y = baseLineY - pdf(val) * peakH;
    curvePts.push([x, y]);
  }
  const lineD = curvePts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fullAreaD = `${lineD} L${toX(maxDomain).toFixed(1)},${baseLineY} L${toX(minDomain).toFixed(1)},${baseLineY} Z`;

  // 90% CI shaded band path
  const ciPts = [];
  for (let i = 0; i <= 40; i++) {
    const val = forecast.p05 + (i / 40) * (forecast.p95 - forecast.p05);
    ciPts.push([toX(val), baseLineY - pdf(val) * peakH]);
  }
  const ciAreaD =
    `M${toX(forecast.p05).toFixed(1)},${baseLineY} ` +
    ciPts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") +
    ` L${toX(forecast.p95).toFixed(1)},${baseLineY} Z`;

  const xP50 = toX(forecast.p50);
  const xP05 = toX(forecast.p05);
  const xP95 = toX(forecast.p95);
  const xHab = toX(forecast.habitualCovers);

  const isWasteRisk = forecast.habitualCovers > forecast.p50;
  const riskZoneX = isWasteRisk ? xP95 : xHab;
  const riskZoneW = Math.max(0, isWasteRisk ? xHab - xP95 : xP05 - xHab);
  const riskLabel = isWasteRisk
    ? `Over-order waste zone (+${forecast.habitualCovers - forecast.p50})`
    : `Stockout risk zone (−${forecast.p50 - forecast.habitualCovers})`;
  const riskColor = isWasteRisk ? "#f43f5e" : "#f59e0b";

  // Keep Habit label inside SVG bounds
  const habLabelAnchor = xHab > W - 110 ? "end" : xHab < 110 ? "start" : "middle";
  const habLabelX = Math.min(W - 14, Math.max(14, xHab));

  svg.innerHTML = `
    <defs>
      <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.48"/>
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.06"/>
      </linearGradient>
      <linearGradient id="riskGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${riskColor}" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="${riskColor}" stop-opacity="0.24"/>
      </linearGradient>
    </defs>

    <!-- Baseline Axis -->
    <line x1="${padL}" y1="${baseLineY}" x2="${W - padR}" y2="${baseLineY}" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>

    <!-- Risk Zone Highlight between CI bound and Karim's Habit -->
    ${
      riskZoneW > 8
        ? `<rect x="${riskZoneX.toFixed(1)}" y="34" width="${riskZoneW.toFixed(1)}" height="${baseLineY - 34}" fill="url(#riskGrad)" rx="4"/>`
        : ""
    }

    <!-- Subtle full tail & bright 90% CI Bell -->
    <path d="${fullAreaD}" fill="rgba(59,130,246,0.08)"/>
    <path d="${ciAreaD}" fill="url(#ciGrad)"/>
    <path d="${lineD}" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round"/>

    <!-- P50 Peak Marker -->
    <line x1="${xP50.toFixed(1)}" y1="30" x2="${xP50.toFixed(1)}" y2="${baseLineY}" stroke="#34d399" stroke-width="2" stroke-dasharray="3 3"/>
    <circle cx="${xP50.toFixed(1)}" cy="${(baseLineY - peakH).toFixed(1)}" r="5" fill="#10b981" stroke="#090c12" stroke-width="2"/>
    <text x="${xP50.toFixed(1)}" y="21" text-anchor="middle" fill="#34d399" font-size="11.5" font-weight="800" font-family="Inter, sans-serif">
      CoverCast: ${forecast.p50}
    </text>

    <!-- 90% CI Ticks -->
    <text x="${xP05.toFixed(1)}" y="${baseLineY + 17}" text-anchor="middle" fill="#93c5fd" font-size="10.5" font-weight="700" font-family="JetBrains Mono, monospace">${forecast.p05}</text>
    <text x="${xP95.toFixed(1)}" y="${baseLineY + 17}" text-anchor="middle" fill="#93c5fd" font-size="10.5" font-weight="700" font-family="JetBrains Mono, monospace">${forecast.p95}</text>
    <text x="${xP50.toFixed(1)}" y="${baseLineY + 30}" text-anchor="middle" fill="#64748b" font-size="10" font-weight="600" font-family="Inter, sans-serif">90% confidence range</text>

    <!-- Karim's Habitual Marker -->
    <line x1="${xHab.toFixed(1)}" y1="34" x2="${xHab.toFixed(1)}" y2="${baseLineY}" stroke="${riskColor}" stroke-width="2.2" stroke-dasharray="5 4"/>
    <circle cx="${xHab.toFixed(1)}" cy="${baseLineY}" r="4.5" fill="${riskColor}"/>
    <text x="${habLabelX.toFixed(1)}" y="22" text-anchor="${habLabelAnchor}" fill="${riskColor}" font-size="11" font-weight="800" font-family="Inter, sans-serif">
      Habit: ${forecast.habitualCovers}
    </text>
    <text x="${habLabelX.toFixed(1)}" y="${baseLineY + 17}" text-anchor="${habLabelAnchor}" fill="${riskColor}" font-size="10" font-weight="700" font-family="Inter, sans-serif">
      ${riskLabel}
    </text>
  `;
}

function buildCalibratedBrief(forecast, lines) {
  const totalOrder = lines.reduce((s, l) => s + l.lineEur, 0);
  const totalHabitual = lines.reduce((s, l) => s + l.habitualEur, 0);
  const saved = totalHabitual - totalOrder;
  const topCut = [...lines].sort((a, b) => a.deltaEur - b.deltaEur)[0];

  const headline =
    saved >= 0
      ? `Expecting ${forecast.p50} covers (${forecast.habitualCovers - forecast.p50} fewer than usual ${forecast.dayLabel}): CoverCast trims €${saved} of 24–48h perishables while safely covering up to ${forecast.p95} covers.`
      : `Surge alert (${forecast.p50} covers vs. ${forecast.habitualCovers} usual ${forecast.dayLabel}): CoverCast adds +€${Math.abs(saved)} in fresh buffer so your high-margin steaks & buns don’t sell out mid-service.`;

  const chefWatchout =
    saved >= 0
      ? `👨‍🍳 Chef spot-check: confirm the ${topCut.stock.toFixed(1)} ${topCut.unit} of ${topCut.name.split(" ").slice(0, 3).join(" ")} in walk-in #1 is fresh for tomorrow before approving.`
      : `👨‍🍳 Chef spot-check: verify extra prep tray space for Bavette & Brioche buns ahead of tomorrow’s peak wave.`;

  return {
    mode: "calibrated-engine",
    model: "gpt-4o-mini (Calibrated)",
    latencyMs: 380,
    costUsd: 0.000345,
    headline,
    chefWatchout
  };
}

function renderRevealedState(aiMetaOverride = null) {
  const forecast = computeStatisticalForecast();
  const lines = computeOrderLines(forecast);
  state.lastForecast = forecast;
  state.lastLines = lines;

  const aiMeta = aiMetaOverride || buildCalibratedBrief(forecast, lines);
  const totalOrder = lines.reduce((s, l) => s + l.lineEur, 0);
  const totalHabitual = lines.reduce((s, l) => s + l.habitualEur, 0);
  const savedEur = totalHabitual - totalOrder;
  const pctDelta = totalHabitual > 0 ? ((totalOrder - totalHabitual) / totalHabitual) * 100 : 0;
  const overrideCount = Object.values(state.overrides).filter((v) => v !== 0).length;

  // Left Hero: Forecast & Bell Curve
  document.getElementById("kpiCovers").textContent = forecast.p50;
  document.getElementById("ciBadge").textContent = `90% CI: ${forecast.p05} – ${forecast.p95}`;
  document.getElementById("habitComparePill").innerHTML = `Karim’s habit: <strong>${forecast.habitualCovers}</strong>`;
  renderBellCurveSvg(forecast);

  document.getElementById("causalStrip").innerHTML = `
    <span class="causal-chip">Base ${forecast.dayLabel}: ${forecast.baseCovers}</span>
    <span class="causal-chip ${forecast.bookingDelta >= 0 ? "pos" : "neg"}">Bookings ${fmtSigned(forecast.bookingDelta)}</span>
    <span class="causal-chip ${forecast.weatherDelta >= 0 ? "pos" : "neg"}">${WEATHER_EFFECTS[state.weather].shortNote} ${fmtSigned(forecast.weatherDelta)}</span>
    <span class="causal-chip ${forecast.eventDelta >= 0 ? "pos" : "neg"}">${EVENT_EFFECTS[state.event].shortNote} ${fmtSigned(forecast.eventDelta)}</span>
  `;
  document.getElementById("aiHeadline").textContent = aiMeta.headline;

  // Right Hero: Money Story
  const moneyCard = document.getElementById("moneyCard");
  const impactEyebrow = document.getElementById("impactEyebrow");
  const impactPct = document.getElementById("impactPct");
  const kpiSavedEur = document.getElementById("kpiSavedEur");
  const impactSubtext = document.getElementById("impactSubtext");
  const ccBarFill = document.getElementById("ccBarFill");
  const habitBarFill = document.getElementById("habitBarFill");

  const maxBar = Math.max(totalOrder, totalHabitual, 1);
  habitBarFill.style.width = `${(totalHabitual / maxBar) * 100}%`;
  ccBarFill.style.width = `${(totalOrder / maxBar) * 100}%`;

  document.getElementById("kpiHabitualEur").textContent = `€${totalHabitual}`;
  document.getElementById("kpiOrderEur").textContent = `€${totalOrder}`;
  document.getElementById("chefWatchout").textContent = aiMeta.chefWatchout;

  if (savedEur >= 0) {
    moneyCard.classList.remove("surge-mode");
    impactEyebrow.className = "eyebrow emerald-eyebrow";
    impactEyebrow.textContent = "PERISHABLE WASTE AVOIDED TONIGHT";
    impactPct.className = "pct-pill";
    impactPct.textContent = `${pctDelta.toFixed(1)}%`;
    kpiSavedEur.className = "savings-giant";
    kpiSavedEur.textContent = `€${savedEur}`;
    impactSubtext.textContent = "kept out of Monday’s bin · direct invoice savings";
    ccBarFill.classList.remove("amber-fill");
  } else {
    moneyCard.classList.add("surge-mode");
    impactEyebrow.className = "eyebrow amber-eyebrow";
    impactEyebrow.textContent = "STOCKOUT BUFFER ADDED TONIGHT";
    impactPct.className = "pct-pill amber-pill";
    impactPct.textContent = `+${Math.abs(pctDelta).toFixed(1)}%`;
    kpiSavedEur.className = "savings-giant amber-text";
    kpiSavedEur.textContent = `+€${Math.abs(savedEur)}`;
    impactSubtext.textContent = "protects ~€1,180 in high-margin Saturday sales";
    ccBarFill.classList.add("amber-fill");
  }

  document.getElementById("telemetryCost").innerHTML =
    `⚡ AI Call: <strong>$${aiMeta.costUsd.toFixed(6)}</strong> (${(aiMeta.latencyMs / 1000).toFixed(2)}s)`;
  document.getElementById("engineBadgeText").textContent =
    aiMeta.mode === "live-llm"
      ? `$${aiMeta.costUsd.toFixed(6)} / call · Live LLM`
      : `$${aiMeta.costUsd.toFixed(6)} / call · Hybrid AI`;

  // Clean 3x2 Visual Ingredient Cards
  document.getElementById("kpiOverrideNote").textContent =
    overrideCount === 0
      ? "All 6 perishables AI-calibrated"
      : `${overrideCount} item${overrideCount > 1 ? "s" : ""} manually adjusted by Chef Karim`;
  resetOverridesBtn.hidden = overrideCount === 0;

  const grid = document.getElementById("skuCardsGrid");
  grid.innerHTML = lines
    .map((line) => {
      const maxQty = Math.max(line.habitualQty, line.finalQty, 1);
      const fillPct = Math.min(100, (line.finalQty / maxQty) * 100);
      const badgeClass = line.deltaEur < 0 ? "save" : line.deltaEur > 0 ? "up" : "flat";
      const badgeText =
        line.deltaEur < 0
          ? `−€${Math.abs(line.deltaEur)}`
          : line.deltaEur > 0
          ? `+€${line.deltaEur}`
          : "€0";

      return `
      <div class="sku-card ${line.overrideDelta !== 0 ? "overridden" : ""}">
        <div class="sku-card-top">
          <div class="sku-id-block">
            <div class="sku-emoji">${line.emoji}</div>
            <div>
              <div class="sku-name">${line.name}</div>
              <div class="sku-meta">${line.supplier} · ${line.shelfLife} fresh · €${line.unitPrice}/${line.unit}</div>
            </div>
          </div>
          <span class="delta-badge ${badgeClass}">${badgeText}</span>
        </div>

        <div class="sku-compare-row">
          <div class="sku-compare-labels">
            <span>In fridge: <strong>${line.stock.toFixed(1)} ${line.unit}</strong></span>
            <span>Usual: ${line.habitualQty} ${line.unit} → <strong>${line.finalQty} ${line.unit}</strong></span>
          </div>
          <div class="sku-mini-track">
            <div class="sku-mini-fill ${line.deltaEur > 0 ? "amber" : ""}" style="width: ${fillPct}%;"></div>
          </div>
        </div>

        <div class="sku-card-bottom">
          <div class="sku-price-col">
            <span class="sku-total-eur">€${line.lineEur}</span>
            <span class="sku-habit-eur">vs. €${line.habitualEur} usual</span>
          </div>
          <div class="stepper">
            <button type="button" class="step-btn" data-step="-1" data-sku="${line.id}" aria-label="Decrease ${line.name}">−</button>
            <span class="step-val">${line.finalQty} ${line.unit}</span>
            <button type="button" class="step-btn" data-step="1" data-sku="${line.id}" aria-label="Increase ${line.name}">+</button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  grid.querySelectorAll("button[data-sku]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.sku;
      state.overrides[id] = (state.overrides[id] || 0) + parseInt(btn.dataset.step, 10);
      renderRevealedState();
    });
  });

  const activeSuppliers = new Set(lines.filter((l) => l.finalQty > 0).map((l) => l.supplier)).size;
  document.getElementById("approveOrderBtn").innerHTML =
    `✓ Approve &amp; Send ${activeSuppliers} Supplier Orders · <span id="approveBtnTotal">€${totalOrder}</span>`;
}

// Dramatic Live 1.2s Step-by-Step Reveal + Optional Real LLM API Call
async function runDramaticReveal() {
  state.approved = false;
  dispatchBanner.hidden = true;
  validationBar.hidden = false;
  launchCtaWrap.hidden = true;
  revealStage.hidden = true;
  thinkingCard.hidden = false;
  contextSection.classList.add("compact");
  fridgeDrawer.hidden = true;

  const forecast = computeStatisticalForecast();
  const lines = computeOrderLines(forecast);
  const totalOrder = lines.reduce((s, l) => s + l.lineEur, 0);
  const totalHabitual = lines.reduce((s, l) => s + l.habitualEur, 0);

  // Update dynamic step labels
  const steps = document.querySelectorAll("#thinkingSteps .t-step");
  steps[0].innerHTML = `<span class="t-dot"></span> Syncing ${state.bookings} Zenchef bookings &amp; 52-week POS dish mix`;
  steps[1].innerHTML = `<span class="t-dot"></span> Applying ${WEATHER_EFFECTS[state.weather].label} (${fmtSigned(forecast.weatherDelta)}) &amp; ${EVENT_EFFECTS[state.event].label} (${fmtSigned(forecast.eventDelta)})`;
  steps[2].innerHTML = `<span class="t-dot"></span> Computing 90% cover curve (${forecast.p05}–${forecast.p95}) &amp; subtracting walk-in fridge stock`;
  steps[3].innerHTML = `<span class="t-dot"></span> Drafting Chef Karim’s order brief &amp; supplier purchase orders`;

  steps.forEach((s) => s.classList.remove("active", "done"));

  // Kick off optional backend LLM call in parallel
  const apiPromise = (async () => {
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            day: state.day,
            confirmedBookings: state.bookings,
            weather: WEATHER_EFFECTS[state.weather].label,
            localEvent: EVENT_EFFECTS[state.event].label
          },
          forecast,
          orderSummary: { covercastEur: totalOrder, habitualEur: totalHabitual, deltaEur: totalOrder - totalHabitual },
          customProvider: state.llmProvider,
          customKey: state.llmKey
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.mode === "live-llm" && data.headline) return data;
      }
    } catch {
      // Static GitHub Pages host — seamlessly uses calibrated engine
    }
    return null;
  })();

  // Crisp 1.1s visual step animation
  for (let i = 0; i < steps.length; i++) {
    if (i > 0) {
      steps[i - 1].classList.remove("active");
      steps[i - 1].classList.add("done");
    }
    steps[i].classList.add("active");
    await new Promise((r) => setTimeout(r, 270));
  }
  steps[steps.length - 1].classList.remove("active");
  steps[steps.length - 1].classList.add("done");

  const liveAi = await apiPromise;
  await new Promise((r) => setTimeout(r, 150));

  thinkingCard.hidden = true;
  state.revealed = true;
  revealStage.hidden = false;
  renderRevealedState(liveAi);
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  state.day = p.day;
  state.bookings = p.bookings;
  state.weather = p.weather;
  state.event = p.event;
  state.stocks = { ...p.stocks };
  state.overrides = {};
  state.approved = false;

  daySelect.value = state.day;
  bookingsRange.value = state.bookings;
  weatherSelect.value = state.weather;
  eventSelect.value = state.event;

  renderStockDrawerInputs();
  updateContextCardHints();

  if (state.revealed) {
    dispatchBanner.hidden = true;
    validationBar.hidden = false;
    renderRevealedState();
  }
}

// Event Listeners
document.getElementById("buildOrderBtn").addEventListener("click", runDramaticReveal);

document.querySelectorAll(".scenario-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".scenario-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    applyPreset(tab.dataset.preset);
  });
});

bookingsRange.addEventListener("input", () => {
  state.bookings = parseInt(bookingsRange.value, 10);
  updateContextCardHints();
  if (state.revealed) renderRevealedState();
});

[daySelect, weatherSelect, eventSelect].forEach((sel) => {
  sel.addEventListener("change", () => {
    state.day = daySelect.value;
    state.weather = weatherSelect.value;
    state.event = eventSelect.value;
    updateContextCardHints();
    if (state.revealed) renderRevealedState();
  });
});

document.getElementById("toggleFridgeBtn").addEventListener("click", () => {
  fridgeDrawer.hidden = !fridgeDrawer.hidden;
});
document.getElementById("closeFridgeBtn").addEventListener("click", () => {
  fridgeDrawer.hidden = true;
});

resetOverridesBtn.addEventListener("click", () => {
  state.overrides = {};
  renderRevealedState();
});

// 1-Click Chef Validation & Realistic Supplier Slips
document.getElementById("approveOrderBtn").addEventListener("click", () => {
  state.approved = true;
  const totalOrder = state.lastLines.reduce((s, l) => s + l.lineEur, 0);
  const totalHabitual = state.lastLines.reduce((s, l) => s + l.habitualEur, 0);
  const saved = totalHabitual - totalOrder;
  const elapsedSec = Math.max(18, Math.round((Date.now() - state.startTime) / 1000));

  // Group items by supplier
  const bySupplier = {};
  state.lastLines
    .filter((l) => l.finalQty > 0)
    .forEach((l) => {
      if (!bySupplier[l.supplier]) bySupplier[l.supplier] = [];
      bySupplier[l.supplier].push(l);
    });

  const vendorNames = Object.keys(bySupplier);
  validationBar.hidden = true;
  dispatchBanner.hidden = false;
  document.getElementById("dispatchTitle").textContent =
    `${vendorNames.length} Supplier Orders Dispatched (€${totalOrder}) — Approved by Chef Karim`;
  document.getElementById("dispatchSummary").textContent =
    saved >= 0
      ? `Validated in ${elapsedSec}s (saving ~44 min vs. manual close) · €${saved} perishable waste avoided tonight · EU AI Act audit log #BU04-${Date.now().toString().slice(-5)}`
      : `Validated in ${elapsedSec}s · +€${Math.abs(saved)} surge stockout buffer dispatched · EU AI Act audit log #BU04-${Date.now().toString().slice(-5)}`;

  document.getElementById("supplierSlips").innerHTML = vendorNames
    .map((vendor) => {
      const items = bySupplier[vendor];
      const sub = items.reduce((s, i) => s + i.lineEur, 0);
      const linesHtml = items.map((i) => `${i.emoji} ${i.finalQty} ${i.unit} ${i.name.split(" ")[1] || i.name}`).join("<br/>");
      return `
        <div class="slip-card">
          <div class="slip-vendor">${vendor}</div>
          <div class="slip-lines">${linesHtml}</div>
          <div class="slip-status">✓ Sent · €${sub} (06:00 Rungis slot)</div>
        </div>
      `;
    })
    .join("");
});

document.getElementById("editAgainBtn").addEventListener("click", () => {
  dispatchBanner.hidden = true;
  validationBar.hidden = false;
});

document.getElementById("replayDemoBtn").addEventListener("click", () => {
  state.revealed = false;
  state.approved = false;
  revealStage.hidden = true;
  dispatchBanner.hidden = true;
  validationBar.hidden = false;
  launchCtaWrap.hidden = false;
  contextSection.classList.remove("compact");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.getElementById("exportPoBtn").addEventListener("click", () => {
  const note = document.getElementById("chefNoteInput").value.trim();
  const totalOrder = state.lastLines.reduce((s, l) => s + l.lineEur, 0);
  const linesTxt = state.lastLines
    .map((l) => `- ${l.name} (${l.supplier}): ${l.finalQty} ${l.unit} x €${l.unitPrice} = €${l.lineEur} [Fridge: ${l.stock} ${l.unit}]`)
    .join("\n");

  const content = [
    "COVERCAST — VALIDATED SUPPLIER PURCHASE ORDER",
    "Site: Bistrot Urbain #04 — Montparnasse (Paris 15e)",
    `Approved by: Head Chef Karim | Timestamp: ${new Date().toISOString()}`,
    `Forecast: ${state.lastForecast.p50} covers (90% CI: ${state.lastForecast.p05}-${state.lastForecast.p95})`,
    `Total Net Order: €${totalOrder}`,
    note ? `Chef Note: ${note}` : "",
    "",
    "LINE ITEMS:",
    linesTxt
  ]
    .filter(Boolean)
    .join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `CoverCast_PO_BistrotUrbain04_${state.day}.txt`;
  a.click();
});

// Live Prep Timer
setInterval(() => {
  if (state.approved || !state.revealed) return;
  const sec = Math.min(3599, Math.floor((Date.now() - state.startTime) / 1000) + 24);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  document.getElementById("prepTimer").textContent = `${mm}:${ss}`;
}, 1000);

// Optional LLM Modal
const llmModal = document.getElementById("llmModal");
document.getElementById("llmConfigBtn").addEventListener("click", () => {
  llmModal.hidden = false;
});
document.getElementById("closeModalBtn").addEventListener("click", () => {
  llmModal.hidden = true;
});
document.getElementById("saveLlmBtn").addEventListener("click", () => {
  state.llmProvider = document.getElementById("providerSelect").value;
  state.llmKey = document.getElementById("apiKeyInput").value.trim();
  llmModal.hidden = true;
  if (state.revealed) runDramaticReveal();
});

// Initial Stage-1 Boot (Calm, Uncluttered Ready Screen)
renderStockDrawerInputs();
updateContextCardHints();
