export const PROVIDER_MODELS = {
  anthropic: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", inPerM: 1.0, outPerM: 5.0 },
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", inPerM: 3.0, outPerM: 15.0 },
    { id: "claude-opus-4-5", label: "Claude Opus 4.5", inPerM: 15.0, outPerM: 75.0 },
    { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", inPerM: 0.8, outPerM: 4.0 }
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o Mini", inPerM: 0.15, outPerM: 0.60 },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", inPerM: 0.40, outPerM: 1.60 },
    { id: "gpt-4o", label: "GPT-4o", inPerM: 2.50, outPerM: 10.0 }
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", inPerM: 0.15, outPerM: 0.60 },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", inPerM: 1.25, outPerM: 10.0 }
  ]
};

export class ApiKeyRequiredError extends Error {
  constructor(message = "Connect your API key to run live agentic reasoning.") {
    super(message);
    this.name = "ApiKeyRequiredError";
  }
}

const STORAGE_KEYS = {
  provider: "covercast_api_provider",
  apiKey: "covercast_api_key",
  model: "covercast_api_model",
  legacyKey: "covercast_claude_key",
  legacyModel: "covercast_claude_model"
};

let serverConfigured = false;
let serverProvider = null;
let sessionCostUsd = 0;
let lastCallMeta = null;
let legacyMigrated = false;

function getStorage() {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // ignore restricted storage access
  }
  return null;
}

function isValidProvider(provider) {
  return Boolean(provider && Object.prototype.hasOwnProperty.call(PROVIDER_MODELS, provider));
}

export function getDefaultModel(provider) {
  const list = PROVIDER_MODELS[provider] || PROVIDER_MODELS.anthropic;
  return list[0].id;
}

export function detectProviderFromKey(key) {
  if (typeof key !== "string") return null;
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("sk-ant-")) return "anthropic";
  if (trimmed.startsWith("sk-")) return "openai";
  if (trimmed.startsWith("AIza")) return "gemini";
  return null;
}

function migrateLegacyStorageIfNeeded() {
  if (legacyMigrated) return;
  legacyMigrated = true;

  const storage = getStorage();
  if (!storage) return;

  const currentKey = (storage.getItem(STORAGE_KEYS.apiKey) || "").trim();
  const legacyKey = (storage.getItem(STORAGE_KEYS.legacyKey) || "").trim();

  if (!currentKey && legacyKey) {
    const detected = detectProviderFromKey(legacyKey) || "anthropic";
    storage.setItem(STORAGE_KEYS.apiKey, legacyKey);
    if (!storage.getItem(STORAGE_KEYS.provider)) {
      storage.setItem(STORAGE_KEYS.provider, detected);
    }
    const legacyModel = (storage.getItem(STORAGE_KEYS.legacyModel) || "").trim();
    const isKnownLegacyModel =
      legacyModel &&
      PROVIDER_MODELS[detected]?.some((m) => m.id === legacyModel);
    if (!storage.getItem(STORAGE_KEYS.model)) {
      storage.setItem(
        STORAGE_KEYS.model,
        isKnownLegacyModel ? legacyModel : getDefaultModel(detected)
      );
    }
    storage.removeItem(STORAGE_KEYS.legacyKey);
    storage.removeItem(STORAGE_KEYS.legacyModel);
  }
}

function dispatchApiChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("covercast:api-changed", { detail: getLlmConfig() }));
}

export function getLlmConfig() {
  migrateLegacyStorageIfNeeded();
  const storage = getStorage();

  const apiKey = (storage?.getItem(STORAGE_KEYS.apiKey) || "").trim();
  const storedProvider = (storage?.getItem(STORAGE_KEYS.provider) || "").trim().toLowerCase();
  const detectedProvider = detectProviderFromKey(apiKey);

  let provider = "anthropic";
  if (detectedProvider) {
    provider = detectedProvider;
  } else if (isValidProvider(storedProvider)) {
    provider = storedProvider;
  } else if (isValidProvider(serverProvider)) {
    provider = serverProvider;
  }

  const storedModel = (storage?.getItem(STORAGE_KEYS.model) || "").trim();
  const modelBelongsToProvider =
    storedModel && PROVIDER_MODELS[provider]?.some((m) => m.id === storedModel);
  const model = modelBelongsToProvider ? storedModel : getDefaultModel(provider);

  return {
    provider,
    apiKey,
    model,
    serverConfigured,
    serverProvider
  };
}

export function setLlmConfig({ provider, apiKey, model } = {}) {
  migrateLegacyStorageIfNeeded();
  const storage = getStorage();
  const current = getLlmConfig();

  const nextKey =
    apiKey !== undefined ? String(apiKey || "").trim() : current.apiKey;

  const requestedProvider = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const detectedProvider = detectProviderFromKey(nextKey);
  const nextProvider = isValidProvider(requestedProvider)
    ? requestedProvider
    : detectedProvider || current.provider || "anthropic";

  const requestedModel = typeof model === "string" ? model.trim() : "";
  const nextModel = requestedModel || getDefaultModel(nextProvider);

  if (storage) {
    storage.setItem(STORAGE_KEYS.provider, nextProvider);
    if (nextKey) {
      storage.setItem(STORAGE_KEYS.apiKey, nextKey);
    } else {
      storage.removeItem(STORAGE_KEYS.apiKey);
    }
    storage.setItem(STORAGE_KEYS.model, nextModel);
    storage.removeItem(STORAGE_KEYS.legacyKey);
    storage.removeItem(STORAGE_KEYS.legacyModel);
  }

  dispatchApiChanged();
  return getLlmConfig();
}

export function clearLlmConfig() {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(STORAGE_KEYS.apiKey);
    storage.removeItem(STORAGE_KEYS.provider);
    storage.removeItem(STORAGE_KEYS.model);
    storage.removeItem(STORAGE_KEYS.legacyKey);
    storage.removeItem(STORAGE_KEYS.legacyModel);
  }
  dispatchApiChanged();
  return getLlmConfig();
}

export function hasApiKey() {
  const cfg = getLlmConfig();
  return Boolean(cfg.apiKey || cfg.serverConfigured);
}

export function getModelLabel(provider, modelId) {
  const list = isValidProvider(provider) ? PROVIDER_MODELS[provider] : null;
  if (list) {
    const match = list.find((m) => m.id === modelId);
    if (match) return match.label;
  } else {
    for (const models of Object.values(PROVIDER_MODELS)) {
      const match = models.find((m) => m.id === modelId);
      if (match) return match.label;
    }
  }
  return modelId || (list ? list[0].label : "Custom Model");
}

export function getSessionCostUsd() {
  return Number(sessionCostUsd.toFixed(6));
}

export function getLastCallMeta() {
  return lastCallMeta ? { ...lastCallMeta } : null;
}

function canUseBackendEndpoint() {
  if (typeof window === "undefined") return true;
  const proto = window.location?.protocol || "";
  return proto === "http:" || proto === "https:";
}

export async function probeServerApiStatus() {
  if (!canUseBackendEndpoint()) {
    serverConfigured = false;
    serverProvider = null;
    return { serverConfigured, serverProvider };
  }

  const prevConfigured = serverConfigured;
  const prevProvider = serverProvider;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status" }),
      signal: controller?.signal
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok) {
        serverConfigured = Boolean(data.serverConfigured);
        serverProvider = isValidProvider(data.provider) ? data.provider : null;
      } else {
        serverConfigured = false;
        serverProvider = null;
      }
    } else {
      serverConfigured = false;
      serverProvider = null;
    }
  } catch {
    serverConfigured = false;
    serverProvider = null;
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (prevConfigured !== serverConfigured || prevProvider !== serverProvider) {
    dispatchApiChanged();
  }

  return { serverConfigured, serverProvider };
}

function computeDirectCostUsd(provider, model, inputTokens, outputTokens) {
  const list = PROVIDER_MODELS[provider] || [];
  const exact = list.find((m) => m.id === model);
  let inPerM = exact?.inPerM;
  let outPerM = exact?.outPerM;

  if (inPerM === undefined || outPerM === undefined) {
    const fallback = list[0] || { inPerM: 1.0, outPerM: 5.0 };
    inPerM = fallback.inPerM;
    outPerM = fallback.outPerM;
  }

  return Number(((inputTokens * inPerM + outputTokens * outPerM) / 1_000_000).toFixed(6));
}

function parseJsonObject(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("Model returned an empty response.");
  }

  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        throw new Error("Model returned malformed JSON.");
      }
    } else {
      throw new Error("Model did not return a JSON object.");
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model response must be a JSON object.");
  }

  return parsed;
}

async function extractDirectError(response, label) {
  let detail = "";
  try {
    const text = await response.text();
    if (text) {
      try {
        const json = JSON.parse(text);
        detail =
          json?.error?.message ||
          json?.message ||
          (typeof json?.error === "string" ? json.error : "");
      } catch {
        detail = text.slice(0, 220).trim();
      }
    }
  } catch {
    // ignore read error
  }
  const concise = detail ? detail.replace(/\s+/g, " ").slice(0, 240) : response.statusText || "API error";
  return `${label} API error (${response.status}): ${concise}`;
}

async function callProviderDirect({ provider, apiKey, model, systemPrompt, userPrompt, maxTokens, temperature }) {
  const t0 = Date.now();
  let rawText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  if (provider === "anthropic") {
    const payload = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "user", content: userPrompt }]
    };
    if (systemPrompt) payload.system = systemPrompt;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(await extractDirectError(res, "Anthropic"));
    }

    const data = await res.json();
    rawText = Array.isArray(data?.content)
      ? data.content
          .filter((b) => b && b.type === "text" && typeof b.text === "string")
          .map((b) => b.text)
          .join("\n")
      : "";
    inputTokens = Number(data?.usage?.input_tokens ?? 0);
    outputTokens = Number(data?.usage?.output_tokens ?? 0);
  } else if (provider === "openai") {
    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userPrompt });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        response_format: { type: "json_object" },
        messages
      })
    });

    if (!res.ok) {
      throw new Error(await extractDirectError(res, "OpenAI"));
    }

    const data = await res.json();
    rawText = data?.choices?.[0]?.message?.content ?? "";
    inputTokens = Number(data?.usage?.prompt_tokens ?? 0);
    outputTokens = Number(data?.usage?.completion_tokens ?? 0);
  } else if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const payload = {
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json"
      },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }]
    };
    if (systemPrompt) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(await extractDirectError(res, "Gemini"));
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    rawText = Array.isArray(parts)
      ? parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("\n")
      : "";
    inputTokens = Number(data?.usageMetadata?.promptTokenCount ?? 0);
    outputTokens = Number(data?.usageMetadata?.candidatesTokenCount ?? 0);
  } else {
    throw new Error(`Unsupported provider '${provider}'.`);
  }

  const parsed = parseJsonObject(rawText);
  const latencyMs = Date.now() - t0;
  const costUsd = computeDirectCostUsd(provider, model, inputTokens, outputTokens);

  return {
    parsed,
    rawText,
    provider,
    model,
    costUsd,
    latencyMs,
    usage: { inputTokens, outputTokens }
  };
}

function recordCallMetrics({ provider, model, costUsd, latencyMs }) {
  const safeCost = Number.isFinite(costUsd) ? costUsd : 0;
  const safeLatency = Number.isFinite(latencyMs) ? latencyMs : 0;
  sessionCostUsd = Number((sessionCostUsd + safeCost).toFixed(6));
  lastCallMeta = {
    provider,
    model,
    costUsd: Number(safeCost.toFixed(6)),
    latencyMs: safeLatency
  };
}

export async function callAgentJson({ systemPrompt, userPrompt, maxTokens = 700, temperature = 0.2 } = {}) {
  if (!hasApiKey()) {
    throw new ApiKeyRequiredError();
  }

  const cfg = getLlmConfig();
  const effectiveProvider =
    !cfg.apiKey && cfg.serverConfigured && isValidProvider(cfg.serverProvider)
      ? cfg.serverProvider
      : cfg.provider;
  const effectiveModel =
    !cfg.apiKey && cfg.serverConfigured && effectiveProvider !== cfg.provider
      ? getDefaultModel(effectiveProvider)
      : cfg.model;

  if (canUseBackendEndpoint()) {
    let response;
    let networkError = null;

    try {
      response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent-json",
          customProvider: effectiveProvider,
          customKey: cfg.apiKey || undefined,
          customModel: effectiveModel,
          systemPrompt,
          userPrompt,
          maxTokens,
          temperature
        })
      });
    } catch (err) {
      networkError = err;
    }

    if (networkError) {
      if (cfg.apiKey) {
        const direct = await callProviderDirect({
          provider: effectiveProvider,
          apiKey: cfg.apiKey,
          model: effectiveModel,
          systemPrompt,
          userPrompt,
          maxTokens,
          temperature
        });
        recordCallMetrics(direct);
        return direct;
      }
      throw new Error(networkError.message || "Failed to reach /api/analyze.");
    }

    const contentType = response.headers?.get?.("content-type") || "";
    const isJson = contentType.includes("application/json");
    let data = null;
    try {
      const text = await response.text();
      if (text) data = JSON.parse(text);
    } catch {
      data = null;
    }

    // Static hosting fallback: /api/analyze does not exist (404 or non-JSON 405)
    if ((response.status === 404 || (response.status === 405 && !isJson)) && !data?.error) {
      if (cfg.apiKey) {
        const direct = await callProviderDirect({
          provider: effectiveProvider,
          apiKey: cfg.apiKey,
          model: effectiveModel,
          systemPrompt,
          userPrompt,
          maxTokens,
          temperature
        });
        recordCallMetrics(direct);
        return direct;
      }
      throw new Error("Backend /api/analyze endpoint unavailable. Connect your API key for direct mode.");
    }

    if (!response.ok || !data?.ok) {
      const message = data?.error || `API request failed (HTTP ${response.status}).`;
      if (response.status === 401 && !cfg.apiKey) {
        throw new ApiKeyRequiredError(message);
      }
      throw new Error(message);
    }

    const rawText = typeof data.rawText === "string" ? data.rawText : JSON.stringify(data.parsed || {});
    const parsed =
      data.parsed && typeof data.parsed === "object" && !Array.isArray(data.parsed)
        ? data.parsed
        : parseJsonObject(rawText);

    const result = {
      parsed,
      rawText,
      provider: data.provider || effectiveProvider,
      model: data.model || effectiveModel,
      costUsd: Number(data.costUsd ?? 0),
      latencyMs: Number(data.latencyMs ?? 0),
      usage: {
        inputTokens: Number(data.usage?.inputTokens ?? 0),
        outputTokens: Number(data.usage?.outputTokens ?? 0)
      }
    };

    recordCallMetrics(result);
    return result;
  }

  if (!cfg.apiKey) {
    throw new ApiKeyRequiredError();
  }

  const direct = await callProviderDirect({
    provider: effectiveProvider,
    apiKey: cfg.apiKey,
    model: effectiveModel,
    systemPrompt,
    userPrompt,
    maxTokens,
    temperature
  });
  recordCallMetrics(direct);
  return direct;
}

export async function transcribeAudioBase64({ audioBase64, mimeType = "audio/webm", lang = "en-US" } = {}) {
  if (!hasApiKey()) {
    throw new ApiKeyRequiredError("API key required for voice transcription.");
  }

  if (typeof audioBase64 !== "string" || !audioBase64.trim()) {
    throw new Error("No audio data recorded.");
  }

  const cfg = getLlmConfig();
  const effectiveProvider =
    !cfg.apiKey && cfg.serverConfigured && isValidProvider(cfg.serverProvider)
      ? cfg.serverProvider
      : cfg.provider;

  if (!canUseBackendEndpoint()) {
    throw new Error("Audio transcription requires the local server (/api/analyze).");
  }

  let response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transcribe",
        customProvider: effectiveProvider,
        customKey: cfg.apiKey || undefined,
        audioBase64: audioBase64.trim(),
        mimeType: mimeType || "audio/webm",
        lang: lang || "en-US"
      })
    });
  } catch (err) {
    throw new Error(err?.message || "Failed to reach /api/analyze for transcription.");
  }

  let data = null;
  try {
    const text = await response.text();
    if (text) data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!response.ok || !data?.ok) {
    const message = data?.error || `Audio transcription failed (HTTP ${response.status}).`;
    if (response.status === 401 && !cfg.apiKey) {
      throw new ApiKeyRequiredError(message);
    }
    throw new Error(message);
  }

  return {
    transcript: typeof data.transcript === "string" ? data.transcript.trim() : ""
  };
}
