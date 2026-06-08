create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  staff_id text unique not null,
  display_name text not null,
  role text not null default 'staff' check (role in ('staff', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists email text;

alter table public.profiles
add column if not exists staff_id text;

create unique index if not exists profiles_email_key on public.profiles(email);
create unique index if not exists profiles_staff_id_key on public.profiles(staff_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, staff_id, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'staff_id', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    'staff'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.get_auth_email_by_staff_id(target_staff_id text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where staff_id = target_staff_id
  limit 1;
$$;

grant execute on function public.get_auth_email_by_staff_id(text) to anon, authenticated;

create table if not exists public.shift_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_name text not null,
  month_value text not null,
  available_dates date[] not null default '{}',
  off_dates date[] not null default '{}',
  day_statuses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.shift_submissions
add column if not exists day_statuses jsonb not null default '{}'::jsonb;

create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_name text not null,
  target_date date not null,
  change_type text not null check (change_type in ('出勤→休み', '休み→出勤')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.shift_submissions enable row level security;
alter table public.change_requests enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "shift_select_own_or_admin" on public.shift_submissions;
create policy "shift_select_own_or_admin"
on public.shift_submissions
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "shift_insert_own" on public.shift_submissions;
create policy "shift_insert_own"
on public.shift_submissions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "shift_delete_own_or_admin" on public.shift_submissions;
create policy "shift_delete_own_or_admin"
on public.shift_submissions
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "change_select_own_or_admin" on public.change_requests;
create policy "change_select_own_or_admin"
on public.change_requests
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "change_insert_own" on public.change_requests;
create policy "change_insert_own"
on public.change_requests
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "change_delete_own_or_admin" on public.change_requests;
create policy "change_delete_own_or_admin"
on public.change_requests
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());
