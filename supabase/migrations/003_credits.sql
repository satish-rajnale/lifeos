create table usage_credits (
  user_id uuid primary key references auth.users(id),
  daily_journal_credits int not null default 1,
  updated_at timestamptz default now()
);

-- Function to decrement credits
create or replace function decrement_journal_credits()
returns trigger as $$
begin
  update usage_credits
  set daily_journal_credits = daily_journal_credits - 1,
      updated_at = now()
  where user_id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger
create trigger on_journal_created
  after insert on journal_entries
  for each row execute function decrement_journal_credits();
