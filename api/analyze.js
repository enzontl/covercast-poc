export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-LLM-Provider, X-LLM-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { context, forecast, orderSummary, customProvider, customKey } = body || {};

    const provider =
      customProvider ||
      (process.env.OPENAI_API_KEY ? "openai" : "") ||
      (process.env.GEMINI_API_KEY ? "gemini" : "") ||
      (process.env.ANTHROPIC_API_KEY ? "anthropic" : "");

    const apiKey =
      customKey ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.ANTHROPIC_API_KEY;

    if (!provider || !apiKey) {
      return res.status(200).json({
        mode: "calibrated-engine",
        message: "No external API key set on server; using calibrated CoverCast hybrid engine."
      });
    }

    const systemPrompt = `You are CoverCast, a surgical nightly order-preparation AI copilot for Head Chef Karim at Bistrot Urbain (Paris, 12 sites).
IMPORTANT GUARDRAIL: Never alter or invent cover numbers or euro totals. Use ONLY the exact deterministic numbers provided in the JSON payload.
Respond strictly as a compact JSON object with keys:
- "headline": 1 crisp sentence (max 22 words) explaining why tonight's cover forecast (${forecast.p50} covers, 90% CI ${forecast.p05}-${forecast.p95}) differs from the habitual baseline (${forecast.habitualCovers} covers).
- "drivers": array of 3 short strings (max 14 words each) explaining the booking, weather, and local event effects in plain kitchen English.
- "chefWatchout": 1 practical sentence (max 20 words) flagging which 1-2 perishable items need a quick physical fridge check before Karim clicks Approve.`;

    const userPrompt = JSON.stringify({
      site: "Bistrot Urbain #04 — Montparnasse (Paris 15e)",
      context,
      forecast,
      orderSummary
    });

    const t0 = Date.now();

    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });
      if (!r.ok) {
        const errText = await r.text();
        throw new Error(`OpenAI HTTP ${r.status}: ${errText.slice(0, 180)}`);
      }
      const data = await r.json();
      const latencyMs = Date.now() - t0;
      const inTok = data.usage?.prompt_tokens || 820;
      const outTok = data.usage?.completion_tokens || 210;
      const costUsd = inTok * (0.15 / 1_000_000) + outTok * (0.60 / 1_000_000);
      const parsed = JSON.parse(data.choices[0].message.content);

      return res.status(200).json({
        mode: "live-llm",
        model: "gpt-4o-mini (Live API)",
        latencyMs,
        inputTokens: inTok,
        outputTokens: outTok,
        costUsd: Number(costUsd.toFixed(6)),
        ...parsed
      });
    }

    if (provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          },
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\nINPUT:\n${userPrompt}` }]
            }
          ]
        })
      });
      if (!r.ok) {
        const errText = await r.text();
        throw new Error(`Gemini HTTP ${r.status}: ${errText.slice(0, 180)}`);
      }
      const data = await r.json();
      const latencyMs = Date.now() - t0;
      const inTok = data.usageMetadata?.promptTokenCount || 840;
      const outTok = data.usageMetadata?.candidatesTokenCount || 215;
      const costUsd = inTok * (0.15 / 1_000_000) + outTok * (0.60 / 1_000_000);
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = JSON.parse(rawText);

      return res.status(200).json({
        mode: "live-llm",
        model: "gemini-2.5-flash (Live API)",
        latencyMs,
        inputTokens: inTok,
        outputTokens: outTok,
        costUsd: Number(costUsd.toFixed(6)),
        ...parsed
      });
    }

    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 450,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        })
      });
      if (!r.ok) {
        const errText = await r.text();
        throw new Error(`Anthropic HTTP ${r.status}: ${errText.slice(0, 180)}`);
      }
      const data = await r.json();
      const latencyMs = Date.now() - t0;
      const inTok = data.usage?.input_tokens || 850;
      const outTok = data.usage?.output_tokens || 220;
      const costUsd = inTok * (0.80 / 1_000_000) + outTok * (4.0 / 1_000_000);
      const rawText = data.content?.[0]?.text || "{}";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

      return res.status(200).json({
        mode: "live-llm",
        model: "claude-3-5-haiku (Live API)",
        latencyMs,
        inputTokens: inTok,
        outputTokens: outTok,
        costUsd: Number(costUsd.toFixed(6)),
        ...parsed
      });
    }

    return res.status(200).json({ mode: "calibrated-engine" });
  } catch (err) {
    return res.status(200).json({
      mode: "calibrated-engine",
      fallbackReason: err.message
    });
  }
}
