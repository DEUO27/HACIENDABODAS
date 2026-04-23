import "jsr:@supabase/functions-js/edge-runtime.d.ts"
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// AI Provider interface
interface AIProvider {
  generateNorm(prompt: string, payload: any): Promise<any>;
}

// ------------------------------------------------------------------
// GEMINI PROVIDER
// ------------------------------------------------------------------
class GeminiProvider implements AIProvider {
  private apiKey: string;
  private apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateNorm(prompt: string, payload: any): Promise<any> {
    // Wrap in object to ensure the root is always {} and not []
    const fullPrompt = `${prompt}\n\nAquí está el JSON de entrada:\n${JSON.stringify({ leads: payload })}`;

    const reqBody = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.1, // Deterministic
        // Force JSON output
        responseMimeType: "application/json"
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal: controller.signal
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errBody}`);
      }

      const data = await response.json();
      const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!contentText) {
        throw new Error("Invalid response structure from Gemini API");
      }

      // Parse the expected JSON
      try {
        const parsed = JSON.parse(contentText);
        // Unwrap if the AI adhered to the { leads: [...] } structure
        return parsed.leads ? parsed.leads : parsed;
      } catch (e) {
        throw new Error("Gemini did not return valid JSON");
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ------------------------------------------------------------------
// OPENAI PROVIDER
// ------------------------------------------------------------------
class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateNorm(prompt: string, payload: any): Promise<any> {
    // Wrap in object to strictly satisfy OpenAI's json_object requirement
    const fullPrompt = `${prompt}\n\nAquí está el JSON de entrada:\n${JSON.stringify({ leads: payload })}`;

    const reqBody = {
      model: "gpt-4o-mini", // Fast, cheap, and supports structured JSON with custom temperatures
      messages: [
        { role: "system", content: "Eres un asistente de IA útil diseñado para generar JSON determinísticamente." },
        { role: "user", content: fullPrompt }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(reqBody),
        signal: controller.signal
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenAI API Error (${response.status}): ${errBody}`);
      }

      const data = await response.json();
      const contentText = data.choices?.[0]?.message?.content;

      if (!contentText) {
        throw new Error("Invalid response structure from OpenAI API");
      }

      // Parse the expected JSON
      try {
        const parsed = JSON.parse(contentText);
        // Unwrap if the AI adhered to the { leads: [...] } structure
        return parsed.leads ? parsed.leads : parsed;
      } catch (e) {
        throw new Error("OpenAI did not return valid JSON");
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ------------------------------------------------------------------
// MAIN EDGE FUNCTION HANDLER
// ------------------------------------------------------------------
Deno.serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Input validation: expect an array of leads directly or { leads: [...] }
    let leadsArray = null;
    if (Array.isArray(body)) leadsArray = body;
    else if (body && Array.isArray(body.leads)) leadsArray = body.leads;

    if (!leadsArray || leadsArray.length === 0) {
      return new Response(JSON.stringify({ error: "No leads provided for normalization." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        // Return 200 so frontend can read the body
      });
    }

    // 2. Select AI Provider based on frontend parameter (default to Gemini if not 1)
    const providerChoice = body.provider === 1 ? 1 : 0; // 0 = Gemini, 1 = OpenAI
    let aiProvider: AIProvider;

    if (providerChoice === 1) {
      const openAiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAiKey) {
        throw new Error("Missing OPENAI_API_KEY environment variable. Set it in Supabase Secrets.");
      }
      aiProvider = new OpenAIProvider(openAiKey);
      console.log("Using OpenAI Provider");
    } else {
      const geminiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiKey) {
        throw new Error("Missing GEMINI_API_KEY environment variable. Set it in Supabase Secrets.");
      }
      aiProvider = new GeminiProvider(geminiKey);
      console.log("Using Gemini Provider");
    }

    // 3. The exact prompt provided by the user
    const SYSTEM_PROMPT = `ROL
Eres un normalizador determinístico de leads (canal + evento). Tu salida DEBE ser JSON válido.

OBJETIVO
Recibirás un JSON que contiene leads (puede ser un arreglo directamente o un objeto que contiene un arreglo de leads).
Debes devolver EXACTAMENTE el MISMO JSON de entrada (misma estructura, mismas llaves, mismo orden),
pero enriqueciendo CADA lead con estos campos nuevos:

NORMALIZACIÓN DE CANAL:
- canal_base
- canal_normalizado
- canal_razon (breve)

NORMALIZACIÓN DE EVENTO:
- evento_base
- evento_normalizado
- evento_razon (breve)

IMPORTANTE (FORMATO DE SALIDA)
- Devuelve SOLO JSON (sin explicaciones, sin texto, sin markdown).
- NO envuelvas el resultado en {meta, summary, leads}. NO agregues wrappers.
- NO elimines, renombres ni modifiques campos existentes.
- Conserva el orden de los leads y el orden general del JSON tanto como sea posible.
- Solo agrega los campos nuevos dentro de cada lead (no cambies nada más).

CÓMO ENCONTRAR EL ARREGLO DE LEADS (si la estructura es desconocida)
1) Si el JSON raíz es un array, ese array ES la lista de leads.
2) Si el JSON raíz es un objeto:
   - Si existe una propiedad llamada "leads" y es un array → ese es el array de leads.
   - Si no, busca la PRIMERA propiedad cuyo valor sea un array de objetos que contengan al menos uno de estos campos:
     "canal_de_contacto" o "como_nos_encontro" o "evento".
3) Si no encuentras ningún array de leads, devuelve exactamente el JSON original sin cambios.

================================================================================
PARTE A) NORMALIZACIÓN DE CANAL
================================================================================

REGLA A1: CREAR canal_base
Para cada lead:
- Si canal_de_contacto NO existe, es null, "", es exactamente "Sin Informacion", es exactamente "com.amocrm.amocrmwa", o contiene corchetes (ej. "[Lead: utm_source]", "[Variable]")
  → canal_base = como_nos_encontro (si existe, no tiene corchetes y NO es "com.amocrm.amocrmwa")
- Si canal_de_contacto existe, es distinto de "Sin Informacion", distinto de "com.amocrm.amocrmwa", y no tiene corchetes
  → canal_base = canal_de_contacto
- Si ambos no existen / son null / "" / "Sin Informacion" / "com.amocrm.amocrmwa" / tienen corchetes
  → canal_base = "Sin Informacion"
- Si canal_base contiene una negación tipo “el cliente se negó a brindar información”
  → canal_base = "Sin Informacion"

REGLA A2: NORMALIZAR canal_base A UNA CATEGORÍA (canal_normalizado)
Categorías permitidas (solo estas):
- Sin Informacion
- WhatsApp
- Bodas.com
- Google
- TikTok
- Recomendación
- Instagram
- Facebook
- Redes sociales (otro)
- Otro

PREPROCESAMIENTO A
- t = canal_base como string
- t_clean = trim(t) y pasar a minúsculas
- considera equivalentes de Sin Informacion: "sin informacion", "sin información", "", null, undefined, campo ausente

PRIORIDAD A (aplica la primera que haga match)
0) Si t_clean contiene "bodas.com", "bodas.com.mx" o "bodas.co"
   → canal_normalizado = "Bodas.com"
   → canal_razon = "Keyword_BodasCom"
   Esta regla gana sobre "Recomendación", "Google", "Redes sociales (otro)" y "Otro".

1) Si t_clean contiene "whatsapp"
   → canal_normalizado = "WhatsApp"
   → canal_razon = "match: whatsapp"

2) Si t_clean contiene "tiktok" o "tik tok"
   → canal_normalizado = "TikTok"
   → canal_razon = "match: tiktok"

3) Si t_clean contiene "instagram"
   → canal_normalizado = "Instagram"
   → canal_razon = "match: instagram"

4) Si t_clean contiene "facebook" o contiene "face"
   → canal_normalizado = "Facebook"
   → canal_razon = "match: facebook/face"

5) Si t_clean contiene "google" o "maps" o "google maps" o "buscador"
   o frases tipo "los busqué", "busqué", "por internet / buscador"
   → canal_normalizado = "Google"
   → canal_razon = "match: google/maps/buscador"

6) Si t_clean contiene "recomend" (recomendación/recomendacion/recomendaron)
   o menciona referido claro: "amiga", "familiar", "conocido", "suegros", "papás", "familia", "festejados"
   → canal_normalizado = "Recomendación"
   → canal_razon = "match: recomendación/referido"

7) Si t_clean contiene "redes sociales" o "redes"
   y NO contiene "tiktok"/"instagram"/"facebook"
   → canal_normalizado = "Redes sociales (otro)"
   → canal_razon = "match: redes (genérico)"

8) Si t_clean es sin info (vacío / null / "sin informacion" / negación de info)
   → canal_normalizado = "Sin Informacion"
   → canal_razon = "match: sin info"

9) En cualquier otro caso
   → canal_normalizado = "Otro"
   → canal_razon = "fallback: otro"

REGLA PARA TEXTOS MIXTOS (CANAL)
Si un texto menciona múltiples fuentes, clasifica SOLO UNA por prioridad.
Ejemplos:
- "Google y Facebook" → Facebook
- "Tiktok / Recomendación" → TikTok
- "Redes sociales y recomendación" → Recomendación
- "Recomendaciones y Bodas.com" → Bodas.com

================================================================================
PARTE B) NORMALIZACIÓN DE EVENTO
================================================================================

REGLA B1: CREAR evento_base
Para cada lead:
- Si evento no existe, es null, "", o es exactamente "Sin Informacion"
  → evento_base = "Sin Informacion"
- Si no
  → evento_base = evento (string original)

PREPROCESAMIENTO B
- t = evento_base como string
- t_clean = trim(t) y pasar a minúsculas.
- Para matching, ignora acentos (ej. "graduación" == "graduacion").

REGLA B2: NORMALIZAR evento_base A UNA CATEGORÍA (evento_normalizado)
Categorías permitidas (solo estas):
- Bodas
- Xv años
- Empresarial
- Comida familiar
- Bautizo / Primera comunión
- Cumpleaños
- Graduación
- Otro
- Sin Informacion

PRIORIDAD B (aplica la primera que haga match)
1) Si evento_base es Sin Informacion o vacío
   → evento_normalizado = "Sin Informacion"
   → evento_razon = "match: sin info"

2) Si t_clean contiene "boda" o "nupcial" o "civil" (en contexto de boda) o "matrimonio"
   → evento_normalizado = "Bodas"
   → evento_razon = "match: boda/nupcial/matrimonio"

3) Si t_clean contiene "xv" o "15 años"/"15 anos" o "quince"
   → evento_normalizado = "Xv años"
   → evento_razon = "match: xv/quince"

4) Si t_clean contiene "corporativo" o "empresarial" o "empresa" o "fin de año"/"fin de ano" o "posada" o "conferencia" o "seminario"
   → evento_normalizado = "Empresarial"
   → evento_razon = "match: corporativo/empresarial"

5) Si t_clean contiene "comida" o "cena familiar" o "reunion familiar" o "familiar" o "sesion de fotos"
   o referencias claras familiares (ej. "mi mamá", "mi mama", "mi papa")
   → evento_normalizado = "Comida familiar"
   → evento_razon = "match: comida/familiar"

6) Si t_clean contiene "bautizo" o "comunion"/"comunión" o "primera comunion" o "confirmacion" o "presentacion"
   → evento_normalizado = "Bautizo / Primera comunión"
   → evento_razon = "match: bautizo/comunión"

7) Si t_clean contiene "cumple" o "cumpleaños"/"cumpleanos" o "aniversario"
   → evento_normalizado = "Cumpleaños"
   → evento_razon = "match: cumpleaños/aniversario"

8) Si t_clean contiene "gradu" (graduacion/graduación) o contiene "ibero" junto a contexto de graduación
   → evento_normalizado = "Graduación"
   → evento_razon = "match: gradu/ibero"

9) Si t_clean contiene "hospedaje" o "hotel" o "solo hotel"
   → evento_normalizado = "Otro"
   → evento_razon = "match: hotel/hospedaje"

10) En cualquier otro caso
   → evento_normalizado = "Otro"
   → evento_razon = "fallback: otro"

================================================================================
EJEMPLOS RÁPIDOS (CANAL + EVENTO)
================================================================================

Ejemplo 1:
canal_de_contacto="Sin Informacion", como_nos_encontro="Tik Tok"
evento="XV Años"
→ canal_base="Tik Tok" → canal_normalizado="TikTok"
→ evento_base="XV Años" → evento_normalizado="Xv años"

Ejemplo 2:
canal_de_contacto="WhatsApp", como_nos_encontro="Google"
evento="Boda civil"
→ canal_base="WhatsApp" → canal_normalizado="WhatsApp"
→ evento_base="Boda civil" → evento_normalizado="Bodas"

Ejemplo 3:
canal_de_contacto="Sin Informacion", como_nos_encontro="Publicidad en Facebook"
evento="Cena de fin de año (corporativo) - 550 asistentes"
→ canal_base="Publicidad en Facebook" → canal_normalizado="Facebook"
→ evento_base="Cena de fin de año (corporativo) - 550 asistentes" → evento_normalizado="Empresarial"

Ejemplo 4:
canal_de_contacto="Sin Informacion", como_nos_encontro="Bodas.com"
evento=""
→ canal_base="Bodas.com" → canal_normalizado="Bodas.com"
→ evento_base="Sin Informacion" → evento_normalizado="Sin Informacion"
`;

    console.log(`[normalize-leads] Processing ${leadsArray.length} leads with ${providerChoice === 1 ? 'OpenAI' : 'Gemini'}...`);

    // 4. Call AI Provider
    const resultJSON = await aiProvider.generateNorm(SYSTEM_PROMPT, leadsArray);

    // 5. Return JSON payload matching EXACTLY what the AI structured
    return new Response(JSON.stringify(resultJSON), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("AI Normalization Error:", error);
    // Explicitly returning status 200 with the error inside so the frontend can read the exact message
    return new Response(JSON.stringify({ error: error.message || "Unknown error occurred" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
