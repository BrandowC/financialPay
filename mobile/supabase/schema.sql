-- FinancialPay - Esquema completo (idempotente, seguro de re-ejecutar)
-- Ejecuta TODO esto en Supabase: SQL Editor > New query > Run

-- 1) Tabla de perfiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  birth_date date,
  phone_country_code text,
  phone_number text,
  credit_number text not null,
  created_at timestamptz not null default now()
);

-- 2) Si la tabla existía sin birth_date, lo agregamos. Si tenía cédula, la quitamos.
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles drop column if exists id_type;
alter table public.profiles drop column if exists id_number;

-- 3) Función que genera un número de crédito aleatorio (16 dígitos, 4 bloques)
create or replace function public.generate_credit_number()
returns text
language plpgsql
as $$
begin
  return
    lpad((floor(random() * 10000))::int::text, 4, '0') || ' ' ||
    lpad((floor(random() * 10000))::int::text, 4, '0') || ' ' ||
    lpad((floor(random() * 10000))::int::text, 4, '0') || ' ' ||
    lpad((floor(random() * 10000))::int::text, 4, '0');
end;
$$;

-- 4) Trigger: cuando se crea un usuario en auth.users, crea su perfil automáticamente
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    birth_date,
    phone_country_code,
    phone_number,
    credit_number
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'birth_date', '')::date,
    new.raw_user_meta_data->>'phone_country_code',
    new.raw_user_meta_data->>'phone_number',
    public.generate_credit_number()
  );
  return new;
exception when others then
  raise warning '[FinancialPay] No se pudo crear el perfil para %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) Row Level Security
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- 6) Función auxiliar para normalizar texto (sin tildes, sin mayúsculas, espacios colapsados)
create or replace function public.normalize_name(input text)
returns text
language sql
immutable
as $$
  select translate(
    lower(regexp_replace(coalesce(input, ''), '\s+', ' ', 'g')),
    'áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
    'aeiouunaeiouunaeiouaeiouaeiouaeiou'
  );
$$;

-- 7) Función para buscar email por nombre (usada en login)
-- Solo encuentra el email si hay UN único usuario con ese nombre.
-- Si hay duplicados, devuelve null para evitar entrar a la cuenta equivocada.
create or replace function public.lookup_email(input text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  found_email text;
  matches_count int;
  trimmed text;
  normalized text;
begin
  trimmed := trim(coalesce(input, ''));
  if trimmed = '' then
    return null;
  end if;

  normalized := public.normalize_name(trimmed);

  select count(*) into matches_count
  from public.profiles p
  where public.normalize_name(p.full_name) = normalized;

  if matches_count = 1 then
    select u.email into found_email
    from auth.users u
    join public.profiles p on p.id = u.id
    where public.normalize_name(p.full_name) = normalized
    limit 1;
  end if;

  return found_email;
end;
$$;

grant execute on function public.normalize_name(text) to anon, authenticated;
grant execute on function public.lookup_email(text) to anon, authenticated;

-- 8) Crear perfiles para usuarios huérfanos (auth.users sin perfil)
-- Esto pasa cuando el trigger falla silenciosamente. Se basa en raw_user_meta_data.
insert into public.profiles (id, full_name, birth_date, phone_country_code, phone_number, credit_number)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  nullif(u.raw_user_meta_data->>'birth_date', '')::date,
  u.raw_user_meta_data->>'phone_country_code',
  u.raw_user_meta_data->>'phone_number',
  public.generate_credit_number()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
