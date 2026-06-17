-- Planto – M4: planlegg den daglige e-postoppsummeringen.
-- Kjør dette i Supabase SQL Editor ETTER at du har deployet `daily-summary`
-- og satt miljøvariablene (RESEND_API_KEY, RESEND_FROM, CRON_SECRET).
--
-- Bytt ut <PROSJEKT-REF> og <CRON_SECRET> med dine verdier før du kjører.

-- 1) Aktiver utvidelsene (kjøres én gang).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Planlegg jobben kl. 07:00 UTC hver dag (juster tidspunkt ved behov).
--    Kaller Edge Function via HTTP med den hemmelige cron-headeren.
select cron.schedule(
  'planto-daily-summary',
  '0 7 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROSJEKT-REF>.supabase.co/functions/v1/daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Nyttig:
--   select * from cron.job;                       -- se planlagte jobber
--   select cron.unschedule('planto-daily-summary'); -- fjern jobben
