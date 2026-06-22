# Deploy

## Frontend (automatisk)

Frontend ligger på **Vercel**, koblet til GitHub. Hver merge til `main` trigger en
produksjons-deploy automatisk – ingen manuelle steg.

## Supabase Edge Functions (manuelt)

Funksjonene `plant-ai` og `daily-summary` ligger **ikke** på Vercel og må deployes
til Supabase når de endres.

### Engangsoppsett

1. **Lag et access token:** Supabase → **Account → Access Tokens** → «Generate new
   token». Kopier verdien (vises bare én gang).
2. **Legg inn to miljøvariabler** der Claude Code-miljøet konfigureres
   (Environment → Variables/Secrets):
   - `SUPABASE_ACCESS_TOKEN` = tokenet fra punkt 1 (**secret**)
   - `SUPABASE_PROJECT_REF` = `<ref>`-delen i `https://<ref>.supabase.co`
3. (Valgfritt) Installer Supabase-CLI i miljøets **setup script** for raskere
   kjøring: `npm i -g supabase`. Hvis ikke, henter deploy-skriptet den via `npx`.

> Merk: et personlig Supabase-token gir bred tilgang til kontoen. Roter/slett det
> ved behov i samme meny.

### Deploye

```bash
npm run deploy:functions
```

Skriptet (`scripts/deploy-functions.sh`) deployer begge funksjonene.

### Alternativ uten CLI (dashbord)

Edge Functions kan også limes inn og deployes manuelt i Supabase-dashbordet:
**Edge Functions → velg funksjon → Edit function → lim inn innholdet fra
`supabase/functions/<navn>/index.ts` → Deploy.**

## Database-migrasjoner

SQL i `supabase/migrations/` kjøres i Supabase **SQL Editor** (lim inn og Run), i
nummerrekkefølge.

## Edge function-secrets (valgfrie)

Settes på funksjonen i Supabase (Edge Functions → secrets). Leses i kjøretid.

| Variabel | Funksjon | Standard | Forklaring |
|---|---|---|---|
| `AI_VISION_MODEL` | plant-ai | `claude-sonnet-4-6` | Modell for identify/diagnose/careguide. Sett til en Opus-modell for bedre bildeanalyse. |
| `AI_CHAT_MODEL` | plant-ai | Haiku | Modell for chat. |
| `AI_TIMEOUT_MS` | plant-ai | `90000` | Timeout mot Anthropic. |
| `MAX_AI_PER_DAY` / `MAX_CHAT_PER_DAY` | plant-ai | 40 / 60 | Dagsgrenser per bruker. |
| `APP_TIMEZONE` | daily-summary | `Europe/Oslo` | Tidssone for «forfaller i dag». |
| `CRON_SECRET` | daily-summary | – | Beskytter endepunktet. **Bør settes.** |

## E-post-deliverability (DNS)

For at den daglige e-posten ikke havner i spam, legg til hos domeneleverandøren:

1. **SPF + DKIM** – følg oppskriften under Resend → Domains (verifiserer domenet).
2. **DMARC** – TXT-post på `_dmarc.planto.space`:
   ```
   v=DMARC1; p=none; rua=mailto:postmaster@planto.space
   ```
   Start med `p=none` (kun overvåking); stram til `quarantine`/`reject` når SPF/DKIM
   er bekreftet å passere.
