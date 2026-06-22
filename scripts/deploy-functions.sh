#!/usr/bin/env bash
# Deployer Planto sine Supabase Edge Functions (plant-ai og daily-summary).
#
# Krever to miljøvariabler:
#   SUPABASE_ACCESS_TOKEN  – personlig token (Supabase → Account → Access Tokens)
#   SUPABASE_PROJECT_REF   – prosjekt-ref (delen <ref> i https://<ref>.supabase.co)
#
# Kjøres med:  npm run deploy:functions
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?Mangler SUPABASE_ACCESS_TOKEN (sett den i miljøet)}"
: "${SUPABASE_PROJECT_REF:?Mangler SUPABASE_PROJECT_REF (sett den i miljøet)}"

# Bruk en installert supabase-CLI hvis den finnes, ellers hent den via npx.
if command -v supabase >/dev/null 2>&1; then
  SUPABASE=(supabase)
else
  SUPABASE=(npx --yes supabase)
fi

for fn in plant-ai daily-summary; do
  echo "→ Deployer $fn …"
  "${SUPABASE[@]}" functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF"
done

echo "✓ Begge funksjonene er deployet."
