-- Add a column to track if journal entry has been summarized
alter table journal_entries 
add column if not exists is_summarized boolean default false;

-- Add a column to store the raw summary JSON temporarily
alter table journal_entries 
alter column summary drop not null;

-- Create index for unsummarized entries
create index if not exists idx_journal_entries_unsummarized 
on journal_entries(user_id, created_at) 
where is_summarized = false;

-- Function to notify when new journal entry needs summarization
create or replace function notify_new_journal_entry()
returns trigger as $$
begin
  -- Send notification with journal entry ID
  perform pg_notify(
    'new_journal_entry',
    json_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'date', NEW.date,
      'raw_transcript', NEW.raw_transcript
    )::text
  );
  
  return NEW;
end;
$$ language plpgsql;

-- Create trigger that fires after insert
drop trigger if exists on_journal_entry_created on journal_entries;
create trigger on_journal_entry_created
  after insert on journal_entries
  for each row
  when (NEW.summary is null)
  execute function notify_new_journal_entry();

-- Note: This trigger sends a notification. 
-- You'll need to set up a Supabase Database Webhook to listen to this
-- and call the edge function.
