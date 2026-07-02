# Prompt: Full kode- og arkitekturgjennomgang av Planto (for Fable 5)

> Lim inn alt under linjen i en **fersk** Fable 5-tråd som har hele Planto-repoet tilgjengelig
> (ny tråd = Fable slipper å re-lese urelatert historikk til sin pris, og unngår klassifikator-snubler).
> Prompten er på engelsk (best modellytelse), men ber om at sluttrapporten skrives på norsk.
> Den er skrevet som ett selvstendig brief — alt Fable trenger i én melding — så den kan kjøres i én omgang.

---

You are a **staff-level engineer and application security reviewer** doing a paid, adversarial audit of a small production web app called **Planto**. Real people store data about their household and plants here, so treat correctness, tenant isolation, and data safety as first-class concerns — not a style review. Your reputation is on the line for every claim you make: a false alarm wastes the team's time, and a missed vulnerability is worse. Be thorough, be skeptical, and **prove your findings against the actual code** rather than pattern-matching.

This is one self-contained brief — everything you need is below. **Do the whole review in a single pass; don't ask me clarifying questions first.** Where something is genuinely ambiguous, state the assumption you made and continue. Work as the **architect**: your job is a verdict plus a plan precise enough that a cheaper model (or a junior dev) could execute the fixes from your output alone.

## What Planto is

A Norwegian houseplant-care PWA for households. A user belongs to one household; members share the household's plants, care schedule, AI diagnoses, and a per-plant chat.

**Stack (verify against the repo — don't trust this blindly):**
- **Frontend:** React 18 + Vite + TypeScript + Tailwind, installable PWA (vite-plugin-pwa). Deployed on Vercel (auto-deploy on merge to `main`). Source in `src/` — pages in `src/pages/`, shared logic in `src/lib/`, components in `src/components/`, auth context in `src/context/`, DB types in `src/types/db.ts`.
- **Backend:** Supabase — Postgres with Row Level Security, Supabase Auth (JWT), Storage (public bucket `plant-photos`), and two Deno Edge Functions in `supabase/functions/` (`plant-ai`, `daily-summary`). Schema and policies live in `supabase/migrations/0001…0011`.
- **AI:** Anthropic Claude API, called **only** from the `plant-ai` edge function (identify / diagnose / careguide on a vision model, streaming chat on Haiku). The API key is an edge-function secret, never in the frontend.
- **Email:** Resend, from the `daily-summary` edge function, triggered by pg_cron (`supabase/scheduled.sql`).
- **Observability:** an `error_logs` table written best-effort by the edge functions.

**Trust boundaries and the multi-tenant model — audit these hardest:**
- Tenant isolation is enforced by **Postgres RLS**, keyed off a `SECURITY DEFINER` helper (look for something like `auth_household_id()`) plus per-table policies. The React client uses the anon key and a user JWT; it is **not** a trust boundary. Assume a logged-in user can call the DB and edge functions with arbitrary payloads — the server-side policies and function code are the only real enforcement.
- The `plant-photos` storage bucket is public-read by object URL. Confirm what a user can and cannot enumerate or access across households.
- Edge functions run with the service-role key internally but must authenticate the caller's JWT and re-check household/plant ownership before acting.

## Your mandate

Evaluate whether the code and architecture are **good**, and what concrete steps would best prepare Planto to (a) **scale**, (b) **improve usability**, and (c) **close security holes**. Cover these four dimensions, in priority order:

1. **Security & tenant isolation (highest priority).** RLS policy correctness and completeness (every table, every operation — SELECT/INSERT/UPDATE/DELETE); can any user read or mutate another household's rows, storage objects, chat, or diagnoses? Edge-function auth: is the JWT verified, is plant/household ownership re-checked server-side before every read/write, are inputs validated and bounded? Secret handling. The AI per-day cost/abuse guards — can they be bypassed or made to run up cost? Injection (SQL, prompt injection into the AI functions via user-controlled fields), SSRF via image URLs passed to Claude, storage-object access control, auth edge cases (household switching, invite/join flows). Anything that leaks or crosses the household boundary is a top finding.
2. **Architecture & code quality.** Separation of concerns, data-flow clarity, error handling, correctness bugs, dead code, duplication, risky patterns, type-safety gaps (`any`, unchecked casts), migration hygiene. Call out real defects, not taste.
3. **Scalability readiness.** N+1 query patterns, missing indexes on filter/foreign-key columns, unbounded list queries / missing pagination, edge-function timeouts and cold-path costs, AI-cost growth, anything that works at 10 households but breaks at 10,000.
4. **Usability & UX robustness.** Loading/empty/error states, optimistic-update and refetch correctness, offline/PWA behavior, mobile-specific issues, accessibility basics, and confusing or trust-eroding flows.

## How to work (this matters as much as the mandate)

- **Trace, don't assume.** Follow real data flows end-to-end: client call → edge function → DB → RLS policy. For any auth or isolation claim, name the exact policy or check that does (or fails to do) the enforcement.
- **Every finding must be verifiable.** Cite `path:line` (or the migration + policy name). If you can't point to the code, don't report it. Do **not** invent APIs, table columns, or vulnerabilities — if the repo contradicts an assumption above, say so.
- **Label confidence.** Mark each finding **CONFIRMED** (you traced it and it definitely holds) or **SUSPECTED** (plausible, needs a maintainer to check X). Never dress up a guess as a certainty.
- **Think like an attacker for security items:** give a concrete exploit scenario — specific inputs/state → what a malicious authenticated user gets. A vulnerability with no path to impact is a lower-severity note, and say so.
- **Scope realistically.** Planto is a small app with a modest user base preparing to grow. Prioritize what actually matters at this stage. **Do not** boil the ocean with generic best-practice checklists, framework-version nags, or style nitpicks unless they cause a real bug or risk. Prefer 15 sharp, true findings over 60 shallow ones.
- **Prefer the smallest correct fix.** For each finding, propose a concrete remediation and estimate effort (S / M / L). Note where a fix touches an already-applied migration (needs a new forward migration, not an edit).

## Output format

Write the final report **in Norwegian** (the team's and codebase's language). Structure it exactly as:

1. **Sammendrag (≤10 linjer):** overall health verdict, and the single most important thing to fix.
2. **Kritiske funn:** ranked, most severe first. For each: title · severity (Kritisk/Høy/Middels/Lav) · CONFIRMED/SUSPECTED · `fil:linje` · what's wrong · concrete exploit or failure scenario · proposed fix + effort (S/M/L).
3. **Arkitektur & kodekvalitet:** findings in the same per-item format.
4. **Skalering:** findings in the same format.
5. **Brukervennlighet/UX:** findings in the same format.
6. **Det som er bra:** briefly, what's genuinely solid and should be preserved (so the team doesn't "fix" it).
7. **Prioritert tiltaksliste:** a single ordered checklist across all dimensions — what to do first, second, third — balancing impact against effort. This is the part the team will act on, so make it decisive.

Start by skimming the repo structure and the migrations to build an accurate mental model, then dig in. Take the time you need to be right.
