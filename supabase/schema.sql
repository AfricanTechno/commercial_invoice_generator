create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  address text not null default '',
  address1 text not null default '',
  address2 text not null default '',
  city text not null default '',
  state_province text not null default '',
  postal_code text not null default '',
  country text not null default '',
  phone text not null default '',
  email text not null default '',
  tax_id text not null default '',
  role_hints text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists contacts_owner_user_id_idx on public.contacts (owner_user_id);
create index if not exists contacts_deleted_at_idx on public.contacts (deleted_at);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  category text not null default 'Other',
  hs_code text not null default '',
  unit_price double precision not null default 0,
  sku text not null default '',
  origin text not null default '',
  weight double precision not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists products_owner_user_id_idx on public.products (owner_user_id);
create index if not exists products_deleted_at_idx on public.products (deleted_at);

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  linked_contact_id uuid,
  sync_with_contact boolean not null default false,
  name text not null default '',
  address text not null default '',
  address1 text not null default '',
  address2 text not null default '',
  city text not null default '',
  state_province text not null default '',
  postal_code text not null default '',
  country text not null default '',
  phone text not null default '',
  email text not null default '',
  tax_id text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.contacts add column if not exists address1 text not null default '';
alter table public.contacts add column if not exists address2 text not null default '';
alter table public.contacts add column if not exists city text not null default '';
alter table public.contacts add column if not exists state_province text not null default '';
alter table public.contacts add column if not exists postal_code text not null default '';
alter table public.contacts add column if not exists country text not null default '';

alter table public.company_profiles add column if not exists address1 text not null default '';
alter table public.company_profiles add column if not exists address2 text not null default '';
alter table public.company_profiles add column if not exists city text not null default '';
alter table public.company_profiles add column if not exists state_province text not null default '';
alter table public.company_profiles add column if not exists postal_code text not null default '';
alter table public.company_profiles add column if not exists country text not null default '';
alter table public.company_profiles add column if not exists linked_contact_id uuid;
alter table public.company_profiles add column if not exists sync_with_contact boolean not null default false;

alter table public.contacts enable row level security;
alter table public.products enable row level security;
alter table public.company_profiles enable row level security;

drop policy if exists "contacts_select_own" on public.contacts;
create policy "contacts_select_own"
on public.contacts
for select
using (auth.uid() = owner_user_id);

drop policy if exists "contacts_insert_own" on public.contacts;
create policy "contacts_insert_own"
on public.contacts
for insert
with check (auth.uid() = owner_user_id);

drop policy if exists "contacts_update_own" on public.contacts;
create policy "contacts_update_own"
on public.contacts
for update
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists "contacts_delete_own" on public.contacts;
create policy "contacts_delete_own"
on public.contacts
for delete
using (auth.uid() = owner_user_id);

drop policy if exists "products_select_own" on public.products;
create policy "products_select_own"
on public.products
for select
using (auth.uid() = owner_user_id);

drop policy if exists "products_insert_own" on public.products;
create policy "products_insert_own"
on public.products
for insert
with check (auth.uid() = owner_user_id);

drop policy if exists "products_update_own" on public.products;
create policy "products_update_own"
on public.products
for update
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists "products_delete_own" on public.products;
create policy "products_delete_own"
on public.products
for delete
using (auth.uid() = owner_user_id);

drop policy if exists "company_profiles_select_own" on public.company_profiles;
create policy "company_profiles_select_own"
on public.company_profiles
for select
using (auth.uid() = owner_user_id);

drop policy if exists "company_profiles_insert_own" on public.company_profiles;
create policy "company_profiles_insert_own"
on public.company_profiles
for insert
with check (auth.uid() = owner_user_id);

drop policy if exists "company_profiles_update_own" on public.company_profiles;
create policy "company_profiles_update_own"
on public.company_profiles
for update
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists "company_profiles_delete_own" on public.company_profiles;
create policy "company_profiles_delete_own"
on public.company_profiles
for delete
using (auth.uid() = owner_user_id);
