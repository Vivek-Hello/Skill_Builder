-- Skills hub: public profiles, skills, versions and stars.
-- Run once in the Supabase SQL editor (or with `supabase db push`).

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9]([a-z0-9-]{0,37}[a-z0-9])?$'),
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Usernames that would collide with app routes
create table public.reserved_usernames (name text primary key);
insert into public.reserved_usernames (name) values
  ('about'), ('admin'), ('api'), ('auth'), ('docs'), ('explore'), ('help'), ('login'),
  ('logout'), ('new'), ('settings'), ('signup'), ('skills'), ('u'), ('www');

-- Create a profile for every new account, deriving a unique username
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  base text;
  candidate text;
begin
  base := lower(coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    split_part(new.email, '@', 1),
    'user'
  ));
  base := trim(both '-' from regexp_replace(base, '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'user'; end if;
  base := left(base, 32);

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate)
     or exists (select 1 from public.reserved_usernames where name = candidate) loop
    candidate := base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- skills

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  description text not null default '' check (length(description) <= 1024),
  license text,
  origin text not null default 'generated' check (origin in ('generated', 'adapted', 'cloned', 'forked')),
  -- Where the content originally came from on GitHub, when cloned or adapted
  source jsonb,
  forked_from uuid references public.skills (id) on delete set null,
  latest_version int not null default 0,
  stars_count int not null default 0,
  forks_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', replace(slug, '-', ' ')), 'A') ||
    setweight(to_tsvector('english', description), 'B')
  ) stored,
  unique (owner_id, slug)
);

create index skills_search_idx on public.skills using gin (search);
create index skills_stars_idx on public.skills (stars_count desc, updated_at desc);
create index skills_updated_idx on public.skills (updated_at desc);
create index skills_forked_from_idx on public.skills (forked_from);

create table public.skill_versions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills (id) on delete cascade,
  version int not null,
  -- [{ "path": "SKILL.md", "content": "..." }, ...]
  files jsonb not null check (jsonb_typeof(files) = 'array' and octet_length(files::text) <= 1100000),
  message text not null default '' check (length(message) <= 500),
  -- What changed when this version was adapted from another skill
  changes jsonb,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (skill_id, version)
);

create table public.stars (
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create index stars_skill_idx on public.stars (skill_id);

-- ---------------------------------------------------------------- counters

create function public.bump_star_count()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.skills set stars_count = stars_count + 1 where id = new.skill_id;
  else
    update public.skills set stars_count = greatest(stars_count - 1, 0) where id = old.skill_id;
  end if;
  return null;
end;
$$;

create trigger stars_count_trigger
  after insert or delete on public.stars
  for each row execute function public.bump_star_count();

create function public.bump_fork_count()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.forked_from is not null then
    update public.skills set forks_count = forks_count + 1 where id = new.forked_from;
  elsif tg_op = 'DELETE' and old.forked_from is not null then
    update public.skills set forks_count = greatest(forks_count - 1, 0) where id = old.forked_from;
  end if;
  return null;
end;
$$;

create trigger forks_count_trigger
  after insert or delete on public.skills
  for each row execute function public.bump_fork_count();

-- ---------------------------------------------------------------- publishing

-- Publish a skill for the signed-in user: creates it on first publish, then adds
-- the next version number. Runs as the caller, so row-level security still applies.
create function public.publish_skill(
  p_slug text,
  p_description text,
  p_license text,
  p_origin text,
  p_source jsonb,
  p_forked_from uuid,
  p_files jsonb,
  p_message text,
  p_changes jsonb
)
returns table (skill_id uuid, version int)
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_skill uuid;
  v_version int;
begin
  if auth.uid() is null then
    raise exception 'Sign in to publish';
  end if;

  insert into public.skills (owner_id, slug, description, license, origin, source, forked_from)
  values (auth.uid(), p_slug, p_description, p_license, p_origin, p_source, p_forked_from)
  on conflict (owner_id, slug) do update
    set description = excluded.description,
        license = coalesce(excluded.license, public.skills.license),
        updated_at = now()
  returning id into v_skill;

  update public.skills s
     set latest_version = s.latest_version + 1, updated_at = now()
   where s.id = v_skill
  returning s.latest_version into v_version;

  insert into public.skill_versions (skill_id, version, files, message, changes, created_by)
  values (v_skill, v_version, p_files, coalesce(p_message, ''), p_changes, auth.uid());

  return query select v_skill, v_version;
end;
$$;

-- ---------------------------------------------------------------- row-level security

alter table public.profiles enable row level security;
alter table public.reserved_usernames enable row level security;
alter table public.skills enable row level security;
alter table public.skill_versions enable row level security;
alter table public.stars enable row level security;

-- Everything on the hub is public to read
create policy "profiles are public" on public.profiles for select using (true);
create policy "skills are public" on public.skills for select using (true);
create policy "versions are public" on public.skill_versions for select using (true);
create policy "stars are public" on public.stars for select using (true);

-- Only owners change their own data
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "users create own skills" on public.skills
  for insert with check (auth.uid() = owner_id);
create policy "owners update skills" on public.skills
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners delete skills" on public.skills
  for delete using (auth.uid() = owner_id);

create policy "owners add versions" on public.skill_versions
  for insert with check (
    auth.uid() = created_by
    and exists (select 1 from public.skills s where s.id = skill_id and s.owner_id = auth.uid())
  );

create policy "users star as themselves" on public.stars
  for insert with check (auth.uid() = user_id);
create policy "users unstar as themselves" on public.stars
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------- column privileges

-- Counters are only changed by the triggers above; usernames are fixed after sign-up
revoke insert, update on public.skills from anon, authenticated;
grant insert (owner_id, slug, description, license, origin, source, forked_from) on public.skills to authenticated;
grant update (description, license, latest_version, updated_at) on public.skills to authenticated;

revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

revoke insert, update, delete on public.reserved_usernames from anon, authenticated;
revoke update on public.skill_versions from anon, authenticated;
