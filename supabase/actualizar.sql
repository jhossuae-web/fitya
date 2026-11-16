-- FITYA: solo si ya habías corrido esquema.sql antes de esta versión.
-- Agrega el número de WhatsApp por producto y el texto de cada categoría.

alter table productos add column if not exists wa text default '';
alter table categorias add column if not exists texto text default '';

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
