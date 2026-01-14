create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  journal_date date not null,
  raw_transcript text not null,
  summary jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, journal_date)
);
