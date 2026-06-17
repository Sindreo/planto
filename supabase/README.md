# Supabase-oppsett for Planto

Denne mappen inneholder databaseskjemaet. Du trenger **ikke** Supabase CLI for å
komme i gang – du kan lime inn SQL-en rett i dashbordet.

## Enkleste måte (anbefalt for M0)

1. Gå til [supabase.com](https://supabase.com) og opprett et gratis prosjekt.
2. Når prosjektet er klart: åpne **SQL Editor** i venstremenyen.
3. Åpne `migrations/0001_init.sql`, kopier ALT innholdet, lim inn i editoren og
   trykk **Run**. Du skal få «Success».
4. Hent frontend-nøklene under **Project Settings → API**:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` → `VITE_SUPABASE_ANON_KEY`
   Lim disse inn i `.env.local` i prosjektroten (se `.env.example`).
5. (Valgfritt for enklere testing) Under **Authentication → Providers → Email**
   kan du skru **av** «Confirm email» mens dere tester, så slipper dere å
   bekrefte e-post for hver innlogging.

## Hva skriptet gjør

- Oppretter tabellene `households`, `profiles`, `plants`, `care_events`, `diagnoses`.
- Lager en trigger som automatisk oppretter en `profiles`-rad når noen registrerer seg.
- Slår på **Row Level Security** slik at en bruker kun ser data for sin egen husstand.
- Legger til RPC-ene `create_household` og `join_household` for å koble de to
  kontoene til samme husstand via en invitasjonskode.

## Senere milepæler

- **M1** legger til en Storage-bucket for plantebilder.
- **M2** legger til Edge Functions (`diagnose-plant`, m.m.) der Anthropic-nøkkelen
  bor som hemmelig miljøvariabel.
