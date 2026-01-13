create table profiles (
  id uuid primary key references auth.users(id),
  created_at timestamptz default now(),
  timezone text,
  notification_enabled boolean default true
);
