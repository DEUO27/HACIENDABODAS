# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the React 19 frontend. Use `src/pages/` for routed screens, `src/components/` for reusable UI and feature sections, `src/contexts/` for global state, `src/hooks/` for shared hooks, and `src/lib/` for service, import/export, PDF, and Supabase helpers. Static assets live in `public/` and `src/assets/`. Supabase database work is under `supabase/migrations/`, and Edge Functions are under `supabase/functions/*`.

## Build, Test, and Development Commands
Run `npm run dev` to start Vite with forced dependency rebuilds, which this repo uses to avoid stale cache issues. Run `npm run build` to create the production bundle in `dist/`. Run `npm run preview` to inspect the built app locally. Run `npm run lint` before opening a PR; ESLint is the only automated verification configured today.

## Coding Style & Naming Conventions
Follow the existing style in `src/`: 2-space indentation, single quotes, and no semicolons. Prefer function components and ESM modules. Use `PascalCase` for React components and page files (`EventDashboard.jsx`), `camelCase` for hooks and utilities (`useLeads.js`, `eventService.js`), and keep Supabase migration filenames timestamped and descriptive (`20260330_punto2_eventos.sql`). Use the `@` alias for imports from `src`.

## Testing Guidelines
There is no formal test suite or `npm test` script yet. For now, treat `npm run lint` as required and add focused manual checks for the flows you change. For UI work, verify login, dashboard filters, event pages, import/export, and any affected Supabase Edge Function path. If you add tests later, place them near the feature or in a dedicated test folder and name them after the unit under test.

## Commit & Pull Request Guidelines
Recent history follows concise Conventional Commit prefixes such as `feat:`, `fix:`, and `revert:`. Keep commit subjects imperative and scoped to one change. PRs should include a short summary, impacted routes or functions, environment or migration notes, and screenshots for dashboard or RSVP UI changes. Link related issues and call out any required Supabase secrets or schema changes explicitly.

## Security & Configuration Tips
Do not commit `.env` values, API keys, or Supabase secrets. Frontend config uses `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_WEBHOOK_URL`; AI-related secrets belong in Supabase Edge Function settings, not in the client.
