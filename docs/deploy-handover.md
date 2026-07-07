# Deploy-handover: fullfør prod-utrulling av Planto

All koden er merget til `main`. Det gjenstår kun å rulle den ut til Supabase.
Supabase MCP var ustabil i økten der endringene ble laget, så dette dokumentet
lar en fersk Claude-tråd (med Supabase MCP tilkoblet) **eller** deg manuelt
fullføre utrullingen.

- **Supabase prosjekt-id:** `hiexhncluwedswwudyds`
- **Repo:** `sindreo/planto` (alt ligger på `main`)
- **`CRON_SECRET`:** bekreftet satt i prod (fail-closed cron er derfor trygt).

## Rekkefølge (viktig)

Migrasjonene **må** kjøres før `plant-ai` redeployes, fordi den nye funksjons-
koden spør mot tabellen `ai_usage`.

1. Kjør migrasjon **0012** (`supabase/migrations/0012_care_events_guard_and_ai_usage.sql`)
2. Kjør migrasjon **0013** (`supabase/migrations/0013_water_method.sql`)
3. Redeploy edge-funksjon **plant-ai** (`verify_jwt: true`)
4. Redeploy edge-funksjon **daily-summary** (`verify_jwt: false`)
5. Verifiser (se nederst)

## Alternativ A: fersk Claude-tråd med Supabase MCP

Lim inn dette i en ny tråd:

> Fullfør prod-utrulling av allerede-mergede endringer i Planto via Supabase MCP.
> Prosjekt-id `hiexhncluwedswwudyds`, repo `sindreo/planto` (alt på `main`).
> Gjør i denne rekkefølgen: (1) `apply_migration` med innholdet i
> `supabase/migrations/0012_care_events_guard_and_ai_usage.sql`, (2) `apply_migration`
> med `supabase/migrations/0013_water_method.sql`, (3) `deploy_edge_function` for
> `plant-ai` fra `supabase/functions/plant-ai/index.ts` med `verify_jwt: true`
> (må skje etter steg 1–2 siden koden spør mot `ai_usage`), (4) `deploy_edge_function`
> for `daily-summary` fra `supabase/functions/daily-summary/index.ts` med
> `verify_jwt: false` (`CRON_SECRET` er satt). Til slutt verifiser med `execute_sql`
> at tabellen `ai_usage` og kolonnen `plants.water_method` finnes, at policyen
> `care_events_modify` sjekker `plant_id` mot husstand, og at de seedede artene har
> `water_method`. Rapporter nye versjonsnumre (forventet plant-ai v13, daily-summary v6).

## Alternativ B: manuelt i Supabase-dashboardet

1. **SQL Editor** → lim inn og kjør hele `supabase/migrations/0012_care_events_guard_and_ai_usage.sql`.
2. **SQL Editor** → lim inn og kjør hele `supabase/migrations/0013_water_method.sql`.
3. **Edge Functions → plant-ai** → lim inn innholdet av `supabase/functions/plant-ai/index.ts`
   og deploy. La «Verify JWT» stå **på**.
4. **Edge Functions → daily-summary** → lim inn innholdet av
   `supabase/functions/daily-summary/index.ts` og deploy. La «Verify JWT» stå **av**.

## Verifisering (kjør i SQL Editor)

```sql
-- Tabell + kolonner finnes
select to_regclass('public.ai_usage')            as ai_usage_table,      -- ikke null
       (select count(*) from information_schema.columns
         where table_name='plants' and column_name='water_method') as plants_water_method; -- 1

-- care_events UPDATE-policy sjekker nå plant_id mot husstand
select qual, with_check
from pg_policies
where schemaname='public' and tablename='care_events' and policyname='care_events_modify';

-- Seedede arter har fått vannemåte
select count(*) as seeded_water_method
from public.species where water_method is not null;   -- forventet ~40
```

## Hva utrullingen aktiverer

- **Sikkerhet:** eierskapssjekk i diagnose (kryss-husstand-injeksjon tettet),
  URL-validering av diagnose-bilder, felles AI-døgnteller (identify/careguide/diagnose),
  cron fail-closed, og husstands-guard på `care_events` UPDATE.
- **Funksjon:** «Slik vanner du»-instruks per plante (AI-utfylt + seedet for vanlige arter).
