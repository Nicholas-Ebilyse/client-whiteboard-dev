-- Create app_role enum for role-based access control
create type public.app_role as enum ('admin', 'user');

-- Create user_roles table for managing user permissions
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null default 'user',
  created_at timestamp with time zone default now(),
  unique (user_id, role)
);

-- Enable RLS on user_roles
alter table public.user_roles enable row level security;

-- Create security definer function to check roles (prevents recursive RLS)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Create security definer function to check if user is admin
create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'admin')
$$;

-- RLS policies for user_roles table
create policy "Admins can view all roles"
  on public.user_roles for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can insert roles"
  on public.user_roles for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update roles"
  on public.user_roles for update
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can delete roles"
  on public.user_roles for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- Drop existing public policies and replace with authenticated-only policies

-- TECHNICIANS TABLE
drop policy if exists "Allow public delete on technicians" on public.technicians;
drop policy if exists "Allow public insert on technicians" on public.technicians;
drop policy if exists "Allow public read on technicians" on public.technicians;
drop policy if exists "Allow public update on technicians" on public.technicians;

create policy "Authenticated users can view technicians"
  on public.technicians for select
  to authenticated
  using (true);

create policy "Admins can insert technicians"
  on public.technicians for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update technicians"
  on public.technicians for update
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can delete technicians"
  on public.technicians for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- ASSIGNMENTS TABLE
drop policy if exists "Allow public delete on assignments" on public.assignments;
drop policy if exists "Allow public insert on assignments" on public.assignments;
drop policy if exists "Allow public read on assignments" on public.assignments;
drop policy if exists "Allow public update on assignments" on public.assignments;

create policy "Authenticated users can view assignments"
  on public.assignments for select
  to authenticated
  using (true);

create policy "Admins can insert assignments"
  on public.assignments for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update assignments"
  on public.assignments for update
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can delete assignments"
  on public.assignments for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- COMMANDES TABLE
drop policy if exists "Allow public delete on commandes" on public.commandes;
drop policy if exists "Allow public insert on commandes" on public.commandes;
drop policy if exists "Allow public read on commandes" on public.commandes;
drop policy if exists "Allow public update on commandes" on public.commandes;

create policy "Authenticated users can view commandes"
  on public.commandes for select
  to authenticated
  using (true);

create policy "Admins can insert commandes"
  on public.commandes for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update commandes"
  on public.commandes for update
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can delete commandes"
  on public.commandes for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- NOTES TABLE
drop policy if exists "Allow public delete on notes" on public.notes;
drop policy if exists "Allow public insert on notes" on public.notes;
drop policy if exists "Allow public read on notes" on public.notes;
drop policy if exists "Allow public update on notes" on public.notes;

create policy "Authenticated users can view notes"
  on public.notes for select
  to authenticated
  using (true);

create policy "Admins can insert notes"
  on public.notes for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update notes"
  on public.notes for update
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can delete notes"
  on public.notes for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- CHANTIERS TABLE
drop policy if exists "Allow public delete on chantiers" on public.chantiers;
drop policy if exists "Allow public insert on chantiers" on public.chantiers;
drop policy if exists "Allow public read on chantiers" on public.chantiers;
drop policy if exists "Allow public update on chantiers" on public.chantiers;

create policy "Authenticated users can view chantiers"
  on public.chantiers for select
  to authenticated
  using (true);

create policy "Admins can insert chantiers"
  on public.chantiers for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update chantiers"
  on public.chantiers for update
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can delete chantiers"
  on public.chantiers for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- WEEK_CONFIG TABLE
drop policy if exists "Allow public delete on week_config" on public.week_config;
drop policy if exists "Allow public insert on week_config" on public.week_config;
drop policy if exists "Allow public read on week_config" on public.week_config;
drop policy if exists "Allow public update on week_config" on public.week_config;

create policy "Authenticated users can view week_config"
  on public.week_config for select
  to authenticated
  using (true);

create policy "Admins can insert week_config"
  on public.week_config for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update week_config"
  on public.week_config for update
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can delete week_config"
  on public.week_config for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- APP_PASSWORD TABLE - System only (no direct access)
drop policy if exists "Allow public insert on app_password" on public.app_password;
drop policy if exists "Allow public read on app_password" on public.app_password;
drop policy if exists "Allow public update on app_password" on public.app_password;

-- No policies on app_password - deprecated in favor of Supabase Auth
-- This table will no longer be accessible, effectively disabling the insecure password system