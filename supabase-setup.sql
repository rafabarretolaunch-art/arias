-- Ejecuta esto en Supabase → SQL Editor (una sola vez)

-- Tabla de pruebas con estado de aprobación
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  day int not null,
  file_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table submissions enable row level security;

create policy "anon insert submissions"
on submissions for insert to anon with check (true);

create policy "anon select submissions"
on submissions for select to anon using (true);

create policy "anon update submissions"
on submissions for update to anon using (true) with check (true);

-- Permitir ver las fotos desde la app (admin)
create policy "public read pruebas"
on storage.objects for select to public
using (bucket_id = 'pruebas');
