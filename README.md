# HACIENDABODAS - Dashboard de Leads

## Que es este proyecto
Aplicacion web interna para gestion de leads de Hacienda Bodas:

- Dashboard con KPIs, filtros, tablas y graficas.
- Sincronizacion de leads desde webhook externo (n8n/Make) hacia Supabase.
- Normalizacion asistida por IA para canal/evento.
- Importacion masiva desde Excel con deduplicacion.
- Exportacion de reporte PDF con resumen IA y captura de graficas.

El proyecto esta orientado a operacion comercial y analitica del pipeline de ventas.

## Stack y dependencias clave

- Frontend: React 19 + Vite 7
- UI/CSS: Tailwind CSS v4 + componentes UI (Radix/shadcn)
- Data/Auth: Supabase (`@supabase/supabase-js`)
- Graficas: Recharts
- PDF: `@react-pdf/renderer` + `html-to-image`
- Importacion: `exceljs` bajo demanda
- Fechas: `date-fns`

## Arquitectura funcional (resumen)

### 1) Ruteo y proteccion por rol
- Router principal en `src/App.jsx`.
- Rutas protegidas con `ProtectedRoute`.
- Rol esperado en `user_metadata.role` de Supabase Auth.
- Actualmente el dashboard requiere `admin`.

### 2) Estado de filtros y consumo de leads
- `useLeads` mantiene cache global de leads y permite `refresh`.
- `FilterContext` centraliza filtros (busqueda, rango de fechas, canales, origenes, etc.).
- `useFilteredLeads` aplica la logica de filtrado sobre el dataset cargado.

### 3) Flujo de leads (online)
- `refresh(true)` en frontend.
- Invocacion autenticada a Edge Function `sync-leads-from-webhook`.
- La funcion lee `LEADS_WEBHOOK_URL` desde Supabase secrets, obtiene leads crudos y deduplica por `lead_id`.
- Enriquecimiento en Edge Function `normalize-leads` (Gemini/OpenAI).
- Upsert en tabla `leads` de Supabase con `onConflict: lead_id`.
- Lectura final desde RPC paginada para render de dashboard.

### 4) Flujo de importacion Excel (admin)
- Carga de archivo en `ImportAdmin`.
- Parsing bajo demanda con `exceljs` y transformacion en `importService`.
- Construccion de `dedupe_key` para evitar duplicados.
- Upsert por `dedupe_key` en Supabase.

### 5) Flujo de exportacion PDF
- Captura de graficas visibles/ocultas del dashboard (`captureCharts`).
- Construccion de payload agregado sin PII para IA.
- Llamada a Edge Function `ai-summary`.
- Render PDF con `@react-pdf/renderer`.

## Estructura principal del proyecto

```txt
src/
  components/
    dashboard/      # KPIs, filtros, graficas, export dialog, tabla
    layout/         # Sidebar, Topbar, layout base
    ui/             # componentes UI reutilizables
  contexts/         # Auth, filtros, theme
  hooks/            # useLeads
  lib/              # servicios, utilidades, export/pdf/import
  pages/            # Dashboard, Login, ImportAdmin, Unauthorized
supabase/
  functions/
    normalize-leads/
    ai-summary/
```

## Variables de entorno

### Frontend (`.env`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Edge Functions (Supabase secrets)
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `LEADS_WEBHOOK_URL`

Notas:
- No subir secretos al repositorio.
- Este README documenta nombres de variables, no valores.

## Ejecucion local

### Requisitos
- Node.js 20+ recomendado
- npm

### Instalacion
```bash
npm install
```

### Comandos
```bash
npm run dev
npm run build
npm run preview
npm run lint
```

Notas de entorno local:
- `npm run dev` usa `vite --force` para forzar reconstruccion de dependencias.
- `vite.config.js` incluye headers anti-cache en `server` y `preview` para reducir problemas de cache del navegador.

## Supabase y Edge Functions

Funciones actuales:
- `normalize-leads`: normaliza canal/evento (Gemini u OpenAI) y devuelve JSON enriquecido.
- `ai-summary`: genera insights de graficas para el reporte PDF.
- `sync-leads-from-webhook`: sincroniza leads desde el webhook privado hacia Supabase.

Consideraciones:
- Deben existir secrets (`OPENAI_API_KEY` y/o `GEMINI_API_KEY`) segun proveedor elegido.
- Debe existir `LEADS_WEBHOOK_URL` para sincronizar leads desde el dashboard.
- Si faltan secrets, el frontend puede continuar con fallback (por ejemplo, reporte sin insights IA).
- El rol de acceso de usuario se toma desde `user_metadata.role`.

## Modelo de datos practico del lead

Campos usados de forma recurrente por UI/procesos:

- Identidad y contacto: `lead_id`, `nombre`, `telefono`
- Fechas: `fecha_primer_mensaje`, `fecha_evento`
- Pipeline: `fase_embudo`, `vendedora`
- Atribucion: `canal_de_contacto`, `como_nos_encontro`, `canal_normalizado`
- Evento: `evento`, `evento_normalizado`
- Operacion: `salon`, `fuente`, `dedupe_key`

Nota: esta lista es practica para desarrollo frontend/servicios; no reemplaza un esquema SQL versionado.

## Known Issues / comportamientos esperados

1. Concentracion de leads en hora `00:00`
- Muchos registros llegan como fecha sin hora (`dd/MM/yyyy` o `yyyy-MM-dd`).
- Al parsear, se interpretan en medianoche.
- En graficas por hora, esto produce picos altos en `00:00`.

2. Diferencia entre `00:00 real` y `sin hora exacta`
- Actualmente se agrupan juntos.
- Recomendacion: separar explicitamente bucket `Sin hora exacta`.

## Troubleshooting

### 1) `ERR_CACHE_READ_FAILURE` / 304 Not Modified
- Hacer hard reload del navegador.
- Reiniciar dev server (`npm run dev`).
- Verificar que `vite.config.js` conserve headers anti-cache.

### 2) Fallos de IA en normalizacion o resumen
- Verificar secrets configurados en Supabase:
  - `OPENAI_API_KEY`
  - `GEMINI_API_KEY`
- Revisar logs de Edge Functions en Supabase.
- Confirmar proveedor seleccionado en UI y disponibilidad del modelo.

### 3) Logo no visible
- El logo se consume como ruta estatica (`/logo.png`).
- Verificar existencia en `public/logo.png` y en build final.
- Revisar que no haya overrides CSS que oculten la imagen.

## Utilidades internas de diagnostico

Los artefactos locales de diagnostico no forman parte del bundle de la app.
Si se generan dumps, logs o consultas temporales, deben quedar fuera de `src/` y bajo rutas ignoradas como `docs/debug/legacy-artifacts/`.

## Validacion recomendada tras cambios

- Un desarrollador nuevo debe poder levantar entorno con `README + .env`.
- Comandos documentados deben existir en `package.json`.
- Variables documentadas deben coincidir con uso real en frontend/edge.
- Verificar consistencia entre autenticacion, filtros, importacion, exportacion e IA.
- Confirmar que README no expone datos sensibles.

## Roadmap tecnico sugerido (corto)

1. Normalizar `fecha_primer_mensaje` con hora consistente en ingestas nuevas.
2. Separar visualmente `Sin hora exacta` de `00:00` real en chart por hora.
3. Unificar catalogos de texto (`Sin Informacion`, nombres de vendedoras, variantes).
4. Mantener los scripts de diagnostico fuera de `src/` y documentar solo los que sean reutilizables.
