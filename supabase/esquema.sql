-- FITYA: estructura de la base de datos en Supabase
-- Pega todo esto en Supabase, SQL Editor, y presiona Run. Solo se hace una vez.

create table if not exists tienda (
  id int primary key default 1,
  datos jsonb not null default '{}'::jsonb
);

create table if not exists categorias (
  id text primary key,
  nombre text not null,
  texto text default '',
  orden int default 0
);

create table if not exists productos (
  id text primary key,
  nombre text not null,
  cat text references categorias(id) on update cascade on delete set null,
  marca text default '',
  precio numeric not null default 0,
  antes numeric,
  desde boolean default false,
  pres text default '',
  descripcion text default '',
  puntos text[] default '{}',
  opciones text[] default '{}',
  fotos text[] default '{}',
  wa text default '',
  destacado boolean default false,
  disponible boolean default true,
  orden int default 0,
  creado timestamptz default now()
);

create table if not exists eventos (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('visita','vista','agregar','buscar','pedido','consulta')),
  producto text,
  datos jsonb default '{}'::jsonb,
  sesion text,
  creado timestamptz default now()
);
create index if not exists eventos_creado on eventos (creado);

-- Seguridad: cualquiera puede ver el catálogo y registrar métricas,
-- solo quien inició sesión en el panel puede editar y ver métricas.
alter table tienda enable row level security;
alter table categorias enable row level security;
alter table productos enable row level security;
alter table eventos enable row level security;

create policy "ver tienda" on tienda for select using (true);
create policy "ver categorias" on categorias for select using (true);
create policy "ver productos" on productos for select using (true);
create policy "editar tienda" on tienda for all to authenticated using (true) with check (true);
create policy "editar categorias" on categorias for all to authenticated using (true) with check (true);
create policy "editar productos" on productos for all to authenticated using (true) with check (true);
create policy "registrar eventos" on eventos for insert to anon, authenticated with check (true);
create policy "ver eventos" on eventos for select to authenticated using (true);

-- Carpeta pública para las fotos de productos
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true)
  on conflict (id) do nothing;
create policy "ver fotos" on storage.objects for select using (bucket_id = 'fotos');
create policy "subir fotos" on storage.objects for insert to authenticated with check (bucket_id = 'fotos');
create policy "cambiar fotos" on storage.objects for update to authenticated using (bucket_id = 'fotos');
create policy "borrar fotos" on storage.objects for delete to authenticated using (bucket_id = 'fotos');

-- Combos (paquetes de productos con precio especial)
create table if not exists combos (
  id text primary key,
  datos jsonb not null,
  orden int default 0
);
alter table combos enable row level security;
drop policy if exists "combos lectura" on combos;
drop policy if exists "combos escritura" on combos;
create policy "combos lectura" on combos for select using (true);
create policy "combos escritura" on combos for all to authenticated using (true) with check (true);
