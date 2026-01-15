-- Create journal_daily_summaries table
create table if not exists journal_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  journal_entry_id uuid references journal_entries(id) on delete cascade,
  date date not null,
  summary_text text not null,
  tts_audio_path text,
  is_active boolean default true not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for fetching latest active summary per date
create index idx_journal_daily_summaries_user_date_active 
on journal_daily_summaries(user_id, date, is_active, created_at desc);

-- Create journal_weekly_summaries table
create table if not exists journal_weekly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start_date date not null,
  week_end_date date not null,
  summary_text text not null,
  tts_audio_path text,
  stats jsonb, -- Store health, energy, achievements stats
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, week_start_date)
);

-- Enable RLS
alter table journal_daily_summaries enable row level security;

-- RLS Policies for daily summaries
create policy "Users can read own summaries"
on journal_daily_summaries
for select
using (auth.uid() = user_id);

create policy "Service role can manage summaries"
on journal_daily_summaries
for all
using (true); -- Service role has full access

-- RLS Policies for weekly summaries
create policy "Users can read own weekly summaries"
on journal_weekly_summaries
for select
using (auth.uid() = user_id);

create policy "Service role can manage weekly summaries"
on journal_weekly_summaries
for all
using (true); -- Service role has full access

-- Index for faster lookups
create index idx_journal_weekly_summaries_user_date 
on journal_weekly_summaries(user_id, week_start_date);

-- Function to update updated_at timestamp
create or replace function update_journal_summary_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers to auto-update updated_at
drop trigger if exists update_journal_summary_timestamp on journal_daily_summaries;
create trigger update_journal_summary_timestamp
  before update on journal_daily_summaries
  for each row
  execute function update_journal_summary_updated_at();

drop trigger if exists update_journal_weekly_summary_timestamp on journal_weekly_summaries;
create trigger update_journal_weekly_summary_timestamp
  before update on journal_weekly_summaries
  for each row
  execute function update_journal_summary_updated_at();

-- Create storage buckets for TTS audio
insert into storage.buckets (id, name, public)
values 
  ('journal-tts', 'journal-tts', false),
  ('journal-weekly-tts', 'journal-weekly-tts', false)
on conflict (id) do nothing;

-- Storage policies for journal-tts bucket
create policy "Users can read own TTS audio"
on storage.objects for select
using (
  bucket_id = 'journal-tts' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Service role can manage TTS audio"
on storage.objects for all
using (bucket_id = 'journal-tts');

-- Storage policies for journal-weekly-tts bucket
create policy "Users can read own weekly TTS audio"
on storage.objects for select
using (
  bucket_id = 'journal-weekly-tts' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Service role can manage weekly TTS audio"
on storage.objects for all
using (bucket_id = 'journal-weekly-tts');
