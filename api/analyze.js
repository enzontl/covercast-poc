const PROVIDER_DEFAULTS = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash"
};

const MODEL_PRICING_PER_M = {
  // Anthropic
  "claude-haiku-4-5": { inPerM: 1.0, outPerM: 5.0 },
  "claude-sonnet-4-5": { inPerM: 3.0, outPerM: 15.0 },
  "claude-opus-4-5": { inPerM: 15.0, outPerM: 75.0 },
  "claude-3-5-haiku-latest": { inPerM: 0.8, outPerM: 4.0 },
  // OpenAI
  "gpt-4o-mini": { inPerM: 0.15, outPerM: 0.6 },
  "gpt-4.1-mini": { inPerM: 0.4, outPerM: 1.6 },
  "gpt-4o": { inPerM: 2.5, outPerM: 10.0 },
  // Gemini
  "gemini-2.5-flash": { inPerM: 0.15, outPerM: 0.6 },
  "gemini-2.5-pro": { inPerM: 1.25, outPerM: 10.0 }
};

const PROVIDER_FALLBACK_PRICING = {
  anthropic: { inPerM: 1.0, outPerM: 5.0 },
  openai: { inPerM: 0.15, outPerM: 0.6 },
  gemini: { inPerM: 0.15, outPerM: 0.6 }
};

const LEGACY_COMMAND_SYSTEM_PROMPT = `You are CoverCast, a restaurant kitchen copilot parsing Chef Karim's messy voice/text instruction into structured order mutations.
NEVER do order total math — only emit structured mutations so our deterministic engine recalculates exact quantities and euros.
Return strict JSON only:
{
  "reply": "1 crisp kitchen sentence confirming what you changed (max 20 words)",
  "mutation": {
    "coverDelta": 0,
    "coverReason": "short reason if coverDelta != 0",
    "weather": null,
    "skuEdits": [
      { "id": "cod|bavette|buns|mesclun|cream|tomatoes", "newName": null, "newUnitPrice": null, "setStock": null, "qtyDelta": 0 }
    ]
  }
}
Valid weather values if changed: "heavy_rain", "light_rain", "cloudy", "sunny".`;

function detectProviderFromKey(key) {
  if (typeof key !== "string") return null;
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("sk-ant-")) return "anthropic";
  if (trimmed.startsWith("sk-")) return "openai";
  if (trimmed.startsWith("AIza")) return "gemini";
  return null;
}

function getEnvProvider() {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

function getEnvKeyForProvider(provider) {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY || "";
  if (provider === "openai") return process.env.OPENAI_API_KEY || "";
  if (provider === "gemini") return process.env.GEMINI_API_KEY || "";
  return "";
}

function resolvePricing(provider, model) {
  if (MODEL_PRICING_PER_M[model]) return MODEL_PRICING_PER_M[model];
  const lower = String(model || "").toLowerCase();
  if (provider === "anthropic") {
    if (lower.includes("opus")) return { inPerM: 15.0, outPerM: 75.0 };
    if (lower.includes("sonnet")) return { inPerM: 3.0, outPerM: 15.0 };
    if (lower.includes("3-5-haiku")) return { inPerM: 0.8, outPerM: 4.0 };
    return PROVIDER_FALLBACK_PRICING.anthropic;
  }
  if (provider === "openai") {
    if (lower.includes("4.1-mini")) return { inPerM: 0.4, outPerM: 1.6 };
    if (lower.includes("4o-mini")) return { inPerM: 0.15, outPerM: 0.6 };
    if (lower.includes("4o")) return { inPerM: 2.5, outPerM: 10.0 };
    return PROVIDER_FALLBACK_PRICING.openai;
  }
  if (provider === "gemini") {
    if (lower.includes("pro")) return { inPerM: 1.25, outPerM: 10.0 };
    return PROVIDER_FALLBACK_PRICING.gemini;
  }
  return { inPerM: 1.0, outPerM: 5.0 };
}

function computeCostUsd(provider, model, inputTokens, outputTokens) {
  const { inPerM, outPerM } = resolvePricing(provider, model);
  const raw = (inputTokens * inPerM + outputTokens * outPerM) / 1_000_000;
  return Number(raw.toFixed(6));
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

async function extractUpstreamError(response, providerLabel) {
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
    // ignore body read error
  }

  const concise = detail ? detail.replace(/\s+/g, " ").slice(0, 240) : response.statusText || "Upstream request failed";
  return `${providerLabel} API error (${response.status}): ${concise}`;
}

function normalizeHttpErrorStatus(status) {
  if (typeof status === "number" && status >= 400 && status <= 599) {
    return status;
  }
  return 502;
}

async function callAnthropic({ apiKey, model, systemPrompt, userPrompt, maxTokens, temperature }) {
  const payload = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: "user", content: userPrompt }]
  };
  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = new Error(await extractUpstreamError(response, "Anthropic"));
    error.statusCode = normalizeHttpErrorStatus(response.status);
    throw error;
  }

  const data = await response.json();
  const rawText = Array.isArray(data?.content)
    ? data.content
        .filter((block) => block && block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("\n")
    : "";

  const inputTokens = Number(data?.usage?.input_tokens ?? 0);
  const outputTokens = Number(data?.usage?.output_tokens ?? 0);
  return { rawText, inputTokens, outputTokens };
}

async function callOpenAI({ apiKey, model, systemPrompt, userPrompt, maxTokens, temperature }) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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

  if (!response.ok) {
    const error = new Error(await extractUpstreamError(response, "OpenAI"));
    error.statusCode = normalizeHttpErrorStatus(response.status);
    throw error;
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content ?? "";
  const inputTokens = Number(data?.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(data?.usage?.completion_tokens ?? 0);
  return { rawText, inputTokens, outputTokens };
}

async function callGemini({ apiKey, model, systemPrompt, userPrompt, maxTokens, temperature }) {
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = new Error(await extractUpstreamError(response, "Gemini"));
    error.statusCode = normalizeHttpErrorStatus(response.status);
    throw error;
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const rawText = Array.isArray(parts)
    ? parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("\n")
    : "";
  const inputTokens = Number(data?.usageMetadata?.promptTokenCount ?? 0);
  const outputTokens = Number(data?.usageMetadata?.candidatesTokenCount ?? 0);
  return { rawText, inputTokens, outputTokens };
}

function normalizeAudioMimeType(mimeType) {
  const raw = typeof mimeType === "string" ? mimeType.trim() : "";
  const base = raw.split(";")[0].trim().toLowerCase();
  return base || "audio/webm";
}

function extensionForAudioMime(baseMime) {
  if (baseMime.includes("mp4") || baseMime.includes("m4a")) return "mp4";
  if (baseMime.includes("ogg")) return "ogg";
  if (baseMime.includes("wav")) return "wav";
  if (baseMime.includes("mpeg") || baseMime.includes("mp3")) return "mp3";
  if (baseMime.includes("flac")) return "flac";
  return "webm";
}

async function transcribeWithOpenAI({ apiKey, audioBase64, mimeType, lang }) {
  const baseMime = normalizeAudioMimeType(mimeType);
  const buffer = Buffer.from(audioBase64, "base64");
  if (!buffer.length) {
    const error = new Error("Audio recording was empty.");
    error.statusCode = 400;
    throw error;
  }

  const ext = extensionForAudioMime(baseMime);
  const blob = new Blob([buffer], { type: baseMime });
  const form = new FormData();
  form.append("file", blob, `voice-note.${ext}`);
  form.append("model", "whisper-1");
  const langCode = typeof lang === "string" && lang.trim()
    ? lang.trim().slice(0, 2).toLowerCase()
    : "en";
  form.append("language", langCode);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  });

  if (!response.ok) {
    const error = new Error(await extractUpstreamError(response, "OpenAI"));
    error.statusCode = normalizeHttpErrorStatus(response.status);
    throw error;
  }

  const data = await response.json();
  return typeof data?.text === "string" ? data.text.trim() : "";
}

async function transcribeWithGemini({ apiKey, audioBase64, mimeType }) {
  const baseMime = normalizeAudioMimeType(mimeType);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 300
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: baseMime,
              data: audioBase64
            }
          },
          {
            text: "Transcribe this short restaurant kitchen voice note verbatim. Return only the transcribed text, no quotes or commentary."
          }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = new Error(await extractUpstreamError(response, "Gemini"));
    error.statusCode = normalizeHttpErrorStatus(response.status);
    throw error;
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const transcript = Array.isArray(parts)
    ? parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join(" ").trim()
    : "";
  return transcript;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid JSON request body." });
  }

  const { action } = body;

  if (action === "status") {
    const envProvider = getEnvProvider();
    return res.status(200).json({
      ok: true,
      serverConfigured: Boolean(envProvider),
      provider: envProvider || null
    });
  }

  if (action !== "agent-json" && action !== "command" && action !== "transcribe") {
    return res.status(400).json({
      ok: false,
      error: "Unsupported action. Expected 'status', 'agent-json', or 'transcribe'."
    });
  }

  const rawCustomKey = typeof body.customKey === "string" ? body.customKey.trim() : "";
  const rawCustomProvider = typeof body.customProvider === "string" ? body.customProvider.trim().toLowerCase() : "";
  const rawCustomModel = typeof body.customModel === "string" ? body.customModel.trim() : "";

  let provider = "";
  let apiKey = "";

  if (rawCustomKey) {
    provider = PROVIDER_DEFAULTS[rawCustomProvider]
      ? rawCustomProvider
      : detectProviderFromKey(rawCustomKey) || "";
    apiKey = rawCustomKey;
  } else {
    if (rawCustomProvider && PROVIDER_DEFAULTS[rawCustomProvider] && getEnvKeyForProvider(rawCustomProvider)) {
      provider = rawCustomProvider;
      apiKey = getEnvKeyForProvider(rawCustomProvider);
    } else {
      const envProvider = getEnvProvider();
      if (envProvider) {
        provider = envProvider;
        apiKey = getEnvKeyForProvider(envProvider);
      }
    }
  }

  if (!apiKey || !provider) {
    return res.status(401).json({
      ok: false,
      error:
        action === "transcribe"
          ? "API key required for voice transcription."
          : "API key required. Connect an Anthropic, OpenAI, or Gemini key."
    });
  }

  if (!PROVIDER_DEFAULTS[provider]) {
    return res.status(400).json({
      ok: false,
      error: `Unsupported provider '${provider}'. Use anthropic, openai, or gemini.`
    });
  }

  if (action === "transcribe") {
    if (provider === "anthropic") {
      return res.status(400).json({
        ok: false,
        error: "Anthropic API does not provide audio transcription; open in Chrome/Edge for built-in browser speech recognition."
      });
    }

    const rawAudio = typeof body.audioBase64 === "string" ? body.audioBase64.trim() : "";
    const audioBase64 =
      rawAudio.startsWith("data:") && rawAudio.includes(",")
        ? rawAudio.slice(rawAudio.indexOf(",") + 1).trim()
        : rawAudio;

    if (!audioBase64) {
      return res.status(400).json({
        ok: false,
        error: "Missing audioBase64 payload for voice transcription."
      });
    }

    try {
      let transcript = "";
      if (provider === "openai") {
        transcript = await transcribeWithOpenAI({
          apiKey,
          audioBase64,
          mimeType: body.mimeType,
          lang: body.lang
        });
      } else if (provider === "gemini") {
        transcript = await transcribeWithGemini({
          apiKey,
          audioBase64,
          mimeType: body.mimeType
        });
      }
      return res.status(200).json({ ok: true, transcript });
    } catch (err) {
      const statusCode = normalizeHttpErrorStatus(err?.statusCode);
      return res.status(statusCode).json({
        ok: false,
        error: err?.message || "Upstream audio transcription failed."
      });
    }
  }

  const model = rawCustomModel || PROVIDER_DEFAULTS[provider];
  const systemPrompt =
    typeof body.systemPrompt === "string"
      ? body.systemPrompt
      : action === "command"
        ? LEGACY_COMMAND_SYSTEM_PROMPT
        : "";
  const userPrompt =
    typeof body.userPrompt === "string" && body.userPrompt.trim()
      ? body.userPrompt
      : action === "command" && body.command
        ? JSON.stringify({ chefNote: body.command, currentState: body.currentState })
        : "";

  if (!userPrompt) {
    return res.status(400).json({
      ok: false,
      error: "Missing userPrompt for agent-json request."
    });
  }

  const maxTokensNum = Number(body.maxTokens);
  const maxTokens = Number.isFinite(maxTokensNum) && maxTokensNum > 0
    ? Math.min(Math.round(maxTokensNum), 4096)
    : 700;

  const tempNum = Number(body.temperature);
  const temperature = Number.isFinite(tempNum)
    ? Math.min(Math.max(tempNum, 0), 1)
    : 0.2;

  const t0 = Date.now();
  try {
    let result;
    if (provider === "anthropic") {
      result = await callAnthropic({ apiKey, model, systemPrompt, userPrompt, maxTokens, temperature });
    } else if (provider === "openai") {
      result = await callOpenAI({ apiKey, model, systemPrompt, userPrompt, maxTokens, temperature });
    } else {
      result = await callGemini({ apiKey, model, systemPrompt, userPrompt, maxTokens, temperature });
    }

    let parsed;
    try {
      parsed = parseJsonObject(result.rawText);
    } catch (parseErr) {
      return res.status(502).json({
        ok: false,
        error: parseErr.message || "Model returned invalid JSON."
      });
    }

    const latencyMs = Date.now() - t0;
    const costUsd = computeCostUsd(provider, model, result.inputTokens, result.outputTokens);

    return res.status(200).json({
      ok: true,
      mode: "live-llm",
      provider,
      model,
      latencyMs,
      costUsd,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens
      },
      parsed,
      rawText: result.rawText
    });
  } catch (err) {
    const statusCode = normalizeHttpErrorStatus(err?.statusCode);
    return res.status(statusCode).json({
      ok: false,
      error: err?.message || "Upstream LLM request failed."
    });
  }
}
