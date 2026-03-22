-- Unschedule the old nightly job
SELECT cron.unschedule('nightly-sync-job');

-- Schedule the new hourly job
-- Runs at the top of every hour (0 * * * *)
SELECT cron.schedule(
  'hourly-sync-job',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://hchyoyctxrxmxpdkjqyp.supabase.co/functions/v1/sync-orchestrator',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
