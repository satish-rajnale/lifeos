alter table journal_entries enable row level security;
alter table usage_credits enable row level security;

-- Journal policies
create policy "Users can read own journals"
on journal_entries
for select
using (auth.uid() = user_id);

create policy "Only edge function can insert journals"
on journal_entries
for insert
with check (false);

-- Credits policies
create policy "Users can read own credits"
on usage_credits
for select
using (auth.uid() = user_id);

create policy "Credits mutable only via service role"
on usage_credits
for update
using (false);
