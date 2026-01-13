-- Enable RLS on profiles table
alter table profiles enable row level security;

-- Drop existing policies if any
drop policy if exists "Users can read own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Enable insert for authenticated users" on profiles;

-- Profiles policies
create policy "Users can read own profile"
on profiles
for select
using (auth.uid() = id);

create policy "Users can update own profile"
on profiles
for update
using (auth.uid() = id);

-- Allow authenticated users to insert their own profile
-- This is needed as a fallback if the trigger doesn't fire
create policy "Enable insert for authenticated users"
on profiles
for insert
with check (auth.uid() = id);

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, timezone, notification_enabled)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'timezone', 'UTC'),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger to automatically create profile when a new user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Also create initial credits record for new users
create or replace function public.handle_new_user_credits() 
returns trigger as $$
begin
  insert into public.usage_credits (user_id, daily_journal_credits)
  values (new.id, 1)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_created on profiles;
create trigger on_profile_created
  after insert on profiles
  for each row execute procedure public.handle_new_user_credits();
