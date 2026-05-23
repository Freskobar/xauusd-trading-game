-- XAUUSD Trading Game Supabase save system
-- Run this inside Supabase Dashboard > SQL Editor.

create table if not exists public.game_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique,
    display_name text not null,
    save_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.game_profiles enable row level security;

create policy "Players can read only their own game profile"
on public.game_profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Players can insert only their own game profile"
on public.game_profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Players can update only their own game profile"
on public.game_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create index if not exists game_profiles_username_idx
on public.game_profiles (username);
