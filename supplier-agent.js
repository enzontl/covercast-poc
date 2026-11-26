// CoverCast — Autonomous Supplier Negotiation & Fallback Agent Loop
// 100% live LLM-powered via ./agent-llm.js (zero hardcoded supplier catalogs or fake delays).
// Self-contained ES module. Listens to window CustomEvents and uses window.CoverCastApp.

import {
  ApiKeyRequiredError,
  getLlmConfig,
  hasApiKey,
  getModelLabel,
  callAgentJson
} from "./agent-llm.js";

const AUTO_TRIGGER_DELAY_MS = 1800;
const CONFIRM_DISMISS_MS = 4000;

const SIM_BTN_ID = "simulateSupplierReplyBtn";
const DOCK_ID = "supplierAgentRoot";

const agentState = {
  runToken: 0,
  autoTimer: null,
  dismissTimer: null,
  phase: "idle", // "idle" | "checking" | "offer" | "confirmed" | "error"
  activeOffer: null,
  alreadySwappedIds: new Set()
};

function getApp() {
  return window.CoverCastApp || null;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortProductLabel(name) {
  const clean = String(name || "").trim();
  if (clean.length <= 22) return clean;
  return clean.replace(/\s*\([^)]*\)\s*/g, "").trim() || clean;
}

function formatEur(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const rounded = Math.round(num * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function resolveModelLabel(provider, modelId) {
  const cfg = getLlmConfig?.() || {};
  const label = getModelLabel?.(provider || cfg.provider, modelId || cfg.model);
  return String(label || modelId || cfg.model || "").trim();
}

function formatCostTag(costUsd, provider, modelName) {
  const hasCost = typeof costUsd === "number" && Number.isFinite(costUsd) && costUsd > 0;
  if (hasCost) {
    return `$${costUsd.toFixed(6)}`;
  }
  const label = resolveModelLabel(provider, modelName);
  return label ? label.slice(0, 22) : "";
}

function clearTimers() {
  if (agentState.autoTimer) {
    clearTimeout(agentState.autoTimer);
    agentState.autoTimer = null;
  }
  if (agentState.dismissTimer) {
    clearTimeout(agentState.dismissTimer);
    agentState.dismissTimer = null;
  }
}

function getOrCreateDock() {
  let dock = document.getElementById(DOCK_ID);
  if (!dock) {
    dock = document.createElement("aside");
    dock.id = DOCK_ID;
    dock.className = "sa-dock";
    dock.setAttribute("aria-live", "polite");
    dock.setAttribute("aria-label", "Supplier Fallback Agent");
    dock.hidden = true;
    document.body.appendChild(dock);
  }
  return dock;
}

function syncSimulateButtonState(isBusy = false) {
  const btn = document.getElementById(SIM_BTN_ID);
  if (!btn) return;
  if (!hasApiKey()) {
    btn.disabled = true;
    btn.dataset.state = "no-key";
    btn.textContent = "⚡ Simulate Reply";
    btn.title = "Enter API key in top bar to run Supplier Agent";
    return;
  }
  if (isBusy) {
    btn.disabled = true;
    btn.dataset.state = "busy";
    btn.textContent = "⚡ Calling API…";
    btn.title = "Calling live LLM supplier negotiation agent…";
    return;
  }
  btn.disabled = false;
  btn.dataset.state = "ready";
  btn.textContent = "⚡ Simulate Reply";
  btn.title = "Trigger a live LLM supplier shortage & autonomous backup negotiation";
}

function setSimButtonBusy(isBusy) {
  syncSimulateButtonState(isBusy);
}

function ensureSimulateButton() {
  const actionsEl = document.querySelector("#sentPanel .sent-mini-actions");
  if (!actionsEl) return null;

  let btn = document.getElementById(SIM_BTN_ID);
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = SIM_BTN_ID;
    btn.className = "sa-sim-pill";
    btn.addEventListener("click", () => {
      startFallbackLoop();
    });
    actionsEl.prepend(btn);
  }
  syncSimulateButtonState(agentState.phase === "checking");
  return btn;
}

function hidePopup(immediate = false) {
  clearTimers();
  agentState.runToken += 1;
  agentState.phase = "idle";
  agentState.activeOffer = null;
  setSimButtonBusy(false);

  const dock = document.getElementById(DOCK_ID);
  if (!dock) return;

  const card = dock.querySelector(".sa-card");
  if (!card || immediate) {
    dock.innerHTML = "";
    dock.hidden = true;
    return;
  }

  card.classList.remove("sa-visible");
  const tokenAtHide = agentState.runToken;
  setTimeout(() => {
    if (agentState.runToken !== tokenAtHide) return;
    dock.innerHTML = "";
    dock.hidden = true;
  }, 220);
}

function renderCard(stateClass, innerHtml, onMount) {
  const dock = getOrCreateDock();
  dock.hidden = false;
  dock.innerHTML = `<div class="sa-card ${stateClass}" role="region" aria-label="Supplier Fallback Agent">${innerHtml}</div>`;

  const card = dock.querySelector(".sa-card");
  if (typeof onMount === "function" && card) {
    onMount(card);
  }

  requestAnimationFrame(() => {
    if (card) card.classList.add("sa-visible");
  });
}

// =========================================================================
// LIVE API CALL IN FLIGHT
// =========================================================================
function showCheckingState() {
  agentState.phase = "checking";
  agentState.activeOffer = null;
  setSimButtonBusy(true);

  const modelLabel = resolveModelLabel();
  const metaHtml = modelLabel
    ? `<span class="sa-meta-tag" title="${escapeHtml(modelLabel)}">${escapeHtml(modelLabel)}</span>`
    : "";

  const html = `
    <div class="sa-head">
      <span class="sa-kicker"><span class="sa-dot sa-pulse"></span>SUPPLIER AGENT · LIVE API CALL</span>
      <div class="sa-head-right">
        ${metaHtml}
        <button type="button" class="sa-close" data-sa-close aria-label="Dismiss">×</button>
      </div>
    </div>
    <p class="sa-status-text">
      Incoming supplier reply detected — agent negotiating with backup Paris wholesalers…
    </p>
  `;

  renderCard("sa-state-checking", html, (card) => {
    card.querySelector("[data-sa-close]")?.addEventListener("click", () => hidePopup());
  });
}

// =========================================================================
// CASE B2: LIVE LLM OFFER READY
// =========================================================================
function showOfferState(offer) {
  const {
    line,
    shortageReason,
    backupSupplier,
    backupShortName,
    unitPrice,
    deliverySlot,
    agentReasoning,
    totalDelta,
    costUsd,
    model,
    provider,
    latencyMs
  } = offer;

  const deltaAbs = formatEur(Math.abs(totalDelta));
  const deltaText =
    totalDelta > 0
      ? `+€${deltaAbs} total vs original`
      : totalDelta < 0
      ? `−€${deltaAbs} total vs original`
      : `same total`;
  const deltaClass = totalDelta <= 0 ? "sa-cost-delta sa-even" : "sa-cost-delta";

  const modelLabel = resolveModelLabel(provider, model);
  const metaTag = formatCostTag(costUsd, provider, model);
  const metaTitle = [modelLabel, latencyMs ? `${latencyMs}ms` : ""]
    .filter(Boolean)
    .join(" · ");
  const metaHtml = metaTag
    ? `<span class="sa-meta-tag" title="${escapeHtml(metaTitle)}">${escapeHtml(metaTag)}</span>`
    : "";

  const slotHtml = deliverySlot
    ? `<span class="sa-slot-badge">${escapeHtml(deliverySlot)}</span>`
    : "";

  const reasoningHtml = agentReasoning
    ? `<p class="sa-agent-note">${escapeHtml(agentReasoning)}</p>`
    : "";

  agentState.phase = "offer";
  agentState.activeOffer = offer;
  setSimButtonBusy(false);

  const html = `
    <div class="sa-head">
      <span class="sa-kicker"><span class="sa-dot sa-alert"></span>SUPPLIER FALLBACK READY</span>
      <div class="sa-head-right">
        ${metaHtml}
        <button type="button" class="sa-close" data-sa-close aria-label="Dismiss">×</button>
      </div>
    </div>
    <p class="sa-reason">${escapeHtml(shortageReason)}</p>
    <div class="sa-offer-box">
      <div class="sa-offer-top">
        <span class="sa-supplier-name">${escapeHtml(backupSupplier)}</span>
        ${slotHtml}
      </div>
      <div class="sa-offer-detail">
        <span class="sa-sku-qty">${escapeHtml(line.finalQty)} ${escapeHtml(line.unit)} ${escapeHtml(line.name)}</span>
      </div>
      <div class="sa-cost-impact">
        €${escapeHtml(formatEur(unitPrice))}/${escapeHtml(line.unit)} (<span class="${deltaClass}">${escapeHtml(deltaText)}</span>)
      </div>
    </div>
    ${reasoningHtml}
    <div class="sa-actions">
      <button type="button" id="saSwapConfirmBtn" class="sa-btn-primary">✓ Swap to ${escapeHtml(backupShortName)}</button>
      <button type="button" id="saDismissBtn" class="sa-btn-secondary">Keep / Dismiss</button>
    </div>
  `;

  renderCard("sa-state-offer", html, (card) => {
    card.querySelector("[data-sa-close]")?.addEventListener("click", () => hidePopup());
    card.querySelector("#saDismissBtn")?.addEventListener("click", () => hidePopup());
    card.querySelector("#saSwapConfirmBtn")?.addEventListener("click", () => executeSwap(offer));
  });
}

// =========================================================================
// CASE C: API OR VALIDATION ERROR (ZERO HARDCODED FALLBACK)
// =========================================================================
function showErrorState(errorMessage) {
  const cleanMsg = String(errorMessage || "Live supplier agent call failed.").trim();

  agentState.phase = "error";
  agentState.activeOffer = null;
  setSimButtonBusy(false);

  const html = `
    <div class="sa-head">
      <span class="sa-kicker"><span class="sa-dot sa-err"></span>SUPPLIER AGENT · API ERROR</span>
      <button type="button" class="sa-close" data-sa-close aria-label="Dismiss">×</button>
    </div>
    <p class="sa-error-msg">${escapeHtml(cleanMsg)}</p>
    <div class="sa-actions">
      <button type="button" id="saRetryBtn" class="sa-btn-primary">↻ Retry</button>
      <button type="button" id="saDismissBtn" class="sa-btn-secondary">Dismiss</button>
    </div>
  `;

  renderCard("sa-state-error", html, (card) => {
    card.querySelector("[data-sa-close]")?.addEventListener("click", () => hidePopup());
    card.querySelector("#saDismissBtn")?.addEventListener("click", () => hidePopup());
    card.querySelector("#saRetryBtn")?.addEventListener("click", () => {
      startFallbackLoop();
    });
  });
}

// =========================================================================
// APPLY SWAP TO ORDER TICKET + PO EMAILS
// =========================================================================
function executeSwap(offer) {
  const app = getApp();
  const { line, backupSupplier, backupShortName, backupEmail, unitPrice, costUsd } = offer;
  const shortName = shortProductLabel(line.name);

  if (app && typeof app.applySupplierSwap === "function") {
    app.applySupplierSwap({
      skuId: line.id,
      newSupplier: backupSupplier,
      newSupplierEmail: backupEmail,
      newUnitPrice: unitPrice,
      splitNote: `Swapped from ${line.supplier} via Fallback Agent`,
      costUsd
    });
  }

  agentState.alreadySwappedIds.add(line.id);
  ensureSimulateButton();

  if (app && typeof app.appendTraceNote === "function") {
    app.appendTraceNote(
      "6. Supplier Swapped",
      `Swapped ${line.finalQty} ${line.unit} ${shortName} to ${backupSupplier} (€${formatEur(unitPrice)}/${line.unit}) · email updated`,
      false
    );
  }

  clearTimers();
  const myToken = ++agentState.runToken;
  agentState.phase = "confirmed";
  agentState.activeOffer = null;
  setSimButtonBusy(false);

  const html = `
    <div class="sa-head">
      <span class="sa-kicker"><span class="sa-dot sa-ok"></span>SUPPLIER SWAPPED · PO UPDATED</span>
      <button type="button" class="sa-close" data-sa-close aria-label="Close">×</button>
    </div>
    <p class="sa-confirm-text">
      ✓ Swapped ${escapeHtml(line.finalQty)} ${escapeHtml(line.unit)} ${escapeHtml(shortName)} → ${escapeHtml(backupShortName)} · PO email updated
    </p>
  `;

  renderCard("sa-state-confirmed", html, (card) => {
    card.addEventListener("click", () => hidePopup());
  });

  agentState.dismissTimer = setTimeout(() => {
    if (agentState.runToken !== myToken) return;
    hidePopup();
  }, CONFIRM_DISMISS_MS);
}

// =========================================================================
// LIVE LLM PROMPT & STRICT VALIDATION
// =========================================================================
function buildSupplierPrompts(snapshot, activeLines) {
  const systemPrompt = [
    "You are CoverCast's Autonomous Supplier Negotiation & Fallback Agent for Bistrot Urbain #04 (Paris 15e, 06:00 Rungis delivery).",
    "Given the dispatched purchase order lines, simulate a realistic incoming 06:00 supplier shortage reply on ONE active line, compare Parisian/Rungis backup wholesalers, and propose the best on-time backup offer.",
    "Prefer a line whose id is NOT in alreadySwappedIds; if all active lines were already swapped, pick one and source a different backup wholesaler than its current supplier.",
    "Return STRICT JSON ONLY (no markdown fences, no commentary) with this exact schema:",
    "{",
    '  "skuId": "exact id of one active line from input",',
    '  "shortageReason": "crisp 1-line incoming supplier reply (max 16 words) mentioning supplier, qty, product, 06:00",',
    '  "backupSupplier": "realistic Parisian / Rungis backup wholesaler name (MUST differ from current supplier)",',
    '  "backupShortName": "short 2-word button label",',
    '  "backupEmail": "realistic French wholesale order email",',
    '  "unitPrice": 20,',
    '  "deliverySlot": "06:00 slot ✓",',
    '  "agentReasoning": "1 crisp sentence (max 18 words) explaining backup comparison & why this wholesaler won",',
    '  "traceNote": "short 1-line summary for kitchen trace"',
    "}",
    "Rules: skuId MUST match one of the input line ids; backupSupplier MUST NOT equal the line's current supplier; unitPrice MUST be a positive number close to market wholesale price."
  ].join("\n");

  const payload = {
    dayLabel: snapshot.dayLabel || "Tomorrow",
    totalEur: snapshot.totalEur,
    alreadySwappedIds: Array.from(agentState.alreadySwappedIds),
    lines: activeLines.map((l) => ({
      id: l.id,
      name: l.name,
      supplier: l.supplier,
      unit: l.unit,
      unitPrice: Number(l.unitPrice),
      finalQty: Number(l.finalQty)
    }))
  };

  const userPrompt = `Live dispatched kitchen order:\n${JSON.stringify(payload, null, 2)}\n\nSimulate an incoming supplier shortage and negotiate the best 06:00 Parisian backup wholesaler. Return strict JSON only.`;

  return { systemPrompt, userPrompt };
}

function validateAndBuildOffer(parsed, activeLines, result) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Supplier agent returned an invalid JSON payload.");
  }

  const skuId = String(parsed.skuId || "").trim();
  const matchedLine = activeLines.find((l) => l.id === skuId);
  if (!matchedLine) {
    throw new Error(`Supplier agent returned unknown or inactive skuId "${skuId || "(empty)"}".`);
  }

  const backupSupplier = String(parsed.backupSupplier || "").trim();
  if (!backupSupplier) {
    throw new Error("Supplier agent returned an empty backup supplier name.");
  }
  if (backupSupplier.toLowerCase() === String(matchedLine.supplier || "").trim().toLowerCase()) {
    throw new Error(`Backup supplier "${backupSupplier}" must differ from current supplier.`);
  }

  const rawPrice = Number(parsed.unitPrice);
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
    throw new Error(`Supplier agent returned an invalid unitPrice ("${parsed.unitPrice}").`);
  }
  const unitPrice = Math.round(rawPrice * 100) / 100;

  const shortageReason = String(parsed.shortageReason || "").trim();
  if (!shortageReason) {
    throw new Error("Supplier agent omitted the incoming shortageReason.");
  }

  const backupShortName =
    String(parsed.backupShortName || "").trim() ||
    backupSupplier.split(/\s+/).slice(0, 2).join(" ");

  const backupEmail = String(parsed.backupEmail || "").trim();
  const deliverySlot = String(parsed.deliverySlot || "").trim();
  const agentReasoning = String(parsed.agentReasoning || "").trim();
  const traceNote = String(parsed.traceNote || "").trim() || `${shortageReason} → ${backupSupplier}`;

  // Deterministic math: never trust LLM arithmetic for total delta
  const origPrice = Number(matchedLine.unitPrice);
  const qty = Number(matchedLine.finalQty);
  const totalDelta = Math.round((unitPrice - origPrice) * qty * 100) / 100;

  const cfg = getLlmConfig?.() || {};

  return {
    line: { ...matchedLine },
    shortageReason,
    backupSupplier,
    backupShortName,
    backupEmail,
    unitPrice,
    deliverySlot,
    agentReasoning,
    traceNote,
    totalDelta,
    costUsd: typeof result?.costUsd === "number" ? result.costUsd : null,
    model: result?.model || cfg.model || "",
    provider: result?.provider || cfg.provider || "",
    latencyMs: typeof result?.latencyMs === "number" ? result.latencyMs : null
  };
}

// =========================================================================
// MAIN LIVE FALLBACK LOOP
// =========================================================================
async function startFallbackLoop(snapshotOverride = null) {
  if (!hasApiKey()) return;

  const app = getApp();
  const snapshot = snapshotOverride || app?.getOrderSnapshot?.();
  if (!snapshot || !snapshot.sent) return;

  const activeLines = (snapshot.lines || []).filter((l) => Number(l.finalQty) > 0);
  if (activeLines.length === 0) return;

  // Live API key connected -> real LLM negotiation call
  clearTimers();
  const myToken = ++agentState.runToken;

  showCheckingState();

  app?.appendTraceNote?.(
    "5. Supplier Shortage",
    "Checking backup Paris suppliers via live AI…",
    true
  );

  const { systemPrompt, userPrompt } = buildSupplierPrompts(snapshot, activeLines);

  try {
    const result = await callAgentJson({
      systemPrompt,
      userPrompt,
      maxTokens: 500,
      temperature: 0.4
    });

    if (agentState.runToken !== myToken) return;

    const latestSnap = getApp()?.getOrderSnapshot?.();
    if ((latestSnap && !latestSnap.sent) || !hasApiKey()) {
      hidePopup(true);
      return;
    }

    const offer = validateAndBuildOffer(result?.parsed, activeLines, result);
    const offerShortName = shortProductLabel(offer.line.name);

    getApp()?.appendTraceNote?.(
      "5. Supplier Shortage",
      `${offer.line.supplier} short on ${offer.line.finalQty} ${offer.line.unit} ${offerShortName} · backup found at ${offer.backupSupplier}`,
      true
    );

    showOfferState(offer);
  } catch (err) {
    if (agentState.runToken !== myToken) return;

    const latestSnap = getApp()?.getOrderSnapshot?.();
    if (latestSnap && !latestSnap.sent) {
      hidePopup(true);
      return;
    }

    if (err instanceof ApiKeyRequiredError || err?.name === "ApiKeyRequiredError" || !hasApiKey()) {
      hidePopup(true);
      return;
    }

    const errMsg = err?.message || "Unexpected error contacting live supplier agent.";
    getApp()?.appendTraceNote?.(
      "5. Supplier Check",
      errMsg,
      true
    );
    showErrorState(errMsg);
  }
}

// =========================================================================
// LIFECYCLE EVENT HANDLERS
// =========================================================================
function handleOrderSent(event) {
  clearTimers();
  ensureSimulateButton();

  if (!hasApiKey()) return;

  const app = getApp();
  const mode = app?.getMode?.() || event?.detail?.mode;

  if (mode === "demo") {
    const myToken = ++agentState.runToken;
    agentState.autoTimer = setTimeout(() => {
      if (agentState.runToken !== myToken) return;
      if (!hasApiKey()) return;
      const latestSnap = getApp()?.getOrderSnapshot?.();
      if (!latestSnap || !latestSnap.sent || getApp()?.getMode?.() !== "demo") return;
      startFallbackLoop(latestSnap);
    }, AUTO_TRIGGER_DELAY_MS);
  }
}

function handleResetOrModeChange() {
  agentState.alreadySwappedIds.clear();
  hidePopup(true);
}

function handleApiChanged() {
  if (!hasApiKey()) {
    hidePopup(true);
  }
  syncSimulateButtonState(agentState.phase === "checking");
}

function initSupplierAgent() {
  getOrCreateDock();

  window.addEventListener("covercast:order-sent", handleOrderSent);
  window.addEventListener("covercast:order-reset", handleResetOrModeChange);
  window.addEventListener("covercast:mode-changed", handleResetOrModeChange);
  window.addEventListener("covercast:api-changed", handleApiChanged);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && agentState.phase !== "idle") {
      hidePopup();
    }
  });

  // If the order was already marked sent before this module initialized, inject button cleanly.
  const sentPanel = document.getElementById("sentPanel");
  if ((sentPanel && !sentPanel.hidden) || getApp()?.getOrderSnapshot?.()?.sent) {
    ensureSimulateButton();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSupplierAgent, { once: true });
} else {
  initSupplierAgent();
}
