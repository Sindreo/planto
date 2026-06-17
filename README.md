# 🌱 Planto

En PWA for plantestell for en husstand på to personer. Bygget med React + Vite +
TypeScript, Tailwind, Supabase og (fra M2) Claude `claude-sonnet-4-6` for
bildediagnose og plante-ID.

Se [`SPEC.md`](./SPEC.md) for full produkt- og teknisk spesifikasjon.

---

## Status: M0 ✅

Prosjektoppsett, Supabase-tabeller med RLS, og fungerende innlogging.
Du kan registrere deg, logge inn, opprette/bli med i en husstand, og se en
(foreløpig tom) planteliste.

| Milepæl | Innhold | Status |
|---------|---------|--------|
| **M0** | Oppsett, auth, tabeller + RLS | ✅ Ferdig |
| M1 | Planteregister (CRUD, bilder) | ⏳ Neste |
| M2 | Bildediagnose + plante-ID (Claude) | – |
| M3 | Vanne-/stell-påminner + «I dag» | – |
| M4 | Daglig e-postoppsummering | – |
| M5 | Polish, offline, onboarding | – |

---

## Kom i gang (steg for steg)

> Trenger du bare å teste? Følg 1–4. Tar ca. 10 minutter.

### 1. Installer avhengigheter

```bash
npm install
```

### 2. Sett opp Supabase

Følg [`supabase/README.md`](./supabase/README.md):
opprett et gratis prosjekt, kjør `supabase/migrations/0001_init.sql` i SQL Editor,
og kopier de to API-nøklene.

### 3. Legg inn nøklene lokalt

```bash
cp .env.example .env.local
```

Åpne `.env.local` og lim inn `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY`
fra Supabase (Project Settings → API).

### 4. Start appen

```bash
npm run dev
```

Åpne adressen som vises (vanligvis http://localhost:5173).

- Lager du ikke `.env.local`, viser appen en hjelpeskjerm i stedet for å krasje.
- Første gang: trykk **Ny konto**, registrer deg, og **Opprett husstand**. Du får
  en invitasjonskode (vises under profil-knappen oppe til høyre).
- Den andre personen registrerer seg og velger **Bli med** med samme kode → da
  deler dere de samme plantene.

### 5. (Senere) Deploy

Prosjektet er klart for **Vercel** eller **Netlify**:

- **Vercel:** importer repoet, sett build-kommando `npm run build`, output `dist`.
  Legg inn `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY` som Environment Variables.
- **Netlify:** `netlify.toml` er allerede satt opp. Legg inn de samme to
  miljøvariablene under Site settings → Environment.

HTTPS (kreves for PWA) får du automatisk hos begge.

---

## Sikkerhet

- **Anthropic-nøkkelen kommer ALDRI i frontend.** Den legges som hemmelig
  miljøvariabel i en Supabase Edge Function (bygges i M2).
- Frontend bruker kun den offentlige `anon`-nøkkelen. **Row Level Security** i
  databasen sørger for at en bruker bare ser data for sin egen husstand.

---

## Nyttige kommandoer

```bash
npm run dev        # utviklingsserver
npm run build      # produksjonsbygg (type-sjekk + Vite)
npm run preview    # forhåndsvis produksjonsbygg lokalt
npm run typecheck  # kun TypeScript-sjekk
```

## Prosjektstruktur

```
src/
  components/   UI-komponenter (Layout, knapper, kort)
  context/      AuthContext (session + profil)
  lib/          Supabase-klient
  pages/        Login, Onboarding, Planteliste, Mangler-oppsett
  types/        Database-typer
supabase/
  migrations/   SQL for tabeller + RLS
scripts/        Ikon-generator for PWA
```
