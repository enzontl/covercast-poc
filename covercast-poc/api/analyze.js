export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { action, command, currentState, customProvider, customKey } = body || {};

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

    if (!provider || !apiKey || action !== "command") {
      return res.status(200).json({ mode: "calibrated-engine" });
    }

    const systemPrompt = `You are CoverCast, a restaurant kitchen copilot parsing Chef Karim's messy voice/text instruction into structured order mutations.
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

    const userPrompt = JSON.stringify({ chefNote: command, currentState });
    const t0 = Date.now();

    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });
      if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}`);
      const data = await r.json();
      const inTok = data.usage?.prompt_tokens || 680;
      const outTok = data.usage?.completion_tokens || 180;
      const costUsd = inTok * 0.15e-6 + outTok * 0.6e-6;
      const parsed = JSON.parse(data.choices[0].message.content);
      return res.status(200).json({
        mode: "live-llm",
        latencyMs: Date.now() - t0,
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
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\nINPUT:\n${userPrompt}` }] }]
        })
      });
      if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
      const data = await r.json();
      const inTok = data.usageMetadata?.promptTokenCount || 680;
      const outTok = data.usageMetadata?.candidatesTokenCount || 180;
      const costUsd = inTok * 0.15e-6 + outTok * 0.6e-6;
      const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
      return res.status(200).json({
        mode: "live-llm",
        latencyMs: Date.now() - t0,
        costUsd: Number(costUsd.toFixed(6)),
        ...parsed
      });
    }

    if (provider === "anthropic") {
      const modelId = body.customModel || "claude-haiku-5-5";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 550,
          temperature: 0.1,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        })
      });
      if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}`);
      const data = await r.json();
      const inTok = data.usage?.input_tokens || 700;
      const outTok = data.usage?.output_tokens || 180;
      const costUsd = inTok * 0.8e-6 + outTok * 4.0e-6;
      const raw = data.content[0].text;
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : raw);
      return res.status(200).json({
        mode: "live-llm",
        model: modelId,
        latencyMs: Date.now() - t0,
        costUsd: Number(costUsd.toFixed(6)),
        ...parsed
      });
    }

    return res.status(200).json({ mode: "calibrated-engine" });
  } catch (err) {
    return res.status(200).json({ mode: "calibrated-engine", fallbackReason: err.message });
  }
}
