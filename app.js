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
  aiRowNotes: {},     // skuId -> crisp diff string e.g. "AI: 8 → 9 kg"
  lastDiffPills: [],  // array of summary strings shown in AI diff card
  lastCommandHeard: "",
  lastCostUsd: 0.000345,
  llmProvider: "",
  llmKey: "",
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
    `Ordering for tomorrow (${forecast.dayLabel} 06:00 delivery) · ${state.bookings} Zenchef bookings · POS fridge stock synced`;

  // 3 Hero Numbers
  document.getElementById("metricCovers").textContent = forecast.p50;
  document.getElementById("metricCoversSub").textContent = `likely ${forecast.p05}–${forecast.p95} · usually ${forecast.habitualCovers}`;
  document.getElementById("metricOrder").textContent = `€${totalOrder}`;
  document.getElementById("metricOrderSub").textContent = `instead of €${totalHabitual} usual`;

  const savedEl = document.getElementById("metricSaved");
  if (saved >= 0) {
    savedEl.className = "metric-val emerald";
    savedEl.textContent = `−€${saved}`;
    document.getElementById("metricSavedLabel").textContent = "waste avoided";
    document.getElementById("metricSavedSub").textContent = `${pct.toFixed(1)}% food spend`;
  } else {
    savedEl.className = "metric-val amber";
    savedEl.textContent = `+€${Math.abs(saved)}`;
    document.getElementById("metricSavedLabel").textContent = "stockout buffer";
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

  // AI Diff Card (Shows exactly what AI changed + prominent Undo)
  if (state.lastDiffPills.length > 0) {
    aiDiffCard.hidden = false;
    document.getElementById("aiHeardQuote").textContent = `from “${state.lastCommandHeard}”`;
    document.getElementById("aiCostMini").textContent = `$${state.lastCostUsd.toFixed(6)}`;
    document.getElementById("aiDiffPills").innerHTML = state.lastDiffPills
      .map((p) => `<span class="diff-pill">${p}</span>`)
      .join("");
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

// Snapshot for clean multi-step Undo
function captureSnapshot() {
  return {
    day: state.day,
    bookings: state.bookings,
    weather: state.weather,
    event: state.event,
    extraCovers: state.extraCovers,
    extraCoversNote: state.extraCoversNote,
    stocks: { ...state.stocks },
    skus: state.skus.map((s) => ({ ...s })),
    overrides: { ...state.overrides },
    aiRowNotes: { ...state.aiRowNotes },
    lastDiffPills: [...state.lastDiffPills],
    lastCommandHeard: state.lastCommandHeard
  };
}

function parseKitchenCommandLocally(rawText) {
  const t = rawText.toLowerCase();
  const prevForecast = computeForecast();
  const prevLines = computeLines(prevForecast);

  let matched = false;

  // 1. Cod swap -> Sea Bass / Salmon
  if ((t.includes("cod") || t.includes("cabillaud") || t.includes("fish") || t.includes("poisson")) &&
      (t.includes("sea bass") || t.includes("bar") || t.includes("salmon") || t.includes("saumon") || t.includes("swap") || t.includes("replace") || t.includes("out of") || t.includes("plus de"))) {
    const isSalmon = t.includes("salmon") || t.includes("saumon");
    const codSku = state.skus.find((s) => s.id === "cod");
    if (codSku) {
      codSku.name = isSalmon ? "Fresh Scottish Salmon Fillet" : "Wild Sea Bass Fillet (Bar de ligne)";
      codSku.unitPrice = isSalmon ? 21 : 23;
      state.stocks.cod = 0;
      matched = true;
    }
  }

  // 2. Private party / group covers
  const groupMatch = t.match(/(?:group|party|table|birthday|anniversaire|groupe|add|\+|extra|booked|réservé)\s*(?:of|for|de|pour)?\s*(\d{1,3})\b/) ||
                     t.match(/\b(\d{1,3})\s*(?:people|guests|covers|couverts|personnes|pax)\b/);
  if (groupMatch && !t.includes("kg") && !t.includes("tray")) {
    const n = Math.min(120, Math.max(4, parseInt(groupMatch[1], 10)));
    state.extraCovers += n;
    state.extraCoversNote = `Group booking`;
    matched = true;
  }

  // 3. Empty fridge / threw out / spoiled
  if (t.includes("empty") || t.includes("threw") || t.includes("spoiled") || t.includes("vide") || t.includes("jeté") || t.includes("no ") || t.includes("zero") || t.includes("plus de")) {
    const map = [
      { id: "mesclun", keys: ["salad", "green", "mesclun", "salade"] },
      { id: "cod", keys: ["cod", "cabillaud"] },
      { id: "bavette", keys: ["beef", "bavette", "steak", "boeuf"] },
      { id: "buns", keys: ["bun", "bread", "brioche", "pain"] },
      { id: "cream", keys: ["cream", "crème", "creme"] },
      { id: "tomatoes", keys: ["tomato", "herb", "tomate"] }
    ];
    for (const item of map) {
      if (item.keys.some((k) => t.includes(k)) && !(item.id === "cod" && matched)) {
        state.stocks[item.id] = 0;
        matched = true;
      }
    }
  }

  // 4. Direct qty tweak
  const qtyMatch = t.match(/(add|more|\+|plus|ajoute|cut|remove|less|minus|-|enlève)\s*(\d{1,2})?/);
  if (qtyMatch && !matched) {
    const isMinus = ["cut", "remove", "less", "minus", "-", "enlève"].includes(qtyMatch[1]);
    const amt = parseInt(qtyMatch[2], 10) || 2;
    const map = [
      { id: "cod", keys: ["cod", "fish", "bass", "salmon", "cabillaud"] },
      { id: "bavette", keys: ["beef", "bavette", "steak", "boeuf"] },
      { id: "buns", keys: ["bun", "brioche", "tray", "pain"] },
      { id: "mesclun", keys: ["salad", "green", "mesclun", "salade"] },
      { id: "cream", keys: ["cream", "crème", "creme"] },
      { id: "tomatoes", keys: ["tomato", "herb", "tomate"] }
    ];
    for (const item of map) {
      if (item.keys.some((k) => t.includes(k))) {
        state.overrides[item.id] = (state.overrides[item.id] || 0) + (isMinus ? -amt : amt);
        matched = true;
      }
    }
  }

  // 5. Weather flip
  if (t.includes("sunny") || t.includes("clear") || t.includes("no rain") || t.includes("soleil")) {
    state.weather = "sunny";
    weatherSelect.value = "sunny";
    matched = true;
  }

  if (!matched) {
    state.extraCovers += 10;
    state.extraCoversNote = "Chef safety note";
  }

  // Compute EXACT before -> after diff so user sees crystal-clear proof of what changed
  const nextForecast = computeForecast();
  const nextLines = computeLines(nextForecast);
  const diffPills = [];
  const rowNotes = {};

  if (nextForecast.p50 !== prevForecast.p50) {
    diffPills.push(`Covers: ${prevForecast.p50} → ${nextForecast.p50} (${fmtSigned(nextForecast.p50 - prevForecast.p50)})`);
  }

  nextLines.forEach((nl, idx) => {
    const pl = prevLines[idx];
    const parts = [];
    if (nl.name !== pl.name) {
      parts.push(`Swapped to ${nl.name.split(" ").slice(0, 3).join(" ")} (€${nl.unitPrice}/${nl.unit})`);
      diffPills.push(`Item: Cod → ${nl.name.split(" ").slice(0, 3).join(" ")}`);
    }
    if (nl.stock !== pl.stock) {
      parts.push(`Fridge ${pl.stock.toFixed(1)} → ${nl.stock.toFixed(1)} ${nl.unit}`);
    }
    if (nl.finalQty !== pl.finalQty) {
      parts.push(`Qty ${pl.finalQty} → ${nl.finalQty} ${nl.unit}`);
      diffPills.push(`${nl.name.split(" ")[1] || nl.name}: ${pl.finalQty} → ${nl.finalQty} ${nl.unit}`);
    }
    if (parts.length > 0) {
      rowNotes[nl.id] = parts.join(" · ");
    }
  });

  const prevEur = prevLines.reduce((s, l) => s + l.lineEur, 0);
  const nextEur = nextLines.reduce((s, l) => s + l.lineEur, 0);
  if (nextEur !== prevEur) {
    diffPills.push(`Order Total: €${prevEur} → €${nextEur}`);
  }

  return { diffPills, rowNotes, costUsd: 0.000345 };
}

async function handleChefCommand(rawText) {
  const cmd = rawText.trim();
  if (!cmd) return;

  const btn = document.getElementById("commandSubmitBtn");
  btn.disabled = true;
  btn.textContent = "…";

  state.historyStack.push(captureSnapshot());
  state.sent = false;

  const prevForecast = computeForecast();
  const prevLines = computeLines(prevForecast);

  let handledLive = false;
  try {
    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "command",
        command: cmd,
        currentState: {
          day: state.day,
          bookings: state.bookings,
          weather: state.weather,
          event: state.event,
          skus: state.skus.map((s) => ({ id: s.id, name: s.name, unit: s.unit, unitPrice: s.unitPrice, stock: state.stocks[s.id] }))
        },
        customProvider: state.llmProvider,
        customKey: state.llmKey
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.mode === "live-llm" && data.mutation) {
        const m = data.mutation;
        if (typeof m.coverDelta === "number" && m.coverDelta !== 0) {
          state.extraCovers += m.coverDelta;
          state.extraCoversNote = m.coverReason || "Chef note";
        }
        if (m.weather && WEATHER_EFFECTS[m.weather]) {
          state.weather = m.weather;
          weatherSelect.value = m.weather;
        }
        if (Array.isArray(m.skuEdits)) {
          m.skuEdits.forEach((ed) => {
            const sku = state.skus.find((s) => s.id === ed.id);
            if (!sku) return;
            if (ed.newName) sku.name = ed.newName;
            if (typeof ed.newUnitPrice === "number") sku.unitPrice = ed.newUnitPrice;
            if (typeof ed.setStock === "number") state.stocks[ed.id] = Math.max(0, ed.setStock);
            if (typeof ed.qtyDelta === "number") state.overrides[ed.id] = (state.overrides[ed.id] || 0) + ed.qtyDelta;
          });
        }
        const nextF = computeForecast();
        const nextL = computeLines(nextF);
        const pills = [];
        const notes = {};
        if (nextF.p50 !== prevForecast.p50) pills.push(`Covers: ${prevForecast.p50} → ${nextF.p50}`);
        nextL.forEach((nl, i) => {
          const pl = prevLines[i];
          if (nl.finalQty !== pl.finalQty || nl.name !== pl.name) {
            notes[nl.id] = nl.name !== pl.name ? `Swapped → ${nl.name} (${nl.finalQty} ${nl.unit})` : `Qty ${pl.finalQty} → ${nl.finalQty} ${nl.unit}`;
            pills.push(`${nl.name.split(" ")[1] || nl.name}: ${pl.finalQty} → ${nl.finalQty} ${nl.unit}`);
          }
        });
        state.lastDiffPills = pills.length ? pills : [data.reply || "Updated order"];
        state.aiRowNotes = notes;
        state.lastCommandHeard = cmd;
        state.lastCostUsd = data.costUsd || 0.000345;
        handledLive = true;
      }
    }
  } catch {
    // Static GitHub Pages fallback
  }

  if (!handledLive) {
    await new Promise((r) => setTimeout(r, 220));
    const res = parseKitchenCommandLocally(cmd);
    state.lastDiffPills = res.diffPills;
    state.aiRowNotes = res.rowNotes;
    state.lastCommandHeard = cmd;
    state.lastCostUsd = res.costUsd;
  }

  renderFridgeDrawer();
  render();
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
  state.lastDiffPills = [];
  state.lastCommandHeard = "";
  state.sent = false;

  daySelect.value = state.day;
  bookingsRange.value = state.bookings;
  weatherSelect.value = state.weather;
  eventSelect.value = state.event;

  renderFridgeDrawer();
  render();
}

// Event Listeners
document.querySelectorAll(".preset-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".preset-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    applyPreset(tab.dataset.preset);
  });
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

// Multi-step Undo for AI changes
document.getElementById("undoCmdBtn").addEventListener("click", () => {
  const snap = state.historyStack.pop();
  if (!snap) return;
  Object.assign(state, snap);
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

// Optional Live API Modal
const llmModal = document.getElementById("llmModal");
document.getElementById("llmConfigBtn").addEventListener("click", () => { llmModal.hidden = false; });
document.getElementById("closeModalBtn").addEventListener("click", () => { llmModal.hidden = true; });
document.getElementById("saveLlmBtn").addEventListener("click", () => {
  state.llmProvider = document.getElementById("providerSelect").value;
  state.llmKey = document.getElementById("apiKeyInput").value.trim();
  document.getElementById("engineTag").textContent = state.llmKey ? "Live LLM Ready" : "$0.000345/call";
  llmModal.hidden = true;
});

// Boot
renderFridgeDrawer();
render();
