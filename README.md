# 🌱 Planto

En PWA for plantestell for en husstand på to personer. Bygget med React + Vite +
TypeScript, Tailwind, Supabase og Claude `claude-sonnet-4-6` (vision) for
bildediagnose og plante-ID.

Se [`SPEC.md`](./SPEC.md) for full produkt- og teknisk spesifikasjon.

---

## Status: hele v1 bygget 🎉

| Milepæl | Innhold | Status |
|---------|---------|--------|
| **M0** | Oppsett, auth, tabeller + RLS | ✅ |
| **M1** | Planteregister (CRUD, bilder, oversikt + detalj) | ✅ |
| **M2** | Bildediagnose + plante-ID + AI-stellguide (Claude) | ✅ |
| **M3** | Vanne-påminner, «Vannet i dag», «I dag»-skjerm, logg | ✅ |
| **M4** | Daglig e-postoppsummering (Resend, cron) | ✅ |
| **M5** | Tomtilstander, lasting, feil, offline-caching | ✅ |

> Frontend kjører uten nøkler (viser hjelpeskjerm). For AI (M2) og e-post (M4)
> må du sette opp Anthropic- og Resend-nøkler som beskrevet under.

---

## Kom i gang (lokal testing)

### 1. Installer
```bash
npm install
```

### 2. Supabase-database
Følg [`supabase/README.md`](./supabase/README.md): opprett gratis prosjekt og kjør
SQL-filene i `supabase/migrations/` (først `0001_init.sql`, så `0002_storage.sql`)
i SQL Editor.

### 3. Frontend-nøkler
```bash
cp .env.example .env.local
```
Lim inn `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY` (Project Settings → API).

### 4. Start
```bash
npm run dev
```
Registrer deg → **Opprett husstand** → del invitasjonskoden med den andre, som
velger **Bli med**. Legg til planter, prøv «Vannet i dag» og «I dag»-skjermen.

---

## AI (M2) – Claude bildediagnose, plante-ID og stellguide

AI-kallene går gjennom Edge Function-en `plant-ai`, som holder Anthropic-nøkkelen
hemmelig. Den må deployes til Supabase.

**Du trenger:** en Anthropic API-nøkkel fra https://console.anthropic.com
(Settings → API Keys). Den legges KUN som hemmelig miljøvariabel – aldri i koden.

**Deploy (enklest med Supabase CLI):**
```bash
npm i -g supabase
supabase login
supabase link --project-ref DIN-PROSJEKT-REF

# Sett hemmeligheten (ligger trygt i Supabase, ikke i git):
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Deploy funksjonen:
supabase functions deploy plant-ai
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY` og `SUPABASE_SERVICE_ROLE_KEY` settes
automatisk av Supabase. Valgfritt: `MAX_AI_PER_DAY` (standard 40) som
kostnadssikring.

Etter deploy fungerer «Gjett art fra bilde», «Fyll ut med AI» og «Kjør diagnose»
i appen.

---

## E-post (M4) – daglig oppsummering

Edge Function-en `daily-summary` sender begge i husstanden en e-post når noe
forfaller. Den kalles av en daglig cron-jobb.

**Du trenger:** en gratis Resend-konto (https://resend.com) og en API-nøkkel.

```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM="Planto <onboarding@resend.dev>"
supabase secrets set CRON_SECRET=$(openssl rand -hex 16)   # en tilfeldig hemmelighet
supabase functions deploy daily-summary
```
> `onboarding@resend.dev` virker for testing. For egen avsenderadresse må du
> verifisere et domene i Resend.

**Planlegg jobben:** åpne `supabase/scheduled.sql`, bytt ut `<PROSJEKT-REF>` og
`<CRON_SECRET>`, og kjør i SQL Editor. Den kjører kl. 07:00 UTC daglig.

Test manuelt (uten å vente til neste morgen):
```bash
curl -X POST https://DIN-PROSJEKT-REF.supabase.co/functions/v1/daily-summary \
  -H "x-cron-secret: DIN-CRON-SECRET"
```

---

## Deploy frontend

- **Vercel:** importer repoet (build `npm run build`, output `dist`), legg inn
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` som Environment Variables.
- **Netlify:** `netlify.toml` er ferdig. Legg inn de samme to variablene.

HTTPS (kreves for PWA) får du automatisk. På mobil: «Legg til på hjemskjerm».

---

## Sikkerhet

- **Anthropic- og Resend-nøklene ligger ALDRI i frontend** – kun som hemmelige
  Edge Function-variabler.
- Frontend bruker kun `anon`-nøkkelen; **Row Level Security** sikrer at en bruker
  bare ser data for sin egen husstand. Storage-opplasting er låst til husstandens
  egen mappe.

---

## Kommandoer

```bash
npm run dev        # utviklingsserver
npm run build      # produksjonsbygg (type-sjekk + Vite)
npm run preview    # forhåndsvis bygg
npm run typecheck  # kun TypeScript
```

## Struktur

```
src/
  components/   Layout, skjema, AI-knapper, diagnose-panel, UI-kit
  context/      AuthContext (session + profil)
  lib/          supabase, ai, photos, care, format
  pages/        I dag, Planteliste, Detalj, Skjema, Login, Onboarding
  types/        db- og ai-typer
supabase/
  migrations/   SQL: tabeller + RLS (0001), storage (0002)
  functions/    Edge Functions: plant-ai, daily-summary
  scheduled.sql Cron for daglig e-post
```
