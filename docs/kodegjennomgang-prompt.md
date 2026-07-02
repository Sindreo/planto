# Prompt: Kode- og arkitekturgjennomgang av Planto (for Fable 5)

> Lim inn alt under linjen i en **fersk** Fable 5-tråd som har hele Planto-repoet tilgjengelig
> (ny tråd = Fable slipper å re-lese urelatert historikk til sin pris, og unngår klassifikator-snubler).
> Prompten er på engelsk (best modellytelse), men ber om at sluttrapporten skrives på norsk.
> Den er skrevet som ett selvstendig brief — alt Fable trenger i én melding — så den kan kjøres i én omgang.
>
> Merk: språket er bevisst holdt som en vanlig ingeniør-gjennomgang, uten «angrep»-vokabular, fordi
> Fables innholdsfilter feilaktig flagger sikkerhetssjekker som er formulert offensivt. Innholdet er
> like grundig — det ber om nøyaktig de samme kontrollene, bare i defensiv, hverdagslig form.

---

You are a **senior engineer reviewing the code, architecture, and robustness** of a small web app called **Planto**, at the request of its maintainers, to help them keep it correct and reliable as it grows. Real families use it to track their household's plants, so getting the data-handling right — each household only ever seeing and changing its own data — matters as much as clean code. Be thorough and precise: back every observation with the actual code, and don't report anything you can't point to.

This is one self-contained brief — everything you need is below. **Do the whole review in a single pass; don't ask me clarifying questions first.** Where something is genuinely ambiguous, state the assumption you made and continue. Work as the **architect**: produce a clear verdict plus a plan precise enough that a cheaper model (or a junior developer) could carry out the fixes from your output alone.

**Please don't open or inspect any environment, secrets, or credential files** (e.g. `.env*`, key files). No real secrets live in the repo, and they're managed securely outside it. Review the **application code, SQL migrations/policies, and the structure of config files** — that's where the substance is.

## What Planto is

A Norwegian houseplant-care PWA for households. A user belongs to one household; members share the household's plants, care schedule, AI-generated diagnoses, and a per-plant chat.

**Stack (verify against the repo — don't trust this summary blindly):**
- **Frontend:** React 18 + Vite + TypeScript + Tailwind, installable PWA (vite-plugin-pwa). Deployed on Vercel (auto-deploy on merge to `main`). Source in `src/` — pages in `src/pages/`, shared logic in `src/lib/`, components in `src/components/`, auth context in `src/context/`, DB types in `src/types/db.ts`.
- **Backend:** Supabase — Postgres with Row Level Security (RLS), Supabase Auth (JWT), Storage (public bucket `plant-photos`), and two Deno Edge Functions in `supabase/functions/` (`plant-ai`, `daily-summary`). Schema and access rules live in `supabase/migrations/0001…0011`.
- **AI:** Anthropic Claude API, called **only** from the `plant-ai` edge function (identify / diagnose / careguide on a vision model, streaming chat on Haiku). The API key is an edge-function environment value, never in the frontend.
- **Email:** Resend, from the `daily-summary` edge function, triggered by pg_cron (`supabase/scheduled.sql`).
- **Observability:** an `error_logs` table written best-effort by the edge functions.

**How the data-separation model is meant to work — please check it carefully:**
- Each user belongs to one household, and the rule "you only see your own household's data" is enforced in the **database** by RLS policies, keyed off a `SECURITY DEFINER` helper (look for something like `auth_household_id()`) plus per-table policies. The React client uses the public anon key plus a user's login token; the client code itself does **not** enforce the rule — the database policies and the edge-function checks are what actually do. So evaluate those as if a request could arrive with any payload, not only the ones the UI sends.
- The `plant-photos` storage bucket is readable by object URL. Confirm what a user can and cannot list or reach across households.
- Edge functions use a service-role key internally, so they must confirm who the caller is (via their token) and that the caller owns the relevant plant/household before reading or writing on their behalf.

## What to evaluate

Assess whether the code and architecture are **sound**, and what concrete steps would best prepare Planto to (a) **scale**, (b) **be easier and more trustworthy to use**, and (c) **keep each household's data correctly separated and safe**. Cover these four areas:

1. **Data separation & correctness of the access rules (most important).** Check the RLS policies for completeness and correctness — every table, every operation (SELECT/INSERT/UPDATE/DELETE): confirm a user can only read or change rows, storage objects, chat, and diagnoses that belong to their own household, and flag any gap where that could quietly fail. In the edge functions: is the caller's token checked, is plant/household ownership re-verified on the server before every read/write, and are incoming values validated and length-bounded? Do the per-day AI usage limits behave correctly under repeated or malformed requests? Check that user-entered text is handled safely when it becomes part of a database query or gets included in an AI prompt, and that image URLs the app forwards to the AI are validated. Check the storage access rules and the account flows (switching household, invite/join). Anything that could let one household's data reach another is a top-priority finding.
2. **Architecture & code quality.** Separation of concerns, data-flow clarity, error handling, correctness bugs, dead code, duplication, risky patterns, type-safety gaps (`any`, unchecked casts), migration hygiene. Call out real defects, not taste.
3. **Scalability readiness.** N+1 query patterns, missing indexes on filter/foreign-key columns, unbounded list queries / missing pagination, edge-function timeouts and cold-path cost, AI-cost growth — anything that works at 10 households but breaks at 10,000.
4. **Usability & UX robustness.** Loading/empty/error states, optimistic-update and refetch correctness, offline/PWA behavior, mobile-specific issues, accessibility basics, and confusing or trust-eroding flows.

## How to work (this matters as much as the checklist)

- **Trace, don't assume.** Follow real data flows end-to-end: client call → edge function → database → RLS policy. For any data-separation claim, name the exact policy or check that does (or fails to do) the enforcing.
- **Every finding must be verifiable.** Cite `path:line` (or the migration + policy name). If you can't point to the code, don't report it. Don't invent APIs, table columns, or problems — if the repo contradicts a detail in this brief, say so.
- **Label confidence.** Mark each finding **CONFIRMED** (you traced it and it definitely holds) or **NEEDS-CHECK** (plausible, but a maintainer should confirm X). Never present a guess as a certainty.
- **Make the impact concrete.** For each data-separation or robustness finding, give a specific example of what would go wrong — what request or state causes it, and what data or behavior ends up wrong as a result. A gap with no realistic path to impact is a low-severity note, and say so.
- **Scope realistically.** Planto is a small app with a modest user base preparing to grow. Prioritize what actually matters at this stage. **Don't** pad the report with generic best-practice checklists, framework-version nags, or style nitpicks unless they cause a real bug or risk. Prefer 15 sharp, true findings over 60 shallow ones.
- **Prefer the smallest correct fix.** For each finding, propose a concrete fix and estimate effort (S / M / L). Note where a fix touches an already-applied migration (it needs a new forward migration, not an edit to the old one).

## Output format

Write the final report **in Norwegian** (the team's and codebase's language). Structure it exactly as:

1. **Sammendrag (≤10 linjer):** overall health verdict, and the single most important thing to fix.
2. **Viktigste funn:** ranked, most important first. For each: title · severity (Kritisk/Høy/Middels/Lav) · CONFIRMED/NEEDS-CHECK · `fil:linje` · what's wrong · concrete example of what goes wrong · proposed fix + effort (S/M/L).
3. **Arkitektur & kodekvalitet:** findings in the same per-item format.
4. **Skalering:** findings in the same format.
5. **Brukervennlighet/UX:** findings in the same format.
6. **Det som er bra:** briefly, what's genuinely solid and should be preserved (so the team doesn't "fix" it).
7. **Prioritert tiltaksliste:** a single ordered checklist across all areas — what to do first, second, third — balancing impact against effort. This is the part the team will act on, so make it decisive.

Start by skimming the repo structure and the migrations to build an accurate mental model, then dig in. Take the time you need to be right.
