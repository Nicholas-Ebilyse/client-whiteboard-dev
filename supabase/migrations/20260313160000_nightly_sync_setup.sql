-- Enable required extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Create global_settings table
create table if not exists public.global_settings (
  key text primary key,
  value text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.global_settings enable row level security;

-- Admin only access
create policy "Admins can manage global_settings"
  on public.global_settings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and role = 'admin'
    )
  );

-- Insert default calendar ID
insert into public.global_settings (key, value)
values (
  'google_calendar_id', 
  'c_8ca18ced58f50f7a5d670b6bee03ca40017d805860177daba7efcd7a6a53b8b2@group.calendar.google.com'
)
on conflict (key) do nothing;

-- Schedule the nightly sync orchestrator
-- Note: This assumes the project URL. We use a relative path if possible or the full URL.
-- For local development, this might not work without a tunnel, but for production it's standard.
-- We'll use a placeholder for the project ref that the user might need to adjust, 
-- or we can try to fetch it if we had tools, but usually we use the project ref from config.
select cron.schedule(
  'nightly-sync-job',
  '0 2 * * *', -- 2 AM every night
  $$
  select
    net.http_post(
      url:='https://hchyoyctxrxmxpdkjqyp.supabase.co/functions/v1/nightly-sync-orchestrator',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
