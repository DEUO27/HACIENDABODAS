const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Models to try in order (different quota buckets)
const MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
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
          resumen_ejecutivo: Array.isArray(parsed.resumen_ejecutivo) ? parsed.resumen_ejecutivo : ["Resumen no disponible."],
          top_insights: Array.isArray(parsed.top_insights) ? parsed.top_insights : [],
          next_actions: Array.isArray(parsed.next_actions) ? parsed.next_actions : [],
          chart_insights: parsed.chart_insights || {},
          impacto_esperado: parsed.impacto_esperado || "",
          nota_comparativo: parsed.nota_comparativo || "",
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
      // Gemini logic
      const apiKey = Deno.env.get("GEMINI_API_KEY");

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      // Try each model until one succeeds
      let lastError = null;
      let usedModel = null;

      for (const model of MODELS) {
        try {
          const result = await callGemini(apiKey, model, prompt);
          usedModel = model;

          const parsed = parseGeminiResponse(result);

          const response = {
            resumen_ejecutivo: Array.isArray(parsed.resumen_ejecutivo) ? parsed.resumen_ejecutivo : ["Resumen no disponible."],
            top_insights: Array.isArray(parsed.top_insights) ? parsed.top_insights : [],
            next_actions: Array.isArray(parsed.next_actions) ? parsed.next_actions : [],
            chart_insights: parsed.chart_insights || {},
            impacto_esperado: parsed.impacto_esperado || "",
            nota_comparativo: parsed.nota_comparativo || "",
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
          // Wait a bit before trying the next model
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // All models failed
      return new Response(
        JSON.stringify({ error: "All Gemini models failed", details: lastError?.message }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
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
        maxOutputTokens: 1500,
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
    // Try markdown-wrapped JSON
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);

    const objMatch = rawText.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);

    throw new Error("Could not parse Gemini response as JSON");
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
        { role: "system", content: "Eres un analista experto de CRM. Responde estrictamente con un JSON valido usando la estructura solicitada." },
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
  return `CONTEXTO: Eres el Director Comercial y Analista de Negocio CRM de una empresa de bodas y eventos premium. Generas reportes ejecutivos para la Gerencia General.

OBJETIVO: Producir un analisis ejecutivo de negocio, NO un resumen descriptivo. El reporte debe responder:
1. Que esta pasando en el pipeline comercial y por que importa financieramente.
2. Donde estan los cuellos de botella operativos que afectan conversion.
3. Que acciones concretas ejecutar en los proximos 7-14 dias para mejorar resultados.

DATOS DEL PERIODO: ${data.timeframe || "No especificado"}

VOLUMEN:
  - Total leads filtrados: ${data.totals?.total_filtrados ?? 0}
  - Nuevos hoy: ${data.totals?.nuevos_hoy ?? 0}
  - Nuevos (7 dias): ${data.totals?.nuevos_7d ?? 0}
  - Activos: ${data.totals?.activos ?? 0}
  - Perdidos: ${data.totals?.perdidos ?? 0}

TENDENCIAS TEMPORALES (Graficas de Volumen):
  - Leads por dia (ultimos 10 dias): ${JSON.stringify(data.trends?.ultimos_10_dias || [])}
  - Top 5 horas pico de captura: ${JSON.stringify(data.trends?.horas_pico || [])}

PIPELINE (fases del embudo):
${JSON.stringify(data.pipeline || [], null, 2)}

ADQUISICION:
  - Top origenes: ${JSON.stringify(data.acquisition?.top_origenes || [])}
  - Top canales: ${JSON.stringify(data.acquisition?.top_canales || [])}

EVENTOS:
  - Top tipos de evento: ${JSON.stringify(data.events?.top_eventos || [])}

EQUIPO:
  - Top vendedoras por volumen: ${JSON.stringify(data.team?.por_volumen || [])}
  - Top vendedoras con +24H sin respuesta: ${JSON.stringify(data.team?.por_24h || [])}

CALIDAD DE DATOS (% faltante por campo):
${JSON.stringify(data.data_quality || {}, null, 2)}

LEADS CRITICOS (ejemplo anonimizado):
${JSON.stringify(data.examples || [], null, 2)}

---
REGLAS ESTRICTAS DE REDACCION (OBLIGATORIAS):

1. CONTRADICCIONES DE ASIGNACION:
   - Si hay un volumen grande de leads "Sin Asignar", NUNCA escribas "Sin Asignar lidera con X leads asignados" ni frases similares.
   - Redacta asi: Primero, indica cuantos leads estan sin asignar y el riesgo operativo que esto representa. Segundo, indica quien lidera ENTRE los leads efectivamente asignados.
   - La logica debe ser impecable para que Gerencia no encuentre contradicciones.

2. TONO EJECUTIVO (no generico):
   - PROHIBIDO usar adjetivos vagos como "preocupante", "alarmante", "significativo" sin aterrizarlos en impacto.
   - USA estos terminos de negocio: "riesgo operativo", "cuello de botella en conversion", "perdida de trazabilidad", "impacto en contactabilidad", "impacto en priorizacion comercial", "prioridad de correccion inmediata".
   - Cada hallazgo debe conectar CAUSA -> EFECTO EN NEGOCIO.

3. RESUMEN EJECUTIVO = DIAGNOSTICO, NO DESCRIPCION:
   - No listes metricas sin conclusion. Cada parrafo debe explicar: que pasa, por que importa, que priorizar.
   - El resumen debe sonar como un diagnostico para toma de decisiones, no como un comentario general.
   - Cierra con las 3 prioridades inmediatas del negocio.

4. ACCIONES SMART CON RESPONSABLES OPERATIVOS:
   - PROHIBIDO usar acciones vagas como "mejorar calidad de datos" o "dar seguimiento".
   - Cada accion debe ser ejecutable y medible: que se hara, quien lo hara, meta numerica, deadline.
   - Si hay problemas de data quality, separa metas por campo critico (telefono, fecha, origen) en vez de una meta global ambigua.
   - Responsables especificos: "Coordinacion Comercial", "Equipo de Ventas / SDRs", "Operaciones / Admin CRM", "Marketing (atribucion)", "Gerencia Comercial". Nunca dejes una accion sin dueno claro.

5. DATA QUALITY = IMPACTO OPERATIVO:
   - Para cada campo faltante, explica el impacto concreto:
     * Telefono faltante -> afecta contactabilidad directa, imposibilita seguimiento telefonico.
     * Fecha de evento faltante -> impide priorizacion comercial por urgencia temporal.
     * Origen/source faltante -> genera perdida de trazabilidad en atribucion de marketing, impide optimizar inversion publicitaria.
   - No solo reportes porcentajes; conectalos con la ejecucion comercial.

6. ANOMALIAS Y PRUDENCIA:
   - Si un patron parece inusual (horarios atipicos, distribuciones extrannas), mencionalo como "punto a validar" antes de convertirlo en recomendacion definitiva.
   - Usa redaccion prudente: "Se sugiere validar si..." en lugar de afirmaciones categoricas sobre datos que podrian depender de configuracion (zonas horarias, timestamps, etc.).

7. CONSISTENCIA NARRATIVA:
   - Todas las secciones (resumen_ejecutivo, top_insights, next_actions, impacto_esperado, chart_insights) deben mantener el mismo nivel de profundidad y tono profesional.
   - Evita que una seccion suene muy ejecutiva y otra demasiado simple.
   - El documento completo debe leerse como una sola narrativa coherente orientada a decisiones.

8. FORMATO Y ENCODING:
   - NO uses emojis ni simbolos especiales que puedan romperse en PDF.
   - Usa solo caracteres ASCII seguros y acentos estandar del espanol.
   - Mantene consistencia tipografica: sin mezclar mayusculas aleatorias, sin abreviaciones inconsistentes.

9. NO INVENTES DATOS:
   - Si falta informacion para una conclusion, dilo transparentemente: "No se cuenta con datos comparativos temporales para evaluar tendencia".
   - No extrapoles resultados sin base en los datos proporcionados.

10. INTERPRETACION DE GRAFICOS (chart_insights) - OBLIGATORIO:
   - DEBES incluir el objeto "chart_insights" en tu respuesta JSON. NUNCA lo omitas.
   - Redacta un parrafo corto (maximo 2 lineas) para interpretar cada metrica clave (tendencias, fases, canales, etc.).
   - No describas la grafica visualmente, interpreta lo que el dato significa para el negocio (ej: "El pico de leads a las 18:00 sugiere que las campanas deben reforzarse en la tarde").

11. MANEJO DE DATOS DEL SISTEMA AMOCRM:
   - Si observas el origen o canal "com.amocrm.amocrmwa", TRATALO ESTRICTAMENTE como un dato "Sin Informacion" (metadata interna del sistema que perdio su trazabilidad original).
   - Si esto aparece en multiples leads, levanta una alerta recomendando a Operaciones corregir la captura o revisar el "como nos encontro" original.

---
ESTRUCTURA JSON DE RESPUESTA (devuelve SOLO este JSON, sin markdown, sin texto adicional, "chart_insights" es REQUERIDO):
{
  "resumen_ejecutivo": [
    "Parrafo 1 - Diagnostico del Pipeline: Estado actual del embudo (volumen total, ratio activos vs perdidos, fase dominante). Conecta con impacto en conversion.",
    "Parrafo 2 - Gestion Operativa: Analisis de asignacion (leads sin asignar vs asignados, quien lidera entre los asignados). Tiempos de respuesta +24H y su riesgo. Si hay leads sin asignar, explica primero ese volumen y luego la distribucion entre vendedoras asignadas.",
    "Parrafo 3 - Calidad de Datos y Adquisicion: Evaluacion campo por campo de datos faltantes con impacto operativo especifico. Canales de origen y trazabilidad.",
    "Parrafo 4 - Sintesis y Prioridades: Conclusion ejecutiva con las 3 prioridades inmediatas para la proxima semana, ordenadas por impacto de negocio."
  ],
  "top_insights": [
    {"hallazgo": "Hallazgo sobre Rendimiento Comercial y Pipeline", "impacto": "Impacto concreto en conversion, cierre o revenue"},
    {"hallazgo": "Hallazgo sobre Gestion Operativa (asignacion, tiempos de respuesta)", "impacto": "Riesgo operativo: cuello de botella, leads sin atencion, capacidad del equipo"},
    {"hallazgo": "Hallazgo sobre Calidad de Datos o Atribucion de Marketing", "impacto": "Consecuencia: perdida de trazabilidad, imposibilidad de optimizar canales, impacto en contactabilidad"}
  ],
  "next_actions": [
    {
      "accion": "Verbo de accion concreto + descripcion ejecutable (ej: 'Reasignar los leads sin vendedora activa mediante revision manual del backlog')",
      "responsable": "Rol operativo especifico (ej: 'Coordinacion Comercial')",
      "meta": "Metrica numerica concreta y alcanzable basada en los datos (ej: 'Reducir leads sin asignar de X a Y')",
      "tiempo": "Deadline claro (ej: 'Proximos 3 dias habiles')"
    },
    {
      "accion": "Segunda accion prioritaria",
      "responsable": "Rol operativo especifico",
      "meta": "Metrica numerica concreta",
      "tiempo": "Deadline claro"
    },
    {
      "accion": "Tercera accion prioritaria",
      "responsable": "Rol operativo especifico",
      "meta": "Metrica numerica concreta",
      "tiempo": "Deadline claro"
    }
  ],
  "chart_insights": {
    "leads_by_day": "Interpretacion ejecutiva de la tendencia diaria de leads (max 2 lineas).",
    "leads_by_hour": "Interpretacion ejecutiva de los horarios de captura (max 2 lineas).",
    "leads_by_fase": "Interpretacion del embudo actual y principales cuellos de botella (max 2 lineas).",
    "leads_by_vendedora": "Desempeno de asignacion y carga liderada por equipo de ventas (max 2 lineas).",
    "top_origenes": "Rendimiento y calidad de las principales fuentes de trafico (max 2 lineas).",
    "leads_by_canal": "Efectividad y uso de los canales de contacto directo (max 2 lineas).",
    "leads_by_evento": "Demanda e interes predominante por tipo de evento (max 2 lineas).",
    "data_quality": "Resumen del riesgo operativo por campos faltantes en este periodo (max 2 lineas)."
  },
  "impacto_esperado": "Un parrafo breve y concreto explicando que mejora comercial y operativa se proyecta si se ejecutan las 3 acciones. Conectar con conversion, tiempos de respuesta y calidad de pipeline. Sin promesas exageradas; basarse en los datos disponibles.",
  "nota_comparativo": "Nota breve: Este analisis se basa en el historico total del periodo seleccionado. Se recomienda implementar comparativos temporales (ultimos 7 dias vs periodo anterior) en proximas versiones para evaluar tendencias, estacionalidad y efectividad de acciones correctivas."
}`;
}
