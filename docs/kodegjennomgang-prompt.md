# Kode- og arkitekturgjennomgang av Planto

Gjennomgangen er delt i to fordi Fable 5s innholdsfilter gjentatte ganger feilaktig
flagger den sikkerhetsnære delen (RLS/dataseparasjon) — den faller da tilbake til Opus 4.8.
Vi speiler den oppdelingen bevisst:

- **Del A (arkitektur, kodekvalitet, skalering, UX)** → kjøres med **Fable 5** i en fersk tråd.
  Dette er Fables sweet spot, og uten sikkerhetsrammen snubler ikke filteret.
- **Del B (dataseparasjon / RLS-policyer / edge-function-tilgang)** → gjøres av Opus (Claude Code)
  direkte mot repoet, der ingen klassifikator er i veien.

---

## Del A — for Fable 5 (arkitektur · kodekvalitet · skalering · UX)

> Lim inn alt i dette avsnittet i en **fersk** Fable 5-tråd som har hele Planto-repoet tilgjengelig.
> Ett selvstendig brief, kjøres i én omgang. Rapporten skrives på norsk.

You are a **senior engineer reviewing the code, architecture, and robustness** of a small web app called **Planto**, at the request of its maintainers, to help them keep it clean and reliable as it grows. Be thorough and precise: back every observation with the actual code, and don't report anything you can't point to.

This is one self-contained brief. **Do the whole review in a single pass; don't ask me clarifying questions first.** Where something is genuinely ambiguous, state the assumption you made and continue. Work as the **architect**: produce a clear verdict plus a plan precise enough that a cheaper model (or a junior developer) could carry out the fixes from your output alone. You don't need to open any environment or credential files — review the application code, SQL migrations, and config structure.

### What Planto is

A Norwegian houseplant-care PWA for households. A user belongs to one household; members share the household's plants, care schedule, AI-generated diagnoses, and a per-plant chat.

**Stack (verify against the repo — don't trust this summary blindly):**
- **Frontend:** React 18 + Vite + TypeScript + Tailwind, installable PWA (vite-plugin-pwa). Deployed on Vercel (auto-deploy on merge to `main`). Source in `src/` — pages in `src/pages/`, shared logic in `src/lib/`, components in `src/components/`, auth context in `src/context/`, DB types in `src/types/db.ts`.
- **Backend:** Supabase — Postgres, Auth, Storage (bucket `plant-photos`), and two Deno Edge Functions in `supabase/functions/` (`plant-ai`, `daily-summary`). Schema in `supabase/migrations/0001…0011`.
- **AI:** Anthropic Claude API, called only from the `plant-ai` edge function (identify / diagnose / careguide on a vision model, streaming chat on Haiku).
- **Email:** Resend, from the `daily-summary` edge function, triggered by pg_cron (`supabase/scheduled.sql`).
- **Observability:** an `error_logs` table written best-effort by the edge functions.

### What to evaluate

Assess whether the code and architecture are **sound**, and what concrete steps would best prepare Planto to scale and to be easier and more trustworthy to use. Cover three areas:

1. **Architecture & code quality.** Separation of concerns, data-flow clarity, error handling, correctness bugs, dead code, duplication, risky patterns, type-safety gaps (`any`, unchecked casts), migration hygiene. Call out real defects, not taste.
2. **Scalability readiness.** N+1 query patterns, missing indexes on filter/foreign-key columns, unbounded list queries / missing pagination, edge-function timeouts and cold-path cost, AI-cost growth — anything that works at 10 households but breaks at 10,000.
3. **Usability & UX robustness.** Loading/empty/error states, optimistic-update and refetch correctness, offline/PWA behavior, mobile-specific issues, accessibility basics, and confusing or trust-eroding flows.

### How to work

- **Trace, don't assume.** Follow real data flows end-to-end: component → `src/lib` helper → edge function → database. Name the exact code that does the thing you're describing.
- **Every finding must be verifiable.** Cite `path:line`. If you can't point to the code, don't report it. Don't invent APIs, columns, or problems — if the repo contradicts a detail in this brief, say so.
- **Label confidence.** Mark each finding **CONFIRMED** (traced, definitely holds) or **NEEDS-CHECK** (plausible, maintainer should confirm X).
- **Make the impact concrete.** For each finding, give a specific example of what goes wrong and when.
- **Scope realistically.** Small app with a modest user base preparing to grow. Prefer 15 sharp, true findings over 60 shallow ones; skip generic best-practice checklists, version nags, and style nitpicks unless they cause a real bug.
- **Prefer the smallest correct fix.** Propose a concrete fix per finding with an effort estimate (S / M / L). Note where a fix touches an already-applied migration (needs a new forward migration, not an edit).

### Output format

Write the final report **in Norwegian**. Structure it exactly as:

1. **Sammendrag (≤10 linjer):** overall health verdict, and the single most important thing to fix.
2. **Arkitektur & kodekvalitet:** findings, most important first. Per finding: title · severity (Kritisk/Høy/Middels/Lav) · CONFIRMED/NEEDS-CHECK · `fil:linje` · what's wrong · concrete example · proposed fix + effort (S/M/L).
3. **Skalering:** same per-item format.
4. **Brukervennlighet/UX:** same per-item format.
5. **Det som er bra:** briefly, what's genuinely solid and should be preserved.
6. **Prioritert tiltaksliste:** a single ordered checklist across all areas — decisive, impact vs effort.

Start by skimming the repo structure and migrations to build an accurate mental model, then dig in.

---

## Del B — for Opus / Claude Code (dataseparasjon · RLS · edge-function-tilgang)

> Denne kjøres ikke i Fable. Be Claude Code (Opus) om følgende, med repoet åpent.

Gjennomgå at Planto holder hver husstands data korrekt adskilt. Konkret:

- **RLS-policyer** i `supabase/migrations/0001…0011`: for hver tabell (`households`, `profiles`,
  `plants`, `care_events`, `diagnoses`, `species`, `plant_responsibles`, `plant_chat_messages`,
  `error_logs`), sjekk at det finnes policyer for alle relevante operasjoner (SELECT/INSERT/UPDATE/DELETE)
  og at de faktisk begrenser tilgang til egen husstand via `auth_household_id()` (eller tilsvarende).
  Flagg tabeller som mangler en regel, eller der en policy er bredere enn den burde være.
- **Edge functions** (`plant-ai`, `daily-summary`): bekreft at innkommende token verifiseres, at
  eierskap til plante/husstand sjekkes på nytt på serversiden før lesing/skriving, og at input
  valideres og lengdebegrenses. Sjekk at dagsgrensene for AI-kall ikke kan omgås.
- **Storage** (`plant-photos`): hva kan en bruker liste/nå på tvers av husstander?
- **Kontoflyt:** bytte av husstand og invitasjon/join — kan noen havne i feil husstand eller beholde
  tilgang de ikke skal ha?

Format: rangerte funn med `fil:linje`, CONFIRMED/NEEDS-CHECK, konkret konsekvens, og foreslått fiks
(S/M/L). Til slutt en prioritert tiltaksliste. Rapport på norsk.
