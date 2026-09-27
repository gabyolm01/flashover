-- ============================================================
-- Flashover : installation de la base de données (Supabase)
-- À coller une seule fois dans Supabase > SQL Editor > Run.
--
-- AVANT DE LANCER : remplacez les deux codes en bas du fichier
-- (CODE-STAGIAIRE et CODE-FORMATEUR) par vos propres codes.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- Contenu de la plateforme : un document JSON par clé
-- ("platform", "module:lances", "module:ari", ...)
create table if not exists public.flashover_content (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Codes d'accès, stockés uniquement sous forme d'empreinte (hash)
create table if not exists public.flashover_codes (
  role text primary key check (role in ('stagiaire', 'formateur')),
  hash text not null
);

-- Aucune lecture ni écriture directe depuis le site :
-- tout passe par les fonctions ci-dessous, qui vérifient le code.
alter table public.flashover_content enable row level security;
alter table public.flashover_codes enable row level security;

create or replace function public.flashover_hash(p_code text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(trim(p_code), ''), 'sha256'), 'hex');
$$;

-- Renvoie 'formateur', 'stagiaire' ou null
create or replace function public.flashover_login(p_code text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select role from public.flashover_codes
  where hash = public.flashover_hash(p_code)
  order by case role when 'formateur' then 0 else 1 end
  limit 1;
$$;

-- Tout le contenu, si le code est valide
create or replace function public.flashover_get(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if public.flashover_login(p_code) is null then
    raise exception 'code invalide' using errcode = '28000';
  end if;
  return (select coalesce(jsonb_object_agg(key, jsonb_build_object('data', data, 'updated_at', updated_at)), '{}'::jsonb)
          from public.flashover_content);
end $$;

-- Enregistrer un document (formateur uniquement)
create or replace function public.flashover_save(p_code text, p_key text, p_data jsonb) returns timestamptz
language plpgsql security definer set search_path = public, extensions as $$
declare t timestamptz := now();
begin
  if public.flashover_login(p_code) is distinct from 'formateur' then
    raise exception 'code formateur requis' using errcode = '28000';
  end if;
  insert into public.flashover_content(key, data, updated_at) values (p_key, p_data, t)
  on conflict (key) do update set data = excluded.data, updated_at = t;
  return t;
end $$;

-- Supprimer un document (formateur uniquement)
create or replace function public.flashover_delete(p_code text, p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if public.flashover_login(p_code) is distinct from 'formateur' then
    raise exception 'code formateur requis' using errcode = '28000';
  end if;
  delete from public.flashover_content where key = p_key;
end $$;

-- Changer un code (formateur uniquement)
create or replace function public.flashover_set_code(p_code text, p_role text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if public.flashover_login(p_code) is distinct from 'formateur' then
    raise exception 'code formateur requis' using errcode = '28000';
  end if;
  if length(trim(coalesce(p_new, ''))) < 4 then
    raise exception 'le code doit faire au moins 4 caractères';
  end if;
  if p_role not in ('stagiaire', 'formateur') then
    raise exception 'rôle inconnu';
  end if;
  insert into public.flashover_codes(role, hash) values (p_role, public.flashover_hash(p_new))
  on conflict (role) do update set hash = excluded.hash;
end $$;

-- Seules ces fonctions sont accessibles depuis le site
revoke all on function public.flashover_hash(text) from public, anon, authenticated;
revoke all on function public.flashover_login(text) from public;
revoke all on function public.flashover_get(text) from public;
revoke all on function public.flashover_save(text, text, jsonb) from public;
revoke all on function public.flashover_delete(text, text) from public;
revoke all on function public.flashover_set_code(text, text, text) from public;
grant execute on function public.flashover_login(text) to anon;
grant execute on function public.flashover_get(text) to anon;
grant execute on function public.flashover_save(text, text, jsonb) to anon;
grant execute on function public.flashover_delete(text, text) to anon;
grant execute on function public.flashover_set_code(text, text, text) to anon;

-- ====== Codes de départ : REMPLACEZ-LES avant de lancer ======
insert into public.flashover_codes(role, hash) values
  ('stagiaire', public.flashover_hash('CODE-STAGIAIRE')),
  ('formateur', public.flashover_hash('CODE-FORMATEUR'))
on conflict (role) do update set hash = excluded.hash;
