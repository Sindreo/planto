# Planto – Produkt- og teknisk spec

> Versjon 1.0 · Status: klar for Claude Code · Plattform: PWA først, native iOS senere

Dette dokumentet er skrevet for å gis videre til **Claude Code** som grunnlag for
implementering. Det beskriver *hva* Planto skal være og *hvordan* det bør bygges, men lar
de minste detaljene være opp til implementeringen. Les hele dokumentet før du begynner å kode,
og bygg i fasene beskrevet under «Milepæler».

---

## 0. Avklarte beslutninger

Disse er bestemt og skal følges:

- **Plattform:** PWA først (React + Vite), native iOS senere.
- **Konto:** to separate kontoer knyttet til samme husstand (`household_id`), slik at man ser
  hvem som gjorde hva.
- **Språk:** kun norsk – både UI og AI-svar.
- **Varsler i v1:** «I dag»-skjerm i appen + daglig e-postoppsummering. Web-push er *ikke*
  påkrevd i v1 (kan legges til senere, se 7.4).
- **Artsregistrering:** Plante-ID fra bilde er med i v1 (foto → AI-forslag til art → velg, ev.
  skriv/søk selv). Hver plante har i tillegg et fritt kallenavn (f.eks. «Monstera 1»).
- **AI:** Claude `claude-sonnet-4-6` (vision) via backend.

---

## 1. Visjon og problem

Sindre og samboeren hans har ca. 10 stueplanter. Plantene mistrives gjentatte ganger – de
visner, ser usunne ut og dør – fordi paret ikke vet nøyaktig hvordan hver enkelt plante skal
stelles, og fordi det er lett å glemme vanning og annet stell.

**Planto** er en app som hjelper et lite husstand (2 personer som deler de samme plantene) med å:

1. **Forstå hva som er galt** med en plante ved å ta et bilde og få AI-tolkning + konkrete tiltak.
2. **Huske stellet** via påminnelser om vanning, gjødsling og ompotting tilpasset hver plante.
3. **Ha oversikt** over alle plantene sine med stellguide og generell info per plante.

Suksesskriterium: Etter 3 måneders bruk skal paret oppleve at færre planter dør, og at de
føler kontroll over stellet. Konkret målbart: alle aktive planter har en oppdatert
vanne-logg, og minst 80 % av planlagte vanninger blir registrert som utført.

---

## 2. Brukere

- **Primærbrukere:** 2 personer i samme husstand som deler ett felles plantebibliotek.
  Begge skal kunne se og redigere de samme plantene fra hver sin telefon/PC.
- **Teknisk nivå:** ikke-tekniske sluttbrukere. Appen må være enkel og selvforklarende.
- **Enheter:** mobil (primært) og PC (sekundært). Native iOS kan komme senere – derfor velges
  en PWA-arkitektur som kjører i nettleser og kan «installeres» på hjemskjermen.

Dette er en privat app for to personer, ikke et kommersielt produkt. Det betyr at vi kan holde
ting enkelt: ett delt «hjem»/husstand er nok i MVP, vi trenger ikke fleksibel multi-tenant-modell.

---

## 3. Omfang (MVP vs. senere)

### MVP (versjon 1) – det vi bygger først

1. **Planteregister + info** – legg inn plantene, se og rediger dem, med stellguide per plante.
2. **Plante-ID fra bilde** – ved registrering kan man ta bilde og få AI-forslag til art, ev.
   skrive/søke selv hvis ingen stemmer.
3. **Vanne-/stell-påminner** – per-plante intervaller for vanning (og valgfritt gjødsling/ompotting),
   med en «forfaller i dag / på etterskudd»-oversikt + daglig e-postoppsummering.
4. **Bildediagnose** – ta/last opp bilde av en plante → Claude (vision) tolker tilstanden og
   foreslår tiltak; resultatet lagres på planten.

### Senere (post-MVP, ikke bygg nå – men ikke gjør valg som blokkerer disse)

- **Web-push-varsler** (i tillegg til e-post; se iOS-begrensninger i 7.4).
- **Native iOS-app** (gjenbruk backend/API; PWA-koden kan delvis gjenbrukes via f.eks. Capacitor).
- Historikk/graf over plantens helse over tid.
- Deling med flere husstander / venner.

---

## 4. Funksjonelle krav (MVP)

### 4.1 Planteregister

- Bruker kan **legge til en plante** med: kallenavn (f.eks. «Monstera 1» eller «Monstera på
  soverommet»), art/type, rom/plassering, og et profilbilde. Arten kan fylles ut via
  Plante-ID fra bilde (se 4.5) eller skrives fritt. Kallenavnet er alltid fritt, slik at man kan
  skille flere planter av samme art.
- Bruker kan **redigere og slette** planter.
- Hver plante har en **stellguide**: lysbehov, vanningsfrekvens, gjødslingsfrekvens, ompottingsintervall,
  giftig for kjæledyr (ja/nei), og fritekstnotater. Disse feltene kan fylles ut manuelt eller
  **foreslås av AI** basert på art (se 4.3).
- **Oversiktsside** viser alle planter som kort med bilde, navn, og status (f.eks. «Skal vannes i dag»).

### 4.2 Vanne-/stell-påminnelser

- Per plante settes et **vanningsintervall** (f.eks. hver 7. dag). Valgfritt også gjødslings-
  og ompottingsintervall.
- Når en plante vannes, trykker bruker **«Vannet i dag»**; neste forfallsdato beregnes fra dette.
- **«I dag»-skjerm** viser hva som forfaller i dag og hva som er på etterskudd, for begge brukere.
- **Varsler (v1):** en tydelig **«I dag»-skjerm** i appen + en **daglig e-postoppsummering** som
  sendes til begge brukere når noe forfaller. Dette er valgt fordi det er pålitelig på tvers av
  iPhone og PC. Web-push er bevisst utsatt til post-MVP (se 7.4).

### 4.3 Bildediagnose (Claude vision)

- Bruker velger en plante (eller starter «ny diagnose»), tar/laster opp **1–3 bilder**.
- Appen sender bildene + plantekontekst (art, sist vannet, plassering) til **Claude Sonnet 4.6**
  via backend, med en strukturert prompt (se 6.2).
- Claude returnerer **strukturert JSON**: sannsynlig(e) problem(er), alvorlighetsgrad,
  årsaksforklaring, og en konkret **tiltaksliste**. Appen viser dette pent og lagrer det som en
  «diagnose-hendelse» på planten med tidsstempel og bildene.
- Bruker kan be om at AI **fyller ut stellguiden** for en plante basert på art (uten bilde) – samme
  backend-endepunkt, annen prompt.

### 4.4 Konto og deling

- To brukere har **hver sin innlogging**, begge knyttet til samme `household_id`. De ser og
  redigerer det samme plantebiblioteket, og handlinger (vanning, diagnose) logges med hvem som
  gjorde dem. Bruk en ferdig auth-løsning (Supabase Auth, se 5).

### 4.5 Plante-ID fra bilde

- Ved registrering (eller når art mangler) kan bruker ta/laste opp et bilde og få **AI-forslag til
  art**. Appen sender bildet til `claude-sonnet-4-6` (gjenbruk av samme backend/vision-oppsett som
  diagnose) med en prompt som ber om en kort liste kandidater på norsk, med kort begrunnelse og
  usikkerhet.
- Bruker kan **velge et forslag**, eller **skrive/søke arten selv** hvis ingen stemmer. Valgt art
  lagres på planten, og bruker kan deretter la AI fylle ut stellguiden (4.3).
- Krav til AI-svar: gyldig JSON med f.eks. `candidates: [{ name, latin_name, confidence, note }]`.
  Vær ærlig om usikkerhet – ikke påstå én art med falsk selvtillit.

---

## 5. Anbefalt teknologivalg

Valgt for å passe «litt teknisk erfaring (hobby/web)», være billig/gratis i drift for to brukere,
og la Claude Code gjøre mesteparten av jobben.

| Lag | Anbefaling | Hvorfor |
|-----|-----------|---------|
| Frontend | **React + Vite + TypeScript**, som **PWA** (vite-plugin-pwa) | Bredt støttet, mye dokumentasjon, enkelt å la Claude Code bygge. PWA gir mobil + PC fra én kodebase. |
| UI | **Tailwind CSS** + en enkel komponentpakke (f.eks. shadcn/ui) | Rask, pen UI uten mye CSS-arbeid. |
| Backend / database / auth / fillagring | **Supabase** (Postgres + Auth + Storage + Edge Functions) | Gratis-tier holder for to brukere. Gir innlogging, delt database og bildelagring «out of the box». Edge Functions skjuler Claude-API-nøkkelen. |
| AI | **Anthropic Claude API**, modell `claude-sonnet-4-6` (vision) | Bildeforståelse + god resonnering til en fornuftig pris (~$3 input / $15 output per million tokens). |
| Varsler | **Daglig e-postoppsummering** (planlagt jobb i Supabase + en e-posttjeneste, f.eks. Resend) i v1. Web-push utsatt til post-MVP | Pålitelig på tvers av iPhone/PC uten iOS-PWA-begrensningene; se 7.4. |
| Hosting | **Vercel** eller **Netlify** (frontend) + Supabase (backend) | Gratis, HTTPS automatisk (kreves for PWA + push). |

**Viktig sikkerhetsregel:** Claude-API-nøkkelen skal *aldri* ligge i frontend-koden. Alle kall til
Claude går gjennom en Supabase Edge Function (eller tilsvarende serverless-funksjon) som holder
nøkkelen hemmelig som en miljøvariabel.

> Alternativ hvis dere heller vil ha alt i ett rammeverk: **Next.js** (App Router) med API-routes
> for Claude-kallene, og fortsatt Supabase for database/auth/storage. Begge er gode; React+Vite+Supabase
> er litt enklere å forstå for nybegynnere, Next.js samler frontend og backend i ett prosjekt.

---

## 6. Datamodell og AI-kontrakt

### 6.1 Databasetabeller (Postgres / Supabase)

```
households
  id              uuid  (pk)
  name            text
  created_at      timestamptz

users               -- håndteres i hovedsak av Supabase Auth
  id              uuid  (pk, = auth.users.id)
  household_id    uuid  (fk -> households.id)
  display_name    text

plants
  id              uuid  (pk)
  household_id    uuid  (fk -> households.id)
  nickname        text                 -- "Monstera på soverommet"
  species         text                 -- art/type, kan være null til AI fyller ut
  location        text                 -- rom/plassering
  photo_url       text                 -- profilbilde (Supabase Storage)
  light_needs     text                 -- stellguide-felt
  water_interval_days   int            -- f.eks. 7
  fertilize_interval_days int          -- nullable
  repot_interval_months   int          -- nullable
  toxic_to_pets   boolean
  notes           text
  last_watered_at      timestamptz
  last_fertilized_at   timestamptz
  next_water_due       date            -- beregnet fra last_watered_at + interval
  created_at      timestamptz

care_events          -- logg over utført stell
  id              uuid  (pk)
  plant_id        uuid  (fk -> plants.id)
  user_id         uuid  (fk -> users.id)
  type            text   -- 'watered' | 'fertilized' | 'repotted' | 'note'
  note            text
  created_at      timestamptz

diagnoses            -- AI-bildediagnoser
  id              uuid  (pk)
  plant_id        uuid  (fk -> plants.id, nullable hvis "løs" diagnose)
  user_id         uuid  (fk -> users.id)
  image_urls      text[]                -- bildene som ble analysert
  model           text                  -- f.eks. 'claude-sonnet-4-6'
  result_json     jsonb                 -- strukturert svar (se 6.2)
  summary         text                  -- kort menneskelesbar oppsummering
  created_at      timestamptz
```

Bruk **Row Level Security (RLS)** i Supabase slik at en bruker bare ser rader der
`household_id` matcher sitt eget. Dette er viktig og bør settes opp tidlig.

### 6.2 AI-kontrakt (bildediagnose)

Backend-funksjonen `diagnose-plant` skal:

1. Ta imot: `plant_id` (valgfri), 1–3 bilde-URL-er/base64, og kontekst (art, sist vannet, plassering).
2. Kalle Claude `claude-sonnet-4-6` med bildene og en system-prompt som ber om **strengt JSON-svar**.
3. Validere svaret mot skjemaet under og lagre det i `diagnoses`.

Ønsket JSON-form fra Claude (eksempel):

```json
{
  "likely_issues": [
    {
      "issue": "Overvanning",
      "confidence": "høy",
      "evidence": "Gule, slappe nedre blader og fuktig jord synlig i potten."
    }
  ],
  "overall_health": "middels",
  "actions": [
    "La jorden tørke ut de øverste 3–4 cm før neste vanning.",
    "Sjekk at potten har dreneringshull.",
    "Fjern de helt gule bladene."
  ],
  "watering_recommendation_days": 10,
  "notes": "Følg opp om 1–2 uker; ta nytt bilde for sammenligning."
}
```

Prompten må be Claude om å svare på **norsk**, kun returnere gyldig JSON i dette formatet, og
være ærlig om usikkerhet (ikke gjette art med falsk selvtillit). For «fyll ut stellguide»-funksjonen
brukes en lignende kontrakt uten bilder, som returnerer `light_needs`, `water_interval_days`,
`fertilize_interval_days`, `repot_interval_months`, `toxic_to_pets` og `notes`.

---

## 7. Tekniske notater og fallgruver

### 7.1 API-nøkkel-sikkerhet
Claude-nøkkelen ligger kun som hemmelig miljøvariabel i Edge Function. Frontend kaller funksjonen,
ikke Anthropic direkte.

### 7.2 Bilder
Komprimer bilder i frontend før opplasting (f.eks. maks 1280 px bredde) for å spare lagring og
redusere token-kostnad ved diagnose. Lagre i Supabase Storage; lagre kun URL-en i databasen.

### 7.3 Kostnadskontroll
Bildediagnose koster penger per kall. For to brukere med 10 planter blir dette små beløp, men:
sett en enkel grense (f.eks. maks X diagnoser per dag) og vis brukeren at et kall bruker AI.
Vurder å resize bilder for å holde token-bruk nede.

### 7.4 iOS-PWA og push-varsler (viktig begrensning)
Push-varsler i en PWA på iPhone fungerer **kun** når: enheten kjører iOS 16.4 eller nyere, brukeren
har lagt appen til **hjemskjermen**, appen serveres over HTTPS, og varseltillatelse bes om etter en
**brukerhandling** (f.eks. et trykk på en knapp – ikke automatisk ved oppstart). På Android/desktop
er web-push mer fleksibelt.

Konsekvens for MVP: ikke stol på push alene. Bygg «I dag»-skjermen som den primære
påminnelsesmekanismen, legg til web-push som et tillegg, og vurder en **daglig e-postoppsummering**
(via en planlagt jobb) som den mest pålitelige påminneren på tvers av enheter. Native iOS-app (senere)
løser push-begrensningen helt.

### 7.5 Offline
PWA-en bør i det minste laste og vise eksisterende planter offline (service worker-caching).
Skriving/diagnose krever nett. Dette er «nice to have» i MVP.

---

## 8. Milepæler (foreslått byggerekkefølge for Claude Code)

**M0 – Prosjektoppsett**
Sett opp React+Vite+TS+Tailwind som PWA, Supabase-prosjekt, auth (innlogging), tabeller + RLS,
og deploy-pipeline til Vercel/Netlify. Resultat: man kan logge inn og se en tom planteliste.

**M1 – Planteregister**
CRUD for planter, profilbilde-opplasting, oversiktsside og detaljside. Resultat: paret kan legge
inn sine 10 planter manuelt.

**M2 – Bildediagnose + Plante-ID (Claude vision)**
Edge Function mot `claude-sonnet-4-6`. To flyter som deler oppsett: (a) Plante-ID fra bilde
(artsforslag ved registrering), (b) bildediagnose med tiltak. Inkluder også «AI fyll ut stellguide».
Resultat: ta bilde → få art-forslag og/eller diagnose med tiltak.

**M3 – Vanne-/stell-påminner**
Intervaller, «Vannet i dag»-knapp, beregning av neste forfall, «I dag»-skjerm, care_events-logg.
Resultat: appen viser hva som skal vannes i dag.

**M4 – Daglig e-postoppsummering**
Planlagt jobb som sender begge brukere en e-post når noe forfaller. Resultat: paret minnes på
vanning selv uten å åpne appen.

**M5 – Polish**
Tomtilstander, lasteindikatorer, feilhåndtering, offline-caching av planteliste, enkel onboarding.

Hver milepæl bør være selvstendig testbar før man går videre.

---

## 9. Avklart – og det lille som gjenstår

Alle de tidligere åpne spørsmålene er nå besvart (se seksjon 0): varsler = «I dag»-skjerm +
daglig e-post, to kontoer på samme husstand, plante-ID fra bilde i v1, kun norsk.

Det eneste som ikke er strengt nødvendig å avklare før oppstart:

- **AI-budsjett:** ingen hard grense satt. For to brukere og ~10 planter blir kostnaden svært lav,
  men implementer en enkel sikring (f.eks. maks antall diagnoser/ID-er per dag) for å unngå utilsiktet
  forbruk. Kan justeres når dere ser faktisk bruk.
- **E-posttjeneste:** velg en gratis-tier-tjeneste (f.eks. Resend) når M4 bygges; ikke en blokker for M0–M3.

---

## 10. Hva Claude Code trenger som input ved oppstart

- Dette dokumentet (SPEC.md).
- En Anthropic API-nøkkel (legges som hemmelig miljøvariabel, ikke i koden).
- Et Supabase-prosjekt (URL + anon key for frontend, service role kun i Edge Functions).
- Beslutninger på de åpne spørsmålene i seksjon 9 (kan også avgjøres underveis med fornuftige
  standardvalg).

> Foreslått første instruksjon til Claude Code: «Les SPEC.md. Start med milepæl M0: sett opp
> prosjektstrukturen, Supabase-tabellene med RLS, og en fungerende innlogging. Stopp og vis meg
> resultatet før du går videre til M1.»
