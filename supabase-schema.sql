create table if not exists public.store_config (
  id text primary key default 'main',
  name text not null default 'doces da tati',
  logo text not null default '/logo-doces-da-tati-round.png',
  banner text not null default '',
  whatsapp text not null default '',
  pix_key text not null default '',
  pix_receiver_name text not null default 'DOCES DA TATI',
  pix_city text not null default 'RIO DE JANEIRO',
  admin_password text not null default 'bryan15',
  filter_all_label text not null default 'Todos',
  filter_promo_label text not null default 'Ofertas',
  filter_available_label text not null default 'Disponiveis',
  category_all_label text not null default 'Todas categorias',
  show_filter_all boolean not null default true,
  show_filter_promo boolean not null default true,
  show_filter_available boolean not null default true,
  show_category_filter boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  price numeric not null default 0,
  description text not null default '',
  image text not null default '',
  category_id text not null default '',
  is_promo boolean not null default false,
  stock integer not null default 0,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists category_id text not null default '';

alter table public.store_config
  add column if not exists filter_all_label text not null default 'Todos',
  add column if not exists filter_promo_label text not null default 'Ofertas',
  add column if not exists filter_available_label text not null default 'Disponiveis',
  add column if not exists category_all_label text not null default 'Todas categorias',
  add column if not exists show_filter_all boolean not null default true,
  add column if not exists show_filter_promo boolean not null default true,
  add column if not exists show_filter_available boolean not null default true,
  add column if not exists show_category_filter boolean not null default true;

alter table public.store_config enable row level security;
alter table public.products enable row level security;
alter table public.categories enable row level security;

drop policy if exists "Public can read store config" on public.store_config;
drop policy if exists "Public can write store config" on public.store_config;
drop policy if exists "Public can read categories" on public.categories;
drop policy if exists "Public can write categories" on public.categories;
drop policy if exists "Public can read products" on public.products;
drop policy if exists "Public can write products" on public.products;

create policy "Public can read store config"
  on public.store_config for select
  using (true);

create policy "Public can write store config"
  on public.store_config for all
  using (true)
  with check (true);

create policy "Public can read categories"
  on public.categories for select
  using (true);

create policy "Public can write categories"
  on public.categories for all
  using (true)
  with check (true);

create policy "Public can read products"
  on public.products for select
  using (true);

create policy "Public can write products"
  on public.products for all
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'store_config'
  ) then
    alter publication supabase_realtime add table public.store_config;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'categories'
  ) then
    alter publication supabase_realtime add table public.categories;
  end if;
end $$;
