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
  promotional_price numeric,
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

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null unique,
  empresa_unidade text not null default '',
  status text not null default 'ativo' check (status in ('ativo', 'bloqueado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  status text not null default 'aberto',
  total numeric not null default 0,
  forma_pagamento text not null default 'pix' check (forma_pagamento in ('pix', 'dinheiro', 'credito', 'debito')),
  status_pagamento text not null default 'pendente' check (status_pagamento in ('aprovado', 'pendente', 'recusado', 'cancelado')),
  transaction_id text,
  pago_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  pedido_id uuid references public.pedidos(id) on delete set null,
  valor numeric not null default 0,
  metodo text not null default 'pix',
  status text not null default 'pendente',
  criado_em timestamptz not null default now()
);

create table if not exists public.mercado_pago_settings (
  id text primary key default 'main',
  access_token text not null default '',
  public_key text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists category_id text not null default '';

alter table public.products
  add column if not exists promotional_price numeric;

alter table public.store_config
  add column if not exists filter_all_label text not null default 'Todos',
  add column if not exists filter_promo_label text not null default 'Ofertas',
  add column if not exists filter_available_label text not null default 'Disponiveis',
  add column if not exists category_all_label text not null default 'Todas categorias',
  add column if not exists show_filter_all boolean not null default true,
  add column if not exists show_filter_promo boolean not null default true,
  add column if not exists show_filter_available boolean not null default true,
  add column if not exists show_category_filter boolean not null default true;

alter table public.clientes
  drop column if exists limite;

alter table public.pedidos
  add column if not exists forma_pagamento text not null default 'pix',
  add column if not exists status_pagamento text not null default 'pendente',
  add column if not exists transaction_id text,
  add column if not exists pago_em timestamptz;

alter table public.pedidos
  drop constraint if exists pedidos_forma_pagamento_check,
  add constraint pedidos_forma_pagamento_check check (forma_pagamento in ('pix', 'dinheiro', 'credito', 'debito'));

alter table public.pedidos
  drop constraint if exists pedidos_status_pagamento_check,
  add constraint pedidos_status_pagamento_check check (status_pagamento in ('aprovado', 'pendente', 'recusado', 'cancelado'));

drop table if exists public.dividas;

alter table public.store_config enable row level security;
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.clientes enable row level security;
alter table public.pedidos enable row level security;
alter table public.pagamentos enable row level security;
alter table public.mercado_pago_settings enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.store_config to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;
grant select, insert, update, delete on public.categories to anon, authenticated;
grant select, insert, update, delete on public.clientes to anon, authenticated;
grant select, insert, update, delete on public.pedidos to anon, authenticated;
grant select, insert, update, delete on public.pagamentos to anon, authenticated;
revoke all on public.mercado_pago_settings from anon, authenticated;

drop policy if exists "Public can read store config" on public.store_config;
drop policy if exists "Public can write store config" on public.store_config;
drop policy if exists "Public can read categories" on public.categories;
drop policy if exists "Public can write categories" on public.categories;
drop policy if exists "Public can read products" on public.products;
drop policy if exists "Public can write products" on public.products;
drop policy if exists "Public can read clients" on public.clientes;
drop policy if exists "Public can write clients" on public.clientes;
drop policy if exists "Public can read orders" on public.pedidos;
drop policy if exists "Public can write orders" on public.pedidos;
drop policy if exists "Public can read payments" on public.pagamentos;
drop policy if exists "Public can write payments" on public.pagamentos;

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

create policy "Public can read clients"
  on public.clientes for select
  using (true);

create policy "Public can write clients"
  on public.clientes for all
  using (true)
  with check (true);

create policy "Public can read orders"
  on public.pedidos for select
  using (true);

create policy "Public can write orders"
  on public.pedidos for all
  using (true)
  with check (true);

create policy "Public can read payments"
  on public.pagamentos for select
  using (true);

create policy "Public can write payments"
  on public.pagamentos for all
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
