-- Simulierte CSV-Daten strikt von verifizierten Marktinformationen trennen.
create table if not exists public.scanner_test_values (
 discovery_id uuid primary key references public.discoveries(id) on delete cascade,
 values_json jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.scanner_test_values enable row level security;
create policy "authenticated can read scanner test values"
 on public.scanner_test_values for select to authenticated using (true);
-- Schreibzugriff ausschließlich über die authentifizierte Import-Edge-Function mit Service Role.
