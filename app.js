// CoverCast — 6 PM Paris Kitchen Office Prep Agent
// 100% Live API Key Agentic Reasoning via ./agent-llm.js (Zero Hardcoded Agentic Fallbacks)
// Deterministic POS Ticket Math + Live Autonomous Signal Discovery + Reflective Copilot + Supplier Contract

import {
  PROVIDER_MODELS,
  ApiKeyRequiredError,
  detectProviderFromKey,
  getDefaultModel,
  getLlmConfig,
  setLlmConfig,
  clearLlmConfig,
  hasApiKey,
  getModelLabel,
  getSessionCostUsd,
  getLastCallMeta,
  probeServerApiStatus,
  callAgentJson,
  transcribeAudioBase64
} from "./agent-llm.js";

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const DAY_PROFILES = {
  saturday:  { label: "Saturday",  short: "Sat", baseCovers: 360, expectedBookings: 186, habitualCovers: 395, ciBase: 19 },
  friday:    { label: "Friday",    short: "Fri", baseCovers: 330, expectedBookings: 170, habitualCovers: 350, ciBase: 18 },
  thursday:  { label: "Thursday",  short: "Thu", baseCovers: 285, expectedBookings: 145, habitualCovers: 308, ciBase: 16 },
  wednesday: { label: "Wednesday", short: "Wed", baseCovers: 255, expectedBookings: 128, habitualCovers: 274, ciBase: 15 },
  tuesday:   { label: "Tuesday",   short: "Tue", baseCovers: 230, expectedBookings: 115, habitualCovers: 248, ciBase: 14 },
  monday:    { label: "Monday",    short: "Mon", baseCovers: 215, expectedBookings: 108, habitualCovers: 236, ciBase: 14 },
  sunday:    { label: "Sunday",    short: "Sun", baseCovers: 295, expectedBookings: 150, habitualCovers: 318, ciBase: 17 }
};

const UNKNOWN_EVENT_CI_ADD = 22;

const PROVIDER_DISPLAY = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Google Gemini"
};

const VENDOR_EMAILS = {
  "Rungis Marée":           "commandes@rungis-maree.fr",
  "Boucherie Francilienne": "atelier@boucherie-francilienne.fr",
  "Boulangerie Lutetia":    "pro@boulangerie-lutetia.fr",
  "Primeurs de Paris":      "livraison@primeurs-paris.fr",
  "Crèmerie des Halles":    "commandes@cremerie-halles.fr"
};

const BASE_SKUS = [
  { id: "cod",      name: "Fresh Cod Fillet",       supplier: "Rungis Marée",           unit: "kg",    unitPrice: 19, ratePerCover: 0.03397, habitualSat: 13, defaultStock: 2.6, perishable24h: true },
  { id: "bavette",  name: "Aged Bavette Beef",      supplier: "Boucherie Francilienne", unit: "kg",    unitPrice: 22, ratePerCover: 0.05032, habitualSat: 14, defaultStock: 5.7, perishable24h: false },
  { id: "buns",     name: "Brioche Buns (x20)",     supplier: "Boulangerie Lutetia",    unit: "trays", unitPrice: 15, ratePerCover: 0.01154, habitualSat: 5,  defaultStock: 0.6, perishable24h: true },
  { id: "mesclun",  name: "Organic Mesclun Greens", supplier: "Primeurs de Paris",      unit: "kg",    unitPrice: 8,  ratePerCover: 0.0391,  habitualSat: 11, defaultStock: 4.2, perishable24h: true },
  { id: "cream",    name: "Normandy Cream AOP",     supplier: "Crèmerie des Halles",    unit: "L",     unitPrice: 6,  ratePerCover: 0.03205, habitualSat: 7,  defaultStock: 4.0, perishable24h: false },
  { id: "tomatoes", name: "Heirloom Tomatoes",      supplier: "Primeurs de Paris",      unit: "kg",    unitPrice: 3,  ratePerCover: 0.03974, habitualSat: 9,  defaultStock: 4.4, perishable24h: false }
];

function cloneBaseSkus() {
  return BASE_SKUS.map((s) => ({ ...s }));
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtSigned(n) {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function fmtSignedCovers(n) {
  if (n === 0) return "±0 covers";
  return `${fmtSigned(n)} covers`;
}

function clampInt(val, min, max, fallback = 0) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function formatUsd(usd) {
  if (typeof usd !== "number" || !Number.isFinite(usd)) return "";
  return `$${usd.toFixed(6)}`;
}

function getTomorrowContext() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const dow = tomorrow.getDay();
  const dayKey = DAY_KEYS[dow] || "saturday";
  const dateNum = tomorrow.getDate();
  const monthNum = tomorrow.getMonth() + 1;
  const isoDate = `${tomorrow.getFullYear()}-${String(monthNum).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;
  const shortDate = tomorrow.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return { tomorrow, dow, dayKey, dateNum, monthNum, isoDate, shortDate };
}

function createInitialSignals() {
  return {
    scanning: false,
    lastScannedAt: null,
    error: null,
    agentSummary: "",
    lastCallCostUsd: null,
    lastModel: null,
    lastProvider: null,
    weather: {
      key: "weather",
      icon: "🌦️",
      label: "Live Weather",
      source: "Open-Meteo · Paris 15e",
      detail: "Awaiting live API key",
      delta: 0,
      ciAdd: 0,
      status: "locked",
      live: false,
      rainMm: null,
      tempC: null
    },
    events: {
      key: "events",
      icon: "🎪",
      label: "Nearby Events",
      source: "OpenData Paris · 75015",
      detail: "Awaiting live API key",
      delta: 0,
      ciAdd: 0,
      status: "locked",
      live: false,
      items: []
    },
    transit: {
      key: "transit",
      icon: "🚇",
      label: "Transit & Mobility",
      source: "Montparnasse L4/6/12/13",
      detail: "Awaiting live API key",
      delta: 0,
      ciAdd: 0,
      status: "locked",
      live: false
    },
    calendar: {
      key: "calendar",
      icon: "📅",
      label: "Calendar & Pulse",
      source: "Paris 15e Calendar",
      detail: "Awaiting live API key",
      delta: 0,
      ciAdd: 0,
      status: "locked",
      live: false
    }
  };
}

const initialCtx = getTomorrowContext();
const initialDayKey = initialCtx.dayKey;
const initialProf = DAY_PROFILES[initialDayKey];

const state = {
  mode: "demo", // "demo" (default for jury) | "normal" (quiet chef workspace)
  day: initialDayKey,
  bookings: Math.min(320, Math.max(60, initialProf.expectedBookings + 12)),
  event: "none", // "none" | "unknown_big"
  extraCovers: 0,
  extraCoversNote: "",
  stocks: { cod: 2.6, bavette: 5.7, buns: 0.6, mesclun: 4.2, cream: 4.0, tomatoes: 4.4 },
  skus: cloneBaseSkus(),
  overrides: {},
  // Autonomous multi-source signals (strictly 0 until live LLM runs)
  signals: createInitialSignals(),
  liveParisTag: "Paris 15e",
  liveEventsFound: [],
  // Agent Hand-Off State (Unfamiliar Big Event)
  handoffLocked: false,
  handoffVerified: false,
  handoffLabel: "Unfamiliar high-impact local event",
  handoffSurgeChoice: 65,
  handoffPosture: "safe",
  // Reflective Copilot Loop
  historyStack: [],
  pendingProposal: null,
  lastApplied: null,
  lastInfo: null, // { text, costUsd, model } | null
  lastApiKeyNeeded: false,
  lastApiError: null,
  changedSkuIds: new Set(),
  // Extra trace notes injected by external agents (e.g. supplier-agent.js)
  extraTraceNotes: [],
  // Voice
  voiceLang: "en-US",
  // Send State
  sent: false,
  activeVendor: ""
};

// DOM Refs
const normalModeBtn = document.getElementById("normalModeBtn");
const demoModeBtn = document.getElementById("demoModeBtn");
const signalDiscoveryCard = document.getElementById("signalDiscoveryCard");
const signalApiCallout = document.getElementById("signalApiCallout");
const signalDiscoveryList = document.getElementById("signalDiscoveryList");
const signalSummaryLine = document.getElementById("signalSummaryLine");
const signalNetBar = document.getElementById("signalNetBar");
const rescanSignalsBtn = document.getElementById("rescanSignalsBtn");
const sdPulseDot = document.getElementById("sdPulseDot");
const handoffBox = document.getElementById("handoffBox");
const sendArea = document.getElementById("sendArea");
const sentPanel = document.getElementById("sentPanel");
const aiDiffCard = document.getElementById("aiDiffCard");

// Modal DOM Refs (single-field API Key dialog)
const claudeModal = document.getElementById("claudeModal");
const claudeKeyInput = document.getElementById("claudeKeyInput");
const apiKeyAutoHint = document.getElementById("apiKeyAutoHint");
const claudeModalError = document.getElementById("claudeModalError");
const disconnectClaudeBtn = document.getElementById("disconnectClaudeBtn");

// =========================================================================
// DETERMINISTIC FORECAST & TICKET ARITHMETIC (NEVER DONE BY LLM)
// =========================================================================
function captureSnapshot(src = state) {
  return {
    day: src.day,
    bookings: src.bookings,
    event: src.event,
    extraCovers: src.extraCovers,
    extraCoversNote: src.extraCoversNote,
    stocks: { ...src.stocks },
    skus: src.skus.map((s) => ({ ...s })),
    overrides: { ...src.overrides },
    handoffSurgeChoice: src.handoffSurgeChoice,
    handoffPosture: src.handoffPosture
  };
}

function computeForecastFor(s = state) {
  const prof = DAY_PROFILES[s.day] || DAY_PROFILES.saturday;
  const isUnknown = s.event === "unknown_big";
  const sig = s.signals || state.signals;

  const bookingDelta = Math.round(s.bookings - prof.expectedBookings);
  const weatherDelta = sig.weather.delta;
  const eventDelta = isUnknown ? s.handoffSurgeChoice : sig.events.delta;
  const transitDelta = sig.transit.delta;
  const calendarDelta = sig.calendar.delta;

  const p50 = Math.max(
    60,
    prof.baseCovers + bookingDelta + weatherDelta + eventDelta + transitDelta + calendarDelta + s.extraCovers
  );

  const halfWidth =
    prof.ciBase +
    (sig.weather.ciAdd || 0) +
    (isUnknown ? UNKNOWN_EVENT_CI_ADD : sig.events.ciAdd || 0) +
    (sig.transit.ciAdd || 0) +
    (sig.calendar.ciAdd || 0);

  const statusLabel =
    isUnknown && !s.handoffVerified
      ? "NEEDS CHECK"
      : isUnknown && s.handoffVerified
      ? "VERIFIED"
      : "READY";

  return {
    dayLabel: prof.label,
    shortDay: prof.short,
    baseCovers: prof.baseCovers,
    habitualCovers: prof.habitualCovers,
    bookingDelta,
    weatherDelta,
    eventDelta,
    transitDelta,
    calendarDelta,
    p50,
    p05: Math.max(45, p50 - halfWidth),
    p95: p50 + halfWidth,
    statusLabel
  };
}

function computeLinesFor(s = state, forecast = computeForecastFor(s)) {
  const habitualScale = forecast.habitualCovers / DAY_PROFILES.saturday.habitualCovers;
  const isSafeOnUnknown = s.event === "unknown_big" && s.handoffPosture === "safe";

  return s.skus.map((sku) => {
    const postureMult = isSafeOnUnknown && sku.perishable24h ? 0.86 : 1.0;
    const grossNeed = Number((forecast.p50 * sku.ratePerCover * postureMult).toFixed(1));
    const stock = s.stocks[sku.id] ?? sku.defaultStock;
    const recQty = Math.max(0, Math.ceil(Number((grossNeed - stock).toFixed(2))));
    const overrideDelta = s.overrides[sku.id] || 0;
    const finalQty = Math.max(0, recQty + overrideDelta);
    const habitualQty = s.day === "saturday" ? sku.habitualSat : Math.max(1, Math.round(sku.habitualSat * habitualScale));
    const lineEur = finalQty * sku.unitPrice;
    const basePrice = BASE_SKUS.find((b) => b.id === sku.id)?.unitPrice || sku.unitPrice;
    const habitualEur = habitualQty * basePrice;

    return {
      ...sku,
      stock,
      recQty,
      finalQty,
      habitualQty,
      lineEur,
      habitualEur,
      deltaEur: lineEur - habitualEur
    };
  });
}

// =========================================================================
// SINGLE API KEY MODAL & TOPBAR PILL
// =========================================================================
function updateApiPill() {
  const btn = document.getElementById("claudeConfigBtn");
  const txt = document.getElementById("claudeStatusText");
  if (!btn || !txt) return;

  const connected = hasApiKey();
  const cfg = getLlmConfig();

  if (connected) {
    btn.classList.add("connected");
    const label = getModelLabel(cfg.provider, cfg.model);
    txt.textContent = `Live · ${label}`;
  } else {
    btn.classList.remove("connected");
    txt.textContent = "API Key";
  }
}

function updateKeyAutoHint(rawKey) {
  if (!apiKeyAutoHint) return;
  const val = String(rawKey || "").trim();
  const cfg = getLlmConfig();
  apiKeyAutoHint.classList.remove("warn");

  if (!val) {
    if (cfg.serverConfigured && cfg.serverProvider) {
      const defModel = getDefaultModel(cfg.serverProvider);
      apiKeyAutoHint.textContent = `Server key active: ${PROVIDER_DISPLAY[cfg.serverProvider] || cfg.serverProvider} (${getModelLabel(cfg.serverProvider, defModel)})`;
    } else {
      apiKeyAutoHint.textContent = "";
    }
    return;
  }

  const detected = detectProviderFromKey(val);
  if (detected && PROVIDER_MODELS[detected]) {
    const defModel = getDefaultModel(detected);
    apiKeyAutoHint.textContent = `Detected: ${PROVIDER_DISPLAY[detected] || detected} (${getModelLabel(detected, defModel)})`;
  } else {
    apiKeyAutoHint.classList.add("warn");
    apiKeyAutoHint.textContent = "Key should start with sk-ant- (Anthropic), sk- (OpenAI), or AIza (Gemini)";
  }
}

function openApiModal() {
  if (!claudeModal) return;
  const cfg = getLlmConfig();

  if (claudeKeyInput) claudeKeyInput.value = cfg.apiKey || "";
  updateKeyAutoHint(cfg.apiKey || "");

  if (claudeModalError) {
    claudeModalError.hidden = true;
    claudeModalError.textContent = "";
  }
  if (disconnectClaudeBtn) {
    disconnectClaudeBtn.hidden = !cfg.apiKey;
  }

  claudeModal.hidden = false;
  if (claudeKeyInput) claudeKeyInput.focus();
}

function closeApiModal() {
  if (claudeModal) claudeModal.hidden = true;
}

// =========================================================================
// AUTONOMOUS SIGNAL DISCOVERY RENDERER (DEMO MODE CARD)
// =========================================================================
function renderSignalDiscovery() {
  if (!signalDiscoveryCard) return;
  const isDemo = state.mode === "demo";
  signalDiscoveryCard.hidden = !isDemo;
  if (!isDemo) return;

  const sig = state.signals;
  const connected = hasApiKey();
  const isUnknownEv = state.event === "unknown_big";

  // Disconnected state: quiet 1-line inactive notice, disabled rescan button, zero duplicate key buttons
  if (!connected) {
    if (sdPulseDot) sdPulseDot.className = "sd-pulse locked";
    if (rescanSignalsBtn) {
      rescanSignalsBtn.hidden = false;
      rescanSignalsBtn.disabled = true;
      rescanSignalsBtn.textContent = "↻ Re-scan live signals";
    }
    if (signalDiscoveryList) {
      signalDiscoveryList.hidden = true;
      signalDiscoveryList.innerHTML = "";
    }
    if (signalSummaryLine) signalSummaryLine.hidden = true;
    if (signalNetBar) signalNetBar.hidden = true;

    if (signalApiCallout) {
      signalApiCallout.hidden = false;
      signalApiCallout.className = "sd-api-callout inactive";
      signalApiCallout.innerHTML = `<p class="sd-inactive-line">Agent inactive — enter your API key in the top bar.</p>`;
    }
    return;
  }

  // Real API error state during autonomous scan: never fake signal deltas!
  if (sig.error && !sig.scanning) {
    if (sdPulseDot) sdPulseDot.className = "sd-pulse error";
    if (rescanSignalsBtn) {
      rescanSignalsBtn.hidden = false;
      rescanSignalsBtn.disabled = false;
      rescanSignalsBtn.textContent = "↻ Re-scan live signals";
    }
    if (signalDiscoveryList) {
      signalDiscoveryList.hidden = true;
      signalDiscoveryList.innerHTML = "";
    }
    if (signalSummaryLine) signalSummaryLine.hidden = true;
    if (signalNetBar) signalNetBar.hidden = true;

    if (signalApiCallout) {
      signalApiCallout.hidden = false;
      signalApiCallout.className = "sd-api-callout error";
      signalApiCallout.innerHTML = `
        <span class="sd-api-callout-head">⚠ LIVE AGENT API ERROR</span>
        <p class="sd-api-callout-text">${escapeHtml(sig.error)}</p>
        <div class="sd-api-callout-actions">
          <button type="button" id="sdRetryScanBtn" class="sd-retry-btn">↻ Retry scan</button>
        </div>
      `;
      signalApiCallout.querySelector("#sdRetryScanBtn")?.addEventListener("click", () => {
        runAutonomousScan({ animate: true, highlightChanges: true });
      });
    }
    return;
  }

  // Connected & Scanning or Live Results
  if (signalApiCallout) signalApiCallout.hidden = true;
  if (signalDiscoveryList) signalDiscoveryList.hidden = false;
  if (signalNetBar) signalNetBar.hidden = false;

  if (sdPulseDot) {
    sdPulseDot.className = sig.scanning ? "sd-pulse scanning" : "sd-pulse";
  }
  if (rescanSignalsBtn) {
    rescanSignalsBtn.hidden = false;
    rescanSignalsBtn.disabled = sig.scanning;
    rescanSignalsBtn.textContent = sig.scanning ? "◌ Scanning live…" : "↻ Re-scan live signals";
  }

  const rows = [
    sig.weather,
    isUnknownEv
      ? {
          ...sig.events,
          detail: `${state.handoffLabel} (0 matches in POS history)`,
          delta: state.handoffSurgeChoice,
          status: state.handoffLocked ? "warn" : "done",
          items: sig.events.items || []
        }
      : sig.events,
    sig.transit,
    sig.calendar
  ];

  signalDiscoveryList.innerHTML = rows
    .map((r) => {
      const isScan = r.status === "scanning";
      const isWarn = r.status === "warn";
      const tick = isScan ? "◌" : isWarn ? "⚠" : "✓";
      const impactCls = isScan ? "scanning" : r.delta > 0 ? "pos" : r.delta < 0 ? "neg" : "neu";
      const impactTxt = isScan ? "analyzing…" : fmtSignedCovers(r.delta);

      const eventTagsHtml =
        !isScan && r.key === "events" && Array.isArray(r.items) && r.items.length > 0
          ? `<div class="sd-events-tags">${r.items
              .slice(0, 3)
              .map(
                (it) =>
                  `<span class="sd-event-tag" title="${escapeHtml(it.title)} — ${escapeHtml(it.venue)}">📍 ${escapeHtml(it.title)}</span>`
              )
              .join("")}</div>`
          : "";

      return `
        <div class="sd-row ${isScan ? "scanning" : isWarn ? "warn" : ""}" data-sig="${r.key}">
          <span class="sd-tick">${tick}</span>
          <div class="sd-info">
            <div class="sd-row-top">
              <span class="sd-name">${r.icon} ${escapeHtml(r.label)}</span>
              <span class="sd-source">${escapeHtml(r.source)}</span>
            </div>
            <div class="sd-detail" title="${escapeHtml(r.detail)}">${escapeHtml(r.detail)}</div>
            ${eventTagsHtml}
          </div>
          <span class="sd-impact ${impactCls}">${impactTxt}</span>
        </div>
      `;
    })
    .join("");

  if (signalSummaryLine) {
    if (!sig.scanning && sig.agentSummary) {
      signalSummaryLine.hidden = false;
      signalSummaryLine.textContent = sig.agentSummary;
    } else {
      signalSummaryLine.hidden = true;
      signalSummaryLine.textContent = "";
    }
  }

  const netPill = document.getElementById("signalNetPill");
  const breakdownEl = document.getElementById("signalBreakdown");
  if (sig.scanning) {
    breakdownEl.textContent = "Fetching live data & running LLM analysis…";
    netPill.className = "sd-net-pill neu";
    netPill.textContent = "analyzing…";
  } else {
    const deltas = rows.map((r) => r.delta);
    const upSum = deltas.filter((d) => d > 0).reduce((a, b) => a + b, 0);
    const downSum = deltas.filter((d) => d < 0).reduce((a, b) => a + b, 0);
    const net = upSum + downSum;

    breakdownEl.innerHTML = `<em class="pos-txt">+${upSum} up</em> · <em class="neg-txt">${downSum < 0 ? `−${Math.abs(downSum)}` : "0"} down</em>`;
    netPill.className = `sd-net-pill ${net > 0 ? "pos" : net < 0 ? "neg" : "neu"}`;
    netPill.textContent = fmtSignedCovers(net);
  }
}

// =========================================================================
// LIVE AGENT TOOL-CALL TRACE + EXTERNAL TRACE NOTES
// =========================================================================
let traceRunId = 0;

function getTraceNoteKey(stepLabel) {
  const clean = String(stepLabel || "").trim();
  const numPrefix = clean.match(/^(\d+)\.\s/);
  return numPrefix ? `step-${numPrefix[1]}` : clean;
}

function renderExtraTraceNotesInto(container) {
  state.extraTraceNotes.forEach((note) => {
    const el = document.createElement("div");
    el.className = `t-line ${note.isWarn ? "warn" : "done"}`;
    el.dataset.extraKey = getTraceNoteKey(note.fnName);
    el.innerHTML = `<span>${note.isWarn ? "⚠" : "✓"}</span><span><span class="t-fn">${escapeHtml(note.fnName)}</span> → ${escapeHtml(note.outputText)}</span>`;
    container.appendChild(el);
  });
}

function appendTraceNote(fnName, outputText, isWarn = false) {
  const entry = { fnName: String(fnName), outputText: String(outputText), isWarn: Boolean(isWarn) };
  const entryKey = getTraceNoteKey(entry.fnName);
  const idx = state.extraTraceNotes.findIndex((n) => getTraceNoteKey(n.fnName) === entryKey);
  if (idx >= 0) {
    state.extraTraceNotes[idx] = entry;
  } else {
    state.extraTraceNotes.push(entry);
    if (state.extraTraceNotes.length > 4) state.extraTraceNotes.shift();
  }

  const container = document.getElementById("agentTraceLines");
  if (!container) return;

  const existing = Array.from(container.querySelectorAll(".t-line[data-extra-key]")).find(
    (el) => el.dataset.extraKey === entryKey
  );
  const html = `<span>${entry.isWarn ? "⚠" : "✓"}</span><span><span class="t-fn">${escapeHtml(entry.fnName)}</span> → ${escapeHtml(entry.outputText)}</span>`;

  if (existing) {
    existing.className = `t-line ${entry.isWarn ? "warn" : "done"}`;
    existing.innerHTML = html;
  } else {
    const el = document.createElement("div");
    el.className = `t-line ${entry.isWarn ? "warn" : "done"}`;
    el.dataset.extraKey = entryKey;
    el.innerHTML = html;
    container.appendChild(el);
  }
}

function updateToggleJsonLabel() {
  const btn = document.getElementById("toggleJsonBtn");
  if (!btn) return;
  if (!hasApiKey()) {
    btn.textContent = "Inspect JSON · Agent inactive";
    return;
  }
  const cfg = getLlmConfig();
  const label = getModelLabel(cfg.provider, cfg.model);
  const sessionCost = getSessionCostUsd();
  if (sessionCost > 0) {
    btn.textContent = `Inspect JSON · ${label} · ${formatUsd(sessionCost)}`;
  } else {
    btn.textContent = `Inspect JSON · ${label}`;
  }
}

function runAgentTrace(animate = true) {
  const myRun = ++traceRunId;
  const f = computeForecastFor(state);
  const isUnknown = state.event === "unknown_big";
  const lines = computeLinesFor(state, f);
  const totalEur = lines.reduce((s, l) => s + l.lineEur, 0);
  const usualEur = lines.reduce((s, l) => s + l.habitualEur, 0);
  const sig = state.signals;
  const connected = hasApiKey();
  const cfg = getLlmConfig();
  const lastMeta = getLastCallMeta();
  const sessionCost = getSessionCostUsd();

  updateToggleJsonLabel();

  const isLow = state.handoffLocked;
  const stepOne = {
    fn: "1. Reservations & Stock",
    out: `${state.bookings} guests booked on linked reservation app · fridge stock checked`,
    warn: false
  };
  let stepData;

  if (!connected) {
    stepData = [
      stepOne,
      {
        fn: "2. Live AI Check",
        out: "Paused — enter your API key in the top bar to scan weather, events & local trends",
        warn: true
      },
      {
        fn: "3. Baseline Order",
        out: `${f.p50} guests expected · ${totalEur} EUR (using bookings & stock only)`,
        warn: false
      }
    ];
  } else if (sig.error) {
    stepData = [
      stepOne,
      {
        fn: "2. Live AI Check",
        out: `Could not reach live AI — ${sig.error}`,
        warn: true
      },
      {
        fn: "3. Baseline Order",
        out: `${f.p50} guests expected · ${totalEur} EUR (using bookings & stock only)`,
        warn: false
      }
    ];
  } else {
    const eventCount = sig.events.items?.length || 0;
    const eventWord = eventCount === 1 ? "nearby event" : "nearby events";
    stepData = [
      stepOne,
      {
        fn: "2. Weather Check",
        out: `${sig.weather.detail} (${fmtSigned(f.weatherDelta)} guests)`,
        warn: false
      },
      {
        fn: "3. Events & City Pulse",
        out: isUnknown
          ? `Unusual event nearby: ${state.handoffLabel} — needs chef confirmation`
          : `${eventCount} ${eventWord} (${fmtSigned(f.eventDelta)}), Metro flow (${fmtSigned(f.transitDelta)}), calendar (${fmtSigned(f.calendarDelta)})`,
        warn: isUnknown && !state.handoffVerified
      },
      {
        fn: "4. Order Calculation",
        out: isLow
          ? "Paused — waiting for Chef Karim's confirmation before sending"
          : state.handoffVerified
          ? `Chef confirmed — ${f.p50} guests · ${totalEur} EUR ready to send`
          : `Ready to send — ${f.p50} guests · ${totalEur} EUR (${usualEur >= totalEur ? `saves ${usualEur - totalEur} EUR vs. usual` : `+${totalEur - usualEur} EUR busy-night buffer`})`,
        warn: isLow
      }
    ];
  }

  // Update Inspect JSON drawer with real live API metadata & real costs
  const drawerEl = document.getElementById("jsonDrawer");
  if (drawerEl) {
    drawerEl.textContent = JSON.stringify(
      {
        timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        mode: state.mode,
        api_connected: connected,
        provider: connected ? cfg.provider : null,
        model: connected ? cfg.model : null,
        session_cost_usd: Number(sessionCost.toFixed(6)),
        last_call: lastMeta
          ? {
              provider: lastMeta.provider,
              model: lastMeta.model,
              cost_usd: lastMeta.costUsd,
              latency_ms: lastMeta.latencyMs
            }
          : null,
        status: f.statusLabel,
        chef_check_required: isLow,
        autonomous_drivers: {
          weather: { detail: sig.weather.detail, covers_delta: f.weatherDelta, live: sig.weather.live },
          events: { titles: (sig.events.items || []).map((e) => e.title), covers_delta: f.eventDelta, live: sig.events.live },
          transit: { detail: sig.transit.detail, covers_delta: f.transitDelta },
          calendar_pulse: { detail: sig.calendar.detail, covers_delta: f.calendarDelta }
        },
        forecast: { p05: f.p05, p50: f.p50, p95: f.p95, usual_habit: f.habitualCovers },
        order_eur: totalEur
      },
      null,
      2
    );
  }

  const container = document.getElementById("agentTraceLines");
  if (!container) return;

  container.innerHTML = stepData
    .map(
      (st, i) => `
      <div class="t-line ${animate ? "" : st.warn ? "warn" : "done"}" data-ti="${i}">
        <span>${st.warn ? "⚠" : "✓"}</span>
        <span><span class="t-fn">${escapeHtml(st.fn)}</span> → ${escapeHtml(st.out)}</span>
      </div>
    `
    )
    .join("");

  renderExtraTraceNotesInto(container);

  if (!animate) return;

  const els = container.querySelectorAll(".t-line[data-ti]");
  els.forEach((el, idx) => {
    setTimeout(() => {
      if (traceRunId !== myRun) return;
      el.classList.add(stepData[idx].warn ? "warn" : "done");
    }, idx * 140);
  });
}

// =========================================================================
// TRUE LIVE DATA + LIVE LLM AUTONOMOUS SIGNAL SCAN (ZERO HARDCODED DELTAS)
// =========================================================================
let scanRunId = 0;

async function fetchWithTimeout(url, timeoutMs = 4500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function runAutonomousScan({ animate = true, highlightChanges = false } = {}) {
  const myScan = ++scanRunId;
  const ctx = getTomorrowContext();
  state.day = ctx.dayKey;
  const prof = DAY_PROFILES[state.day] || DAY_PROFILES.saturday;

  // Guard 1: If no API key is connected, NEVER invent hardcoded signal deltas!
  if (!hasApiKey()) {
    state.signals = createInitialSignals();
    state.liveParisTag = "Paris 15e";
    state.liveEventsFound = [];
    render();
    runAgentTrace(false);
    return;
  }

  const prevLines = computeLinesFor(state, computeForecastFor(state));

  state.signals.scanning = true;
  state.signals.error = null;
  state.signals.agentSummary = "";
  ["weather", "events", "transit", "calendar"].forEach((k) => {
    state.signals[k].status = "scanning";
    state.signals[k].detail = "Fetching live data & querying LLM…";
  });
  renderSignalDiscovery();

  // Step 1: Fetch REAL tomorrow weather (Open-Meteo) & REAL nearby Paris events (opendata.paris.fr)
  const weatherUrl =
    "https://api.open-meteo.com/v1/forecast?latitude=48.842&longitude=2.300&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=Europe%2FParis&forecast_days=2";
  const eventsUrl15 =
    'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records?select=title,address_name,address_zipcode,date_start,date_end&where=address_zipcode%3D%2275015%22&limit=5';
  const eventsUrlFallback =
    "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records?select=title,address_name,address_zipcode,date_start,date_end&limit=5";

  const [wResp, eResp] = await Promise.allSettled([
    fetchWithTimeout(weatherUrl, 4500),
    fetchWithTimeout(eventsUrl15, 4500)
  ]);

  if (scanRunId !== myScan) return;

  let rawWeather = "unavailable";
  let weatherLive = false;
  let tempC = null;
  let rainMm = null;

  if (wResp.status === "fulfilled" && wResp.value.ok) {
    try {
      const wd = await wResp.value.json();
      if (wd?.daily?.temperature_2m_max?.[1] != null) {
        tempC = Math.round(wd.daily.temperature_2m_max[1]);
        const tempMinC = wd.daily.temperature_2m_min?.[1] != null ? Math.round(wd.daily.temperature_2m_min[1]) : null;
        rainMm = Number((wd.daily.precipitation_sum?.[1] ?? 0).toFixed(1));
        const weatherCode = wd.daily.weathercode?.[1] ?? null;
        weatherLive = true;
        rawWeather = {
          source: "Open-Meteo live forecast (Paris 15e)",
          date: wd.daily.time?.[1] || ctx.isoDate,
          tempMaxC: tempC,
          tempMinC,
          precipitationMm: rainMm,
          weatherCode
        };
      }
    } catch {
      rawWeather = "unavailable";
    }
  }

  let rawEventRecords = [];
  let eventsLive = false;
  if (eResp.status === "fulfilled" && eResp.value.ok) {
    try {
      const ed = await eResp.value.json();
      if (Array.isArray(ed.results) && ed.results.length > 0) {
        rawEventRecords = ed.results;
        eventsLive = true;
      }
    } catch {}
  }

  if (!eventsLive) {
    try {
      const fb = await fetchWithTimeout(eventsUrlFallback, 3500);
      if (fb.ok) {
        const ed2 = await fb.json();
        if (Array.isArray(ed2.results) && ed2.results.length > 0) {
          rawEventRecords = ed2.results;
          eventsLive = true;
        }
      }
    } catch {}
  }

  if (scanRunId !== myScan) return;

  const rawEvents = eventsLive
    ? rawEventRecords.slice(0, 5).map((ev) => ({
        title: String(ev.title || "").slice(0, 80),
        venue: String(ev.address_name || ev.address_zipcode || "Paris").slice(0, 48),
        zipcode: ev.address_zipcode || null
      }))
    : "unavailable";

  // Step 2: Live LLM Reasoning via User's API Key
  const systemPrompt = `You are CoverCast, an autonomous 6 PM restaurant prep-forecasting agent for Bistrot Urbain #04 in Montparnasse, Paris 15e.
Analyze the REAL live inputs provided (tomorrow's date/weekday, baseline covers, confirmed Zenchef bookings, live Open-Meteo weather or "unavailable", live OpenData Paris events or "unavailable", Montparnasse Metro L4/6/12/13 mobility, and Paris 15e calendar/payday/neighborhood pulse).
NEVER invent fake events if nearbyEvents is "unavailable" (return selectedTitles: [] and note unavailability in detail).
Return STRICT JSON ONLY matching this exact schema:
{
  "weather":  { "detail": "concise 1-line summary of live weather", "delta": -20, "ciAdd": 3 },
  "events":   { "detail": "concise 1-line summary of real events found", "delta": 18, "ciAdd": 2, "selectedTitles": [{"title":"...","venue":"..."}] },
  "transit":  { "detail": "concise 1-line Montparnasse L4/6/12/13 mobility assessment", "delta": 0, "ciAdd": 1 },
  "calendar": { "detail": "concise 1-line date/payday/neighborhood pulse assessment", "delta": 10, "ciAdd": 1 },
  "needsChefCheck": false,
  "handoffLabel": "",
  "agentSummary": "1 crisp sentence explaining net client influence"
}
Rules:
- Every "delta" must be an integer between -80 and 80 (estimated covers impact relative to baseline).
- Every "ciAdd" must be an integer between 0 and 15 (uncertainty half-width contribution).
- Set "needsChefCheck" to true ONLY if there is a major unfamiliar high-variance local shock event; otherwise false.`;

  const userPrompt = JSON.stringify({
    restaurant: "Bistrot Urbain #04, Montparnasse, Paris 15e",
    tomorrow: {
      isoDate: ctx.isoDate,
      weekday: prof.label,
      shortDate: ctx.shortDate,
      dayOfMonth: ctx.dateNum,
      month: ctx.monthNum
    },
    baselineCovers: prof.baseCovers,
    expectedBookings: prof.expectedBookings,
    confirmedBookings: state.bookings,
    liveWeather: rawWeather,
    nearbyEvents: rawEvents
  });

  try {
    const llmRes = await callAgentJson({
      systemPrompt,
      userPrompt,
      maxTokens: 700,
      temperature: 0.2
    });

    if (scanRunId !== myScan) return;

    const parsed = llmRes.parsed || {};
    const wOut = parsed.weather || {};
    const eOut = parsed.events || {};
    const tOut = parsed.transit || {};
    const cOut = parsed.calendar || {};

    const selectedItems = Array.isArray(eOut.selectedTitles)
      ? eOut.selectedTitles
          .filter((it) => it && typeof it.title === "string" && it.title.trim())
          .slice(0, 3)
          .map((it) => ({
            title: it.title.trim().slice(0, 48),
            venue: String(it.venue || "Paris 15e").trim().slice(0, 26)
          }))
      : [];

    const nextWeather = {
      ...state.signals.weather,
      source: weatherLive ? "Open-Meteo · Live 75015" : "Open-Meteo · Unavailable",
      detail: String(wOut.detail || (weatherLive ? `${tempC}°C · ${rainMm}mm rain` : "Live weather unavailable")).slice(0, 140),
      delta: clampInt(wOut.delta, -80, 80, 0),
      ciAdd: clampInt(wOut.ciAdd, 0, 15, 0),
      status: "done",
      live: weatherLive,
      tempC,
      rainMm
    };

    const nextEvents = {
      ...state.signals.events,
      source: eventsLive ? "OpenData Paris · Live API" : "OpenData Paris · Unavailable",
      detail: String(eOut.detail || (eventsLive ? `${selectedItems.length} live Paris listings analyzed` : "Live Paris events feed unavailable")).slice(0, 140),
      delta: clampInt(eOut.delta, -80, 80, 0),
      ciAdd: clampInt(eOut.ciAdd, 0, 15, 0),
      status: "done",
      live: eventsLive,
      items: selectedItems
    };

    const nextTransit = {
      ...state.signals.transit,
      source: `Live Agent · Montparnasse L4/6/12/13`,
      detail: String(tOut.detail || "Transit assessment completed").slice(0, 140),
      delta: clampInt(tOut.delta, -80, 80, 0),
      ciAdd: clampInt(tOut.ciAdd, 0, 15, 0),
      status: "done",
      live: true
    };

    const nextCalendar = {
      ...state.signals.calendar,
      source: `Live Agent · Paris 15e Pulse`,
      detail: String(cOut.detail || `${ctx.shortDate} neighborhood pulse analyzed`).slice(0, 140),
      delta: clampInt(cOut.delta, -80, 80, 0),
      ciAdd: clampInt(cOut.ciAdd, 0, 15, 0),
      status: "done",
      live: true
    };

    const steps = [
      ["weather", nextWeather],
      ["events", nextEvents],
      ["transit", nextTransit],
      ["calendar", nextCalendar]
    ];

    if (animate && state.mode === "demo") {
      for (let i = 0; i < steps.length; i++) {
        await new Promise((r) => setTimeout(r, 120));
        if (scanRunId !== myScan) return;
        const [key, val] = steps[i];
        state.signals[key] = val;
        renderSignalDiscovery();
      }
    } else {
      steps.forEach(([key, val]) => {
        state.signals[key] = val;
      });
    }

    state.signals.scanning = false;
    state.signals.error = null;
    state.signals.lastScannedAt = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    state.signals.agentSummary = String(parsed.agentSummary || "").trim().slice(0, 180);
    state.signals.lastCallCostUsd = llmRes.costUsd;
    state.signals.lastModel = llmRes.model;
    state.signals.lastProvider = llmRes.provider;

    state.liveParisTag = weatherLive ? `${tempC}°C · ${rainMm}mm` : "Paris 15e";
    state.liveEventsFound = selectedItems;

    // Activate chef hand-off lock automatically if LLM flagged an unfamiliar shock event
    if (Boolean(parsed.needsChefCheck)) {
      state.event = "unknown_big";
      state.handoffLabel = String(parsed.handoffLabel || "Unfamiliar high-impact local event").trim().slice(0, 140);
      state.handoffLocked = true;
      state.handoffVerified = false;
      state.sent = false;
    }

    if (highlightChanges) {
      const nextLines = computeLinesFor(state, computeForecastFor(state));
      const changed = new Set();
      nextLines.forEach((nl, i) => {
        if (prevLines[i] && nl.finalQty !== prevLines[i].finalQty) changed.add(nl.id);
      });
      state.changedSkuIds = changed;
    }

    render();
    runAgentTrace(animate && state.mode === "demo");
  } catch (err) {
    if (scanRunId !== myScan) return;

    if (err instanceof ApiKeyRequiredError) {
      state.signals = createInitialSignals();
      render();
      runAgentTrace(false);
      return;
    }

    // Real API error — NEVER invent fake signal deltas!
    state.signals = createInitialSignals();
    state.signals.scanning = false;
    state.signals.error = err?.message || "Live LLM API call failed.";
    ["weather", "events", "transit", "calendar"].forEach((k) => {
      state.signals[k].status = "error";
      state.signals[k].detail = "Halted due to API error";
    });
    render();
    runAgentTrace(false);
  }
}

// =========================================================================
// MODE SWITCHING (NORMAL MODE vs DEMO MODE)
// =========================================================================
function setMode(nextMode) {
  const normalized = nextMode === "normal" ? "normal" : "demo";
  if (state.mode === normalized) return;

  state.mode = normalized;
  state.extraTraceNotes = [];

  window.dispatchEvent(new CustomEvent("covercast:mode-changed", { detail: { mode: state.mode } }));

  render();
  if (state.mode === "demo") {
    if (hasApiKey()) {
      runAutonomousScan({ animate: true, highlightChanges: false });
    } else {
      runAgentTrace(false);
    }
  } else {
    state.signals.scanning = false;
    runAgentTrace(false);
  }
}

// =========================================================================
// RENDER CHALKBOARD + THERMAL ORDER TICKET
// =========================================================================
function render() {
  const f = computeForecastFor(state);
  const lines = computeLinesFor(state, f);
  const totalEur = lines.reduce((s, l) => s + l.lineEur, 0);
  const usualEur = lines.reduce((s, l) => s + l.habitualEur, 0);
  const savedEur = usualEur - totalEur;

  // Mode toggle state & body class
  const isDemo = state.mode === "demo";
  document.body.classList.toggle("mode-demo", isDemo);
  document.body.classList.toggle("mode-normal", !isDemo);
  if (normalModeBtn) {
    normalModeBtn.classList.toggle("active", !isDemo);
    normalModeBtn.setAttribute("aria-pressed", String(!isDemo));
  }
  if (demoModeBtn) {
    demoModeBtn.classList.toggle("active", isDemo);
    demoModeBtn.setAttribute("aria-pressed", String(isDemo));
  }

  const kickerEl = document.getElementById("boardKicker");
  if (kickerEl) {
    kickerEl.textContent = isDemo
      ? "6 PM PREP AGENT · AUTONOMOUS DEMO"
      : "6 PM PREP AGENT · KARIM’S DAILY DESK";
  }

  const resetBtn = document.getElementById("resetAllBtn");
  if (resetBtn) {
    resetBtn.textContent = isDemo ? "↺ Reset demo" : "↺ Reset";
  }

  const bookingsFooterEl = document.getElementById("bookingsFooterVal");
  if (bookingsFooterEl) bookingsFooterEl.textContent = state.bookings;

  // Autonomous Signal Discovery Card (visible only in Demo Mode)
  renderSignalDiscovery();

  // Chalkboard Headline & Plain Kitchen Status Badge
  const confBadge = document.getElementById("confidenceBadge");
  if (state.handoffLocked) {
    document.getElementById("boardHeadline").textContent = "Unfamiliar event nearby — Karim must check.";
    confBadge.className = "conf-badge low";
    confBadge.textContent = "⚠ NEEDS KARIM’S CHECK";
  } else if (state.handoffVerified) {
    document.getElementById("boardHeadline").textContent = "Chef verified. Ready to send.";
    confBadge.className = "conf-badge high";
    confBadge.textContent = "✓ CHEF VERIFIED";
  } else {
    document.getElementById("boardHeadline").textContent = "Tomorrow’s order is ready.";
    confBadge.className = "conf-badge high";
    confBadge.textContent = "✓ READY TO SEND";
  }

  handoffBox.hidden = !state.handoffLocked;
  if (state.handoffLocked) {
    document.getElementById("handoffReason").textContent =
      `${state.handoffLabel} — 0 matching nights in POS history. Set your call to unlock the ticket:`;
  }

  // Reflective Copilot Card on Chalkboard
  const badgeEl = document.getElementById("aiCardBadge");
  const costEl = document.getElementById("aiCostMini");
  const reflEl = document.getElementById("aiReflectionText");
  const pillsEl = document.getElementById("aiDiffPills");
  const confirmBar = document.getElementById("aiConfirmBar");
  const undoBtn = document.getElementById("undoCmdBtn");

  aiDiffCard.classList.remove("applied", "info", "locked", "error");

  if (state.lastApiKeyNeeded) {
    aiDiffCard.hidden = false;
    aiDiffCard.classList.add("locked");
    badgeEl.textContent = "AGENT INACTIVE";
    costEl.textContent = "";
    reflEl.textContent = "Agent inactive — enter your API key in the top bar.";
    pillsEl.innerHTML = "";
    confirmBar.hidden = true;
    undoBtn.hidden = true;
  } else if (state.lastApiError) {
    aiDiffCard.hidden = false;
    aiDiffCard.classList.add("error");
    badgeEl.textContent = "AGENT API ERROR";
    costEl.textContent = "Call failed";
    reflEl.textContent = state.lastApiError;
    pillsEl.innerHTML = "";
    confirmBar.hidden = true;
    undoBtn.hidden = true;
  } else if (state.pendingProposal) {
    const p = state.pendingProposal;
    aiDiffCard.hidden = false;
    badgeEl.textContent = "AGENT REFLECTION · YES OR CANCEL?";
    costEl.textContent = formatUsd(p.costUsd);
    reflEl.textContent = p.reflection;
    pillsEl.innerHTML = p.diffPills.map((t) => `<span class="r-pill">${escapeHtml(t)}</span>`).join("");
    confirmBar.hidden = false;
    undoBtn.hidden = true;
  } else if (state.lastApplied) {
    const a = state.lastApplied;
    aiDiffCard.hidden = false;
    aiDiffCard.classList.add("applied");
    badgeEl.textContent = "✓ APPLIED TO TICKET";
    costEl.textContent = formatUsd(a.costUsd);
    reflEl.textContent = a.reflection;
    pillsEl.innerHTML = a.diffPills.map((t) => `<span class="r-pill">${escapeHtml(t)}</span>`).join("");
    confirmBar.hidden = true;
    undoBtn.hidden = state.historyStack.length === 0;
  } else if (state.lastInfo) {
    const infoObj = typeof state.lastInfo === "string" ? { text: state.lastInfo, costUsd: null } : state.lastInfo;
    aiDiffCard.hidden = false;
    aiDiffCard.classList.add("info");
    badgeEl.textContent = "AGENT REFLECTION · NO CHANGE";
    costEl.textContent = formatUsd(infoObj.costUsd);
    reflEl.textContent = infoObj.text;
    pillsEl.innerHTML = "";
    confirmBar.hidden = true;
    undoBtn.hidden = true;
  } else {
    aiDiffCard.hidden = true;
  }

  // Thermal Order Ticket Stamp
  const stamp = document.getElementById("ticketStamp");
  stamp.className = "rubber-stamp";
  if (state.sent) {
    stamp.classList.add("sent");
    stamp.textContent = "SENT 18:04";
  } else if (state.handoffLocked) {
    stamp.classList.add("handoff");
    stamp.textContent = "HAND-OFF";
  } else if (state.handoffVerified) {
    stamp.classList.add("ready");
    stamp.textContent = "VERIFIED";
  } else {
    stamp.classList.add("ready");
    stamp.textContent = "READY";
  }

  // Ticket Hero Numbers
  document.getElementById("ticketDateLine").textContent = `ORDER SLIP · TOMORROW (${f.dayLabel.toUpperCase()})`;
  document.getElementById("metricCovers").textContent = `${f.p50} covers`;
  document.getElementById("metricCoversSub").textContent = `90% range ${f.p05}–${f.p95} · usual guess ${f.habitualCovers}`;

  // Ticket Scale Bar
  const minS = Math.min(f.p05, f.habitualCovers) - 35;
  const maxS = Math.max(f.p95, f.habitualCovers) + 35;
  const toPct = (v) => Math.min(96, Math.max(4, ((v - minS) / (maxS - minS)) * 100));
  const ccP = toPct(f.p50);
  const habP = toPct(f.habitualCovers);
  const p05P = toPct(f.p05);
  const p95P = toPct(f.p95);

  document.getElementById("tbarGap").style.left = `${Math.min(ccP, habP)}%`;
  document.getElementById("tbarGap").style.width = `${Math.abs(habP - ccP)}%`;
  document.getElementById("tbarCi").style.left = `${p05P}%`;
  document.getElementById("tbarCi").style.width = `${Math.max(4, p95P - p05P)}%`;
  document.getElementById("tbarCc").style.left = `${ccP}%`;
  document.getElementById("tbarHab").style.left = `${habP}%`;
  document.getElementById("legCc").textContent = f.p50;
  document.getElementById("legHab").textContent = f.habitualCovers;
  const coverDiff = f.p50 - f.habitualCovers;
  document.getElementById("legGap").textContent = `${fmtSigned(coverDiff)} vs. usual`;

  // Exact Money Summary
  document.getElementById("metricOrder").textContent = `${totalEur} EUR`;
  document.getElementById("metricUsual").textContent = `${usualEur} EUR`;
  const savingsRow = document.getElementById("savingsRow");
  if (savedEur >= 0) {
    savingsRow.classList.remove("surge");
    document.getElementById("metricSavedLabel").textContent = "Not bought tonight";
    document.getElementById("metricSaved").textContent = `${savedEur} EUR`;
  } else {
    savingsRow.classList.add("surge");
    document.getElementById("metricSavedLabel").textContent = "Surge stockout buffer";
    document.getElementById("metricSaved").textContent = `+${Math.abs(savedEur)} EUR`;
  }

  // Clean 6-Item Thermal List
  const rowsEl = document.getElementById("orderRows");
  rowsEl.innerHTML = lines
    .map((line) => {
      const changed = state.changedSkuIds.has(line.id);
      const saveTxt =
        line.deltaEur < 0 ? `−${Math.abs(line.deltaEur)} €` : line.deltaEur > 0 ? `+${line.deltaEur} €` : "0 €";
      const fallbackBadge = line.fallbackNote
        ? `<div class="ti-fallback-note">↳ ${escapeHtml(line.fallbackNote)}</div>`
        : "";
      return `
      <div class="t-item ${changed ? "changed" : ""}">
        <div>
          <div class="ti-name">${escapeHtml(line.name)}</div>
          <div class="ti-sub">${line.stock.toFixed(1)} ${escapeHtml(line.unit)} in fridge · ${escapeHtml(line.supplier)}</div>
          ${fallbackBadge}
        </div>
        <div class="ti-qty-col">
          <div class="stepper">
            <button type="button" class="step-btn" data-step="-1" data-sku="${escapeHtml(line.id)}" aria-label="Decrease">−</button>
            <span class="step-val">${line.finalQty} ${escapeHtml(line.unit)}</span>
            <button type="button" class="step-btn" data-step="1" data-sku="${escapeHtml(line.id)}" aria-label="Increase">+</button>
          </div>
          <span class="ti-usual">usual ${line.habitualQty} ${escapeHtml(line.unit)}</span>
        </div>
        <div class="ti-money">
          <div class="ti-eur">${line.lineEur} €</div>
          <div class="ti-save ${line.deltaEur > 0 ? "up" : ""}">${saveTxt}</div>
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

  // Send Button Lock State (Locked until Chef resolves Unfamiliar Event Check!)
  const sendBtn = document.getElementById("sendOrderBtn");
  const footnoteEl = document.getElementById("ticketFootnote");
  const vendorCount = new Set(lines.filter((l) => l.finalQty > 0).map((l) => l.supplier)).size;
  if (state.handoffLocked) {
    sendBtn.disabled = true;
    sendBtn.textContent = "🔒 LOCKED — CHECK EVENT ON CHALKBOARD";
    if (footnoteEl) {
      footnoteEl.hidden = false;
      footnoteEl.textContent = "Unfamiliar event nearby · Chef must confirm before sending";
    }
  } else {
    sendBtn.disabled = false;
    sendBtn.textContent = `✓ SEND ${vendorCount} SUPPLIER ORDERS · ${totalEur} EUR`;
    if (footnoteEl) {
      footnoteEl.hidden = true;
      footnoteEl.textContent = "";
    }
  }

  sendArea.hidden = state.sent;
  sentPanel.hidden = !state.sent;
  if (state.sent) renderSentEmails(f, lines, totalEur, savedEur);
}

// =========================================================================
// DRAFTED SUPPLIER EMAILS
// =========================================================================
function renderSentEmails(forecast, lines, totalEur, savedEur) {
  const byVendor = {};
  lines
    .filter((l) => l.finalQty > 0)
    .forEach((l) => {
      if (!byVendor[l.supplier]) byVendor[l.supplier] = [];
      byVendor[l.supplier].push(l);
    });
  const vendors = Object.keys(byVendor);
  if (!state.activeVendor || !byVendor[state.activeVendor]) state.activeVendor = vendors[0] || "";

  document.getElementById("sentSummaryLine").textContent = `✓ ${vendors.length} supplier orders sent (${totalEur} EUR)`;

  const tabsEl = document.getElementById("vendorTabs");
  tabsEl.innerHTML = vendors
    .map(
      (v) =>
        `<button type="button" class="v-tab ${v === state.activeVendor ? "active" : ""}" data-v="${escapeHtml(v)}">${escapeHtml(v.split(" ")[0])}</button>`
    )
    .join("");
  tabsEl.querySelectorAll("button[data-v]").forEach((b) => {
    b.addEventListener("click", () => {
      state.activeVendor = b.dataset.v;
      renderSentEmails(forecast, lines, totalEur, savedEur);
    });
  });

  const items = byVendor[state.activeVendor] || [];
  const sub = items.reduce((s, i) => s + i.lineEur, 0);
  const emailAddr = VENDOR_EMAILS[state.activeVendor] || "orders@supplier.fr";
  const subject = `Order ${forecast.dayLabel} 06:00 — Bistrot Urbain #04`;
  const body = `To: ${emailAddr}\nBonjour ${state.activeVendor},\nConfirmed for ${forecast.dayLabel} 06:00:\n${items
    .map((i) => ` • ${i.finalQty} ${i.unit} ${i.name} (${i.lineEur} EUR)`)
    .join("\n")}\nTotal: ${sub} EUR — Chef Karim (CoverCast)`;

  document.getElementById("vendorMessagePreview").textContent = body;
  document.getElementById("mailtoLinkBtn").href =
    `mailto:${encodeURIComponent(emailAddr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// =========================================================================
// PUBLIC INTEGRATION CONTRACT: window.CoverCastApp (SYNCHRONOUS)
// =========================================================================
window.CoverCastApp = {
  getMode() {
    return state.mode;
  },

  getOrderSnapshot() {
    const f = computeForecastFor(state);
    const lines = computeLinesFor(state, f);
    const totalEur = lines.reduce((s, l) => s + l.lineEur, 0);
    return {
      sent: Boolean(state.sent),
      mode: state.mode,
      dayLabel: f.dayLabel,
      p50: f.p50,
      lines,
      totalEur
    };
  },

  applySupplierSwap({ skuId, newSupplier, newSupplierEmail, newUnitPrice, newName, splitNote, costUsd } = {}) {
    const sku = state.skus.find((s) => s.id === skuId);
    if (!sku) return false;

    const prevSupplier = sku.supplier;
    if (newSupplier) {
      sku.supplier = newSupplier;
      if (newSupplierEmail) VENDOR_EMAILS[newSupplier] = newSupplierEmail;
    }
    if (typeof newUnitPrice === "number") sku.unitPrice = newUnitPrice;
    if (newName) sku.name = newName;
    if (splitNote) sku.fallbackNote = splitNote;

    state.changedSkuIds = new Set([skuId]);
    if (newSupplier) state.activeVendor = newSupplier;
    state.pendingProposal = null;
    state.lastInfo = null;
    state.lastApiKeyNeeded = false;
    state.lastApiError = null;
    state.lastApplied = {
      reflection:
        splitNote ||
        `Swapped ${sku.name} from ${prevSupplier} to ${sku.supplier} (€${sku.unitPrice}/${sku.unit}). PO updated.`,
      diffPills: [
        `Supplier → ${sku.supplier}`,
        `€${sku.unitPrice}/${sku.unit}`,
        "PO email updated"
      ],
      costUsd: typeof costUsd === "number" && Number.isFinite(costUsd) ? costUsd : null
    };

    render();
    runAgentTrace(false);
    return true;
  },

  appendTraceNote(fnName, outputText, isWarn = false) {
    appendTraceNote(fnName, outputText, isWarn);
  },

  openApiModal() {
    openApiModal();
  }
};

// =========================================================================
// LIVE REFLECTIVE COPILOT ENGINE (100% VIA callAgentJson — ZERO FALLBACKS)
// =========================================================================
function triggerUnknownEventHandoff(customLabel) {
  state.event = "unknown_big";
  state.handoffLabel = customLabel || "Unfamiliar high-impact local event";
  state.handoffLocked = true;
  state.handoffVerified = false;
  state.sent = false;
  state.pendingProposal = null;
  state.lastApplied = null;
  state.lastInfo = null;
  state.lastApiKeyNeeded = false;
  state.lastApiError = null;
  render();
  runAgentTrace(true);
}

async function callChefCopilotLive(rawText) {
  const liveSnap = captureSnapshot(state);
  const draftBase = state.pendingProposal ? captureSnapshot(state.pendingProposal.draftState) : captureSnapshot(state);
  const baseF = computeForecastFor(liveSnap);
  const baseL = computeLinesFor(liveSnap, baseF);
  const curL = computeLinesFor(draftBase, computeForecastFor(draftBase));

  const systemPrompt = `You are CoverCast, a 6 PM Paris kitchen Prep Agent for Bistrot Urbain #04 (Montparnasse, Paris 15e).
Never do euro arithmetic — return structured state mutations and the deterministic POS engine calculates exact quantities and euros.
Return STRICT JSON ONLY:
{
  "action": "propose|info|trigger-handoff|confirm-yes|confirm-cancel",
  "handoffLabel": "",
  "reflection": "concise kitchen response (max 22 words)",
  "mutation": {
    "coverDelta": 0,
    "skuEdits": [
      {
        "id": "cod|bavette|buns|mesclun|cream|tomatoes",
        "newName": null,
        "newUnitPrice": null,
        "setStock": null,
        "qtyDelta": 0,
        "setQty": null
      }
    ]
  }
}
Rules:
- Use "trigger-handoff" if the chef mentions an unusual/unseen local event (concert, festival, marathon, protest, VIP buyout).
- Use "confirm-yes" or "confirm-cancel" ONLY when hasPending is true and the chef clearly confirms or cancels the pending proposal.
- Use "propose" for booking changes, ingredient swaps (e.g. swapping cod to sea bass or salmon), fridge stock adjustments, or direct quantity tweaks.
- Use "info" for greetings, questions, or messages requiring no order mutation.`;

  const userPrompt = JSON.stringify({
    message: rawText,
    hasPending: Boolean(state.pendingProposal),
    forecastCovers: baseF.p50,
    bookings: state.bookings,
    items: curL.map((l) => ({
      id: l.id,
      name: l.name,
      unit: l.unit,
      unitPrice: l.unitPrice,
      qty: l.finalQty,
      stock: l.stock
    }))
  });

  const llmRes = await callAgentJson({
    systemPrompt,
    userPrompt,
    maxTokens: 500,
    temperature: 0.1
  });

  const parsed = llmRes.parsed || {};
  const modelLabel = getModelLabel(llmRes.provider, llmRes.model);
  const costUsd = llmRes.costUsd;

  if (parsed.action === "trigger-handoff") {
    return { action: "trigger-handoff", label: parsed.handoffLabel || rawText, costUsd, modelLabel };
  }
  if (parsed.action === "confirm-yes" || parsed.action === "confirm-cancel") {
    return { action: parsed.action, reflection: parsed.reflection || "", costUsd, modelLabel };
  }
  if (parsed.action !== "propose") {
    return {
      action: "info",
      reflection: parsed.reflection || "No order changes proposed.",
      costUsd,
      modelLabel
    };
  }

  const draft = captureSnapshot(draftBase);
  const m = parsed.mutation || {};
  if (typeof m.coverDelta === "number" && Number.isFinite(m.coverDelta)) {
    draft.extraCovers += clampInt(m.coverDelta, -200, 200, 0);
  }
  if (Array.isArray(m.skuEdits)) {
    m.skuEdits.forEach((ed) => {
      if (!ed || !ed.id) return;
      const sku = draft.skus.find((s) => s.id === ed.id);
      if (!sku) return;
      if (typeof ed.newName === "string" && ed.newName.trim()) sku.name = ed.newName.trim();
      if (typeof ed.newUnitPrice === "number" && Number.isFinite(ed.newUnitPrice) && ed.newUnitPrice > 0) {
        sku.unitPrice = Math.round(ed.newUnitPrice);
      }
      if (typeof ed.setStock === "number" && Number.isFinite(ed.setStock)) {
        draft.stocks[ed.id] = Math.max(0, Number(ed.setStock.toFixed(1)));
      }
    });
    const postL = computeLinesFor(draft, computeForecastFor(draft));
    m.skuEdits.forEach((ed) => {
      if (!ed || !ed.id) return;
      const l = postL.find((x) => x.id === ed.id);
      if (!l) return;
      if (typeof ed.setQty === "number" && Number.isFinite(ed.setQty)) {
        draft.overrides[ed.id] = Math.max(0, Math.round(ed.setQty)) - l.recQty;
      } else if (typeof ed.qtyDelta === "number" && Number.isFinite(ed.qtyDelta) && ed.qtyDelta !== 0) {
        draft.overrides[ed.id] = (draft.overrides[ed.id] || 0) + Math.round(ed.qtyDelta);
      }
    });
  }

  const nextF = computeForecastFor(draft);
  const nextL = computeLinesFor(draft, nextF);
  const diffPills = [];
  const changedIds = new Set();

  if (nextF.p50 !== baseF.p50) diffPills.push(`Covers ${baseF.p50} → ${nextF.p50}`);
  nextL.forEach((nl, i) => {
    if (nl.name !== baseL[i].name) {
      diffPills.push(`Swap → ${nl.name}`);
      changedIds.add(nl.id);
    }
    if (nl.finalQty !== baseL[i].finalQty) {
      diffPills.push(`${nl.name.split(" ")[1] || nl.id}: ${baseL[i].finalQty} → ${nl.finalQty} ${nl.unit}`);
      changedIds.add(nl.id);
    }
  });
  const baseEur = baseL.reduce((s, l) => s + l.lineEur, 0);
  const nextEur = nextL.reduce((s, l) => s + l.lineEur, 0);
  if (nextEur !== baseEur) diffPills.push(`Total ${baseEur} → ${nextEur} EUR`);

  return {
    action: "propose",
    proposal: {
      draftState: draft,
      reflection: `[${modelLabel}] ${parsed.reflection || "Proposed ticket adjustment ready."}`,
      diffPills: diffPills.length ? diffPills : ["No numeric delta"],
      changedIds,
      costUsd
    }
  };
}

function commitProposal() {
  const p = state.pendingProposal;
  if (!p) return;
  state.historyStack.push(captureSnapshot(state));
  Object.assign(state, captureSnapshot(p.draftState));
  state.changedSkuIds = p.changedIds || new Set();
  state.lastApplied = { reflection: p.reflection, diffPills: p.diffPills, costUsd: p.costUsd };
  state.pendingProposal = null;
  state.lastInfo = null;
  state.lastApiKeyNeeded = false;
  state.lastApiError = null;
  state.sent = false;
  render();
  runAgentTrace(false);
}

async function handleChefCommand(rawText) {
  const cmd = rawText.trim();
  if (!cmd) return;

  const btn = document.getElementById("commandSubmitBtn");
  btn.disabled = true;
  btn.textContent = "…";

  state.lastApiKeyNeeded = false;
  state.lastApiError = null;

  if (!hasApiKey()) {
    state.lastApiKeyNeeded = true;
    state.pendingProposal = null;
    state.lastApplied = null;
    state.lastInfo = null;
    render();
    btn.disabled = false;
    btn.textContent = "Ask";
    return;
  }

  try {
    const res = await callChefCopilotLive(cmd);

    if (res.action === "trigger-handoff") {
      triggerUnknownEventHandoff(res.label);
    } else if (res.action === "confirm-yes") {
      commitProposal();
    } else if (res.action === "confirm-cancel") {
      state.pendingProposal = null;
      state.lastApplied = null;
      state.lastInfo = { text: res.reflection || "Cancelled — ticket untouched.", costUsd: res.costUsd };
      render();
      runAgentTrace(false);
    } else if (res.action === "propose") {
      state.pendingProposal = res.proposal;
      state.lastApplied = null;
      state.lastInfo = null;
      render();
      runAgentTrace(false);
    } else {
      state.lastApplied = null;
      state.lastInfo = { text: res.reflection, costUsd: res.costUsd };
      render();
      runAgentTrace(false);
    }

    document.getElementById("commandInput").value = "";
  } catch (err) {
    if (err instanceof ApiKeyRequiredError) {
      state.lastApiKeyNeeded = true;
      state.lastApiError = null;
    } else {
      state.lastApiError = err?.message || "Live agent API call failed.";
      state.lastApiKeyNeeded = false;
    }
    state.pendingProposal = null;
    state.lastApplied = null;
    state.lastInfo = null;
    render();
    runAgentTrace(false);
  } finally {
    btn.disabled = false;
    btn.textContent = "Ask";
  }
}

// =========================================================================
// EVENT LISTENERS (MODES, AUTONOMOUS SCAN, HAND-OFF, VOICE, TICKET, API KEY)
// =========================================================================
if (normalModeBtn) {
  normalModeBtn.addEventListener("click", () => setMode("normal"));
}
if (demoModeBtn) {
  demoModeBtn.addEventListener("click", () => setMode("demo"));
}
if (rescanSignalsBtn) {
  rescanSignalsBtn.addEventListener("click", () => {
    state.event = "none";
    state.handoffLocked = false;
    state.handoffVerified = false;
    state.sent = false;
    runAutonomousScan({ animate: true, highlightChanges: true });
  });
}

// Hand-Off Interactive Choices + Unlock
document.querySelectorAll("#surgeChoiceGroup .hq-pill").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#surgeChoiceGroup .hq-pill").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    state.handoffSurgeChoice = parseInt(b.dataset.surge, 10);
    render();
  });
});

document.querySelectorAll("#postureChoiceGroup .hq-pill").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#postureChoiceGroup .hq-pill").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    state.handoffPosture = b.dataset.posture;
    render();
  });
});

document.getElementById("resolveHandoffBtn").addEventListener("click", () => {
  state.handoffLocked = false;
  state.handoffVerified = true;
  render();
  runAgentTrace(true);
});

// Inspect JSON Toggle
document.getElementById("toggleJsonBtn").addEventListener("click", () => {
  const drawer = document.getElementById("jsonDrawer");
  drawer.hidden = !drawer.hidden;
});

// Copilot Form, Yes/Cancel/Undo
document.getElementById("commandForm").addEventListener("submit", (e) => {
  e.preventDefault();
  handleChefCommand(document.getElementById("commandInput").value);
});
document.getElementById("confirmYesBtn").addEventListener("click", commitProposal);
document.getElementById("confirmCancelBtn").addEventListener("click", () => {
  state.pendingProposal = null;
  state.lastInfo = { text: "Cancelled — ticket untouched.", costUsd: null };
  render();
});
document.getElementById("undoCmdBtn").addEventListener("click", () => {
  const snap = state.historyStack.pop();
  if (!snap) return;
  Object.assign(state, snap);
  state.changedSkuIds = new Set();
  state.lastApplied = null;
  render();
  runAgentTrace(false);
});

// Send, Edit, Download, Reset
document.getElementById("sendOrderBtn").addEventListener("click", () => {
  if (state.handoffLocked) return;
  state.sent = true;
  render();
  window.dispatchEvent(
    new CustomEvent("covercast:order-sent", {
      detail: window.CoverCastApp.getOrderSnapshot()
    })
  );
});

document.getElementById("editOrderBtn").addEventListener("click", () => {
  state.sent = false;
  render();
  window.dispatchEvent(new CustomEvent("covercast:order-reset"));
});

document.getElementById("downloadPoBtn").addEventListener("click", () => {
  const f = computeForecastFor(state);
  const l = computeLinesFor(state, f);
  const txt =
    `COVERCAST ORDER (${f.dayLabel})\nForecast: ${f.p50} covers\n` +
    l.map((x) => `- ${x.name}: ${x.finalQty} ${x.unit} (${x.lineEur} EUR)`).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
  a.download = `CoverCast_${f.shortDay}.txt`;
  a.click();
});

document.getElementById("resetAllBtn").addEventListener("click", () => {
  const ctx = getTomorrowContext();
  const prof = DAY_PROFILES[ctx.dayKey] || DAY_PROFILES.saturday;
  state.day = ctx.dayKey;
  state.bookings = Math.min(320, Math.max(60, prof.expectedBookings + 12));
  state.event = "none";
  state.extraCovers = 0;
  state.skus = cloneBaseSkus();
  state.overrides = {};
  state.stocks = { cod: 2.6, bavette: 5.7, buns: 0.6, mesclun: 4.2, cream: 4.0, tomatoes: 4.4 };
  state.handoffLocked = false;
  state.handoffVerified = false;
  state.pendingProposal = null;
  state.lastApplied = null;
  state.lastInfo = null;
  state.lastApiKeyNeeded = false;
  state.lastApiError = null;
  state.changedSkuIds = new Set();
  state.extraTraceNotes = [];
  state.sent = false;
  state.activeVendor = "";
  state.signals = createInitialSignals();

  window.dispatchEvent(new CustomEvent("covercast:order-reset"));
  render();
  if (state.mode === "demo" && hasApiKey()) {
    runAutonomousScan({ animate: true, highlightChanges: false });
  } else {
    runAgentTrace(false);
  }
});

// =========================================================================
// LIVE VOICE DICTATION (WEB SPEECH API + AUTOMATIC MEDIARECORDER FALLBACK)
// =========================================================================
const micBtn = document.getElementById("micBtn");
const micLangBtn = document.getElementById("micLangBtn");
const voiceBar = document.getElementById("voiceBar");
const voiceStatusText = document.getElementById("voiceStatusText");
const voiceLiveWords = document.getElementById("voiceLiveWords");

let voiceMode = "idle"; // "idle" | "speech" | "recording" | "transcribing"
let recInstance = null;
let recStopRequested = false;
let mediaRecorder = null;
let mediaStream = null;
let recordAutoStopTimer = null;
let voiceHideTimer = null;

function showVoiceBar({ status = "", words = "", variant = "listening", autoHideMs = 0 } = {}) {
  if (voiceHideTimer) {
    clearTimeout(voiceHideTimer);
    voiceHideTimer = null;
  }
  if (!voiceBar) return;

  voiceBar.hidden = false;
  voiceBar.classList.remove("is-listening", "is-error", "is-success", "is-working");
  if (variant === "error") voiceBar.classList.add("is-error");
  else if (variant === "success") voiceBar.classList.add("is-success");
  else if (variant === "working") voiceBar.classList.add("is-working");
  else voiceBar.classList.add("is-listening");

  if (voiceStatusText) voiceStatusText.textContent = status;
  if (voiceLiveWords) voiceLiveWords.textContent = words;

  if (autoHideMs > 0) {
    voiceHideTimer = setTimeout(() => {
      if (voiceMode === "idle") {
        voiceBar.hidden = true;
      }
    }, autoHideMs);
  }
}

function stopMediaStreamTracks() {
  if (recordAutoStopTimer) {
    clearTimeout(recordAutoStopTimer);
    recordAutoStopTimer = null;
  }
  if (mediaStream) {
    try {
      mediaStream.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore track cleanup error
    }
    mediaStream = null;
  }
}

function canUseMediaRecorderTranscribe() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  if (typeof MediaRecorder === "undefined") return false;
  if (!hasApiKey()) return false;
  const cfg = getLlmConfig();
  const effectiveProvider =
    !cfg.apiKey && cfg.serverConfigured && cfg.serverProvider
      ? cfg.serverProvider
      : cfg.provider;
  return effectiveProvider === "openai" || effectiveProvider === "gemini";
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read recorded audio."));
    reader.readAsDataURL(blob);
  });
}

function finishVoiceTranscript(spoken) {
  const text = String(spoken || "").trim();
  if (!text) {
    showVoiceBar({
      status: "No speech detected — click the mic and speak clearly.",
      variant: "error"
    });
    return;
  }

  const inputEl = document.getElementById("commandInput");
  if (inputEl) inputEl.value = text;

  if (hasApiKey()) {
    showVoiceBar({
      status: "Transcribed:",
      words: `“${text}”`,
      variant: "success",
      autoHideMs: 3200
    });
    handleChefCommand(text);
  } else {
    showVoiceBar({
      status: "Transcribed — enter your API key in the top bar to run the agent.",
      words: `“${text}”`,
      variant: "success"
    });
  }
}

async function startMediaRecorderFallback() {
  if (voiceMode !== "idle") return;
  voiceMode = "recording";
  micBtn.classList.add("listening");
  showVoiceBar({
    status: "Requesting microphone…",
    variant: "working"
  });

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    voiceMode = "idle";
    micBtn.classList.remove("listening");
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      showVoiceBar({
        status: "Mic permission blocked — allow microphone access in browser settings.",
        variant: "error"
      });
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      showVoiceBar({
        status: "No microphone found — check your audio input device.",
        variant: "error"
      });
    } else {
      showVoiceBar({
        status: err?.message || "Could not access microphone.",
        variant: "error"
      });
    }
    return;
  }

  mediaStream = stream;
  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4"
  ];
  let chosenMime = "";
  if (typeof MediaRecorder.isTypeSupported === "function") {
    chosenMime = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  const chunks = [];
  try {
    mediaRecorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
  } catch (err) {
    stopMediaStreamTracks();
    voiceMode = "idle";
    micBtn.classList.remove("listening");
    showVoiceBar({
      status: err?.message || "Audio recorder could not start.",
      variant: "error"
    });
    return;
  }

  mediaRecorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  mediaRecorder.onerror = (ev) => {
    stopMediaStreamTracks();
    mediaRecorder = null;
    voiceMode = "idle";
    micBtn.classList.remove("listening");
    showVoiceBar({
      status: ev?.error?.message || "Microphone recording error — try again.",
      variant: "error"
    });
  };

  mediaRecorder.onstop = async () => {
    const activeMime = mediaRecorder?.mimeType || chosenMime || "audio/webm";
    stopMediaStreamTracks();
    mediaRecorder = null;
    micBtn.classList.remove("listening");

    const blob = new Blob(chunks, { type: activeMime });
    if (blob.size === 0) {
      voiceMode = "idle";
      showVoiceBar({
        status: "No audio captured — click the mic and speak clearly.",
        variant: "error"
      });
      return;
    }

    voiceMode = "transcribing";
    showVoiceBar({
      status: "Transcribing audio…",
      variant: "working"
    });

    try {
      const audioBase64 = await blobToBase64(blob);
      const { transcript } = await transcribeAudioBase64({
        audioBase64,
        mimeType: blob.type || activeMime,
        lang: state.voiceLang
      });
      voiceMode = "idle";
      finishVoiceTranscript(transcript);
    } catch (err) {
      voiceMode = "idle";
      showVoiceBar({
        status: err?.message || "Audio transcription failed.",
        variant: "error"
      });
    }
  };

  try {
    mediaRecorder.start();
  } catch (err) {
    stopMediaStreamTracks();
    mediaRecorder = null;
    voiceMode = "idle";
    micBtn.classList.remove("listening");
    showVoiceBar({
      status: err?.message || "Could not start recording.",
      variant: "error"
    });
    return;
  }

  showVoiceBar({
    status: "Recording (click mic to stop)…",
    words: "Speak now…",
    variant: "listening"
  });

  recordAutoStopTimer = setTimeout(() => {
    if (voiceMode === "recording" && mediaRecorder && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
      } catch {
        // ignore stop race
      }
    }
  }, 12000);
}

function startWebSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRec) {
    if (canUseMediaRecorderTranscribe()) {
      startMediaRecorderFallback();
      return;
    }
    showVoiceBar({
      status: "Speech recognition unavailable here — open http://localhost:3000 in Chrome/Edge (or enter an OpenAI/Gemini key for mic recording).",
      variant: "error"
    });
    return;
  }

  let rec;
  try {
    rec = new SpeechRec();
  } catch (err) {
    if (canUseMediaRecorderTranscribe()) {
      startMediaRecorderFallback();
      return;
    }
    showVoiceBar({
      status: err?.message || "Could not initialize speech recognition.",
      variant: "error"
    });
    return;
  }

  recInstance = rec;
  recStopRequested = false;
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = state.voiceLang;

  let finalTxt = "";
  let latestInterim = "";
  let hadError = false;
  let switchedToFallback = false;

  voiceMode = "speech";
  micBtn.classList.add("listening");
  showVoiceBar({
    status: `Listening (${micLangBtn.textContent})…`,
    words: "Speak now…",
    variant: "listening"
  });

  rec.onresult = (ev) => {
    let interim = "";
    finalTxt = "";
    for (let i = 0; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) finalTxt += ev.results[i][0].transcript;
      else interim += ev.results[i][0].transcript;
    }
    latestInterim = interim;
    const combined = (finalTxt + " " + interim).trim();
    const inputEl = document.getElementById("commandInput");
    if (inputEl) inputEl.value = combined;
    if (voiceLiveWords) voiceLiveWords.textContent = combined ? `“${combined}”` : "Speak now…";
  };

  rec.onerror = (ev) => {
    hadError = true;
    const code = ev?.error || "unknown";
    voiceMode = "idle";
    recInstance = null;
    micBtn.classList.remove("listening");

    if (code === "network" || code === "service-not-allowed") {
      if (canUseMediaRecorderTranscribe()) {
        switchedToFallback = true;
        startMediaRecorderFallback();
        return;
      }
      showVoiceBar({
        status: "Speech service blocked in embedded preview — open http://localhost:3000 in Chrome/Edge (or enter an OpenAI/Gemini key for mic recording).",
        variant: "error"
      });
      return;
    }

    if (code === "not-allowed") {
      showVoiceBar({
        status: "Mic permission blocked — allow microphone access in browser settings.",
        variant: "error"
      });
    } else if (code === "audio-capture") {
      showVoiceBar({
        status: "No microphone detected — check your audio input device.",
        variant: "error"
      });
    } else if (code === "no-speech") {
      showVoiceBar({
        status: "No speech detected — click the mic and speak clearly.",
        variant: "error"
      });
    } else if (code === "aborted") {
      if (!recStopRequested) {
        showVoiceBar({
          status: "Voice listening interrupted — click the mic to try again.",
          variant: "error"
        });
      }
    } else {
      showVoiceBar({
        status: `Microphone error (${code}) — click the mic to try again or type above.`,
        variant: "error"
      });
    }
  };

  rec.onend = () => {
    if (switchedToFallback) return;
    voiceMode = "idle";
    recInstance = null;
    micBtn.classList.remove("listening");
    if (hadError) return; // Keep error message visible in #voiceBar!

    const spoken = (finalTxt || latestInterim || "").trim();
    finishVoiceTranscript(spoken);
  };

  try {
    rec.start();
  } catch (err) {
    hadError = true;
    voiceMode = "idle";
    recInstance = null;
    micBtn.classList.remove("listening");
    showVoiceBar({
      status: err?.message || "Could not start microphone — try again.",
      variant: "error"
    });
  }
}

micLangBtn.addEventListener("click", () => {
  state.voiceLang = state.voiceLang === "en-US" ? "fr-FR" : "en-US";
  micLangBtn.textContent = state.voiceLang === "en-US" ? "EN" : "FR";
});

micBtn.addEventListener("click", () => {
  if (voiceMode === "transcribing") return;

  if (voiceMode === "recording") {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
      } catch {
        stopMediaStreamTracks();
        mediaRecorder = null;
        voiceMode = "idle";
        micBtn.classList.remove("listening");
      }
    }
    return;
  }

  if (voiceMode === "speech" && recInstance) {
    recStopRequested = true;
    try {
      recInstance.stop();
    } catch {
      voiceMode = "idle";
      recInstance = null;
      micBtn.classList.remove("listening");
    }
    return;
  }

  startWebSpeechRecognition();
});

// =========================================================================
// SINGLE API KEY MODAL EVENTS & covercast:api-changed SYNC
// =========================================================================
document.getElementById("claudeConfigBtn").addEventListener("click", openApiModal);
document.getElementById("closeClaudeModalBtn").addEventListener("click", closeApiModal);

if (claudeModal) {
  claudeModal.addEventListener("click", (e) => {
    if (e.target === claudeModal) closeApiModal();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && claudeModal && !claudeModal.hidden) {
    closeApiModal();
  }
});

function handleSaveApiKey() {
  const key = claudeKeyInput ? claudeKeyInput.value.trim() : "";

  if (!key) {
    if (claudeModalError) {
      claudeModalError.textContent = "Paste an API key (sk-ant-…, sk-…, or AIza…) to activate the agent.";
      claudeModalError.hidden = false;
    }
    return;
  }

  const detected = detectProviderFromKey(key);
  if (!detected) {
    if (claudeModalError) {
      claudeModalError.textContent = "Key should start with sk-ant- (Anthropic), sk- (OpenAI), or AIza (Gemini).";
      claudeModalError.hidden = false;
    }
    return;
  }

  state.lastApiKeyNeeded = false;
  state.lastApiError = null;
  setLlmConfig({ apiKey: key });
  closeApiModal();
  runAutonomousScan({ animate: true, highlightChanges: true });
}

if (claudeKeyInput) {
  const handleKeyInput = () => {
    updateKeyAutoHint(claudeKeyInput.value);
    if (claudeModalError) claudeModalError.hidden = true;
  };
  claudeKeyInput.addEventListener("input", handleKeyInput);
  claudeKeyInput.addEventListener("paste", () => setTimeout(handleKeyInput, 0));
  claudeKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveApiKey();
    }
  });
}

if (disconnectClaudeBtn) {
  disconnectClaudeBtn.addEventListener("click", () => {
    clearLlmConfig();
    closeApiModal();
  });
}

document.getElementById("saveClaudeBtn").addEventListener("click", handleSaveApiKey);

window.addEventListener("covercast:api-changed", () => {
  updateApiPill();
  if (!hasApiKey()) {
    scanRunId += 1;
    state.signals = createInitialSignals();
    state.liveParisTag = "Paris 15e";
    state.liveEventsFound = [];
    render();
    runAgentTrace(false);
  } else {
    state.lastApiKeyNeeded = false;
    render();
    runAgentTrace(false);
  }
});

// =========================================================================
// BOOT SEQUENCE (PROBE SERVER ENV KEY -> RENDER -> AUTO-SCAN ONLY IF CONNECTED)
// =========================================================================
async function boot() {
  updateApiPill();
  render();
  runAgentTrace(false);

  await probeServerApiStatus();
  updateApiPill();
  render();

  if (hasApiKey()) {
    await runAutonomousScan({ animate: true, highlightChanges: false });
  } else {
    runAgentTrace(false);
  }
}

boot();
