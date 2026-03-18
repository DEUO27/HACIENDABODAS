const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODELS = [
  "gemini-3-flash-preview",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const payload = await req.json();
    const prompt = buildPrompt(payload);
    const provider = payload.provider || "gemini";

    if (provider === "openai") {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      try {
        const result = await callOpenAI(apiKey, prompt);
        const parsed = parseOpenAIResponse(result);

        const response = {
          chart_insights: parsed.chart_insights || {},
          generated_at: new Date().toISOString(),
          model: "gpt-4o-mini",
        };

        return new Response(
          JSON.stringify(response),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("OpenAI failed:", err.message);
        return new Response(
          JSON.stringify({ error: "OpenAI call failed", details: err.message }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    } else {
      const apiKey = Deno.env.get("GEMINI_API_KEY");

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      let lastError = null;
      let usedModel = null;

      for (const model of MODELS) {
        try {
          const result = await callGemini(apiKey, model, prompt);
          usedModel = model;

          const parsed = parseGeminiResponse(result);

          const response = {
            chart_insights: parsed.chart_insights || {},
            generated_at: new Date().toISOString(),
            model: usedModel,
          };

          return new Response(
            JSON.stringify(response),
            { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        } catch (modelErr) {
          console.error(`Model ${model} failed:`, modelErr.message);
          lastError = modelErr;
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      return new Response(
        JSON.stringify({ error: "All Gemini models failed", details: lastError?.message || String(lastError) }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

async function callGemini(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
  }

  return await res.json();
}

function parseGeminiResponse(geminiData) {
  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    return JSON.parse(rawText);
  } catch (_e) {
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);

    const objMatch = rawText.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);

    throw new Error(`Could not parse Gemini response as JSON.\nRaw Text: ${rawText}\nFull Data: ${JSON.stringify(geminiData)}`);
  }
}

async function callOpenAI(apiKey, prompt) {
  const url = `https://api.openai.com/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un analista experto de CRM para una empresa de bodas y eventos premium. Responde estrictamente con un JSON valido usando la estructura solicitada." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
  }

  return await res.json();
}

function parseOpenAIResponse(openAIData) {
  const rawText = openAIData?.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(rawText);
  } catch (e) {
    throw new Error("Could not parse OpenAI response as JSON");
  }
}

function buildPrompt(data) {
  return `CONTEXTO: Eres un analista de CRM de una empresa de bodas y eventos premium ("Hacienda Bodas").

OBJETIVO: Generar UNICAMENTE interpretaciones ejecutivas breves para 4 graficas de un reporte PDF. Cada interpretacion debe explicar que significa el dato para el negocio, no describir la grafica visualmente.

DATOS DEL PERIODO: ${data.timeframe || "No especificado"}

METRICAS:
  - Total leads: ${data.totals?.total_filtrados ?? 0}
  - Activos: ${data.totals?.activos ?? 0}
  - Seguimientos NO CONTESTA (+24hrs): ${data.totals?.seguimientos_no_contesta ?? 0} (${data.totals?.pct_no_contesta ?? 0}%)

TENDENCIA DIARIA (ultimos 10 dias):
${JSON.stringify(data.trends?.ultimos_10_dias || [])}

PIPELINE - FASES DEL EMBUDO:
${JSON.stringify(data.pipeline || [])}

CANALES DE CONTACTO:
${JSON.stringify(data.canales || [])}

TIPOS DE EVENTO:
${JSON.stringify(data.eventos || [])}

---
REGLAS:
- Cada insight debe ser maximo 2-3 lineas.
- Tono ejecutivo: conecta CAUSA -> EFECTO EN NEGOCIO.
- NO describas la grafica visualmente; interpreta el impacto.
- NO uses emojis. Usa caracteres ASCII y acentos estandar.
- NO inventes datos que no esten en el payload.

RESPONDE SOLO CON ESTE JSON (sin markdown, sin texto adicional):
{
  "chart_insights": {
    "leads_by_day": "Interpretacion de la tendencia diaria: patrones, picos, caidas y su significado comercial.",
    "leads_by_fase": "Interpretacion del embudo: fase dominante, cuellos de botella, implicaciones en conversion.",
    "leads_by_canal": "Efectividad de canales de contacto: volumen, oportunidades, riesgos.",
    "leads_by_evento": "Demanda por tipo de evento: que domina, tendencias, oportunidades de oferta."
  }
}`;
}
