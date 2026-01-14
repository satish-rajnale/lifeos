-- Fix profiles for existing users who authenticated before trigger was added
-- This ensures all users have profiles even if they signed up before the trigger

-- Create profiles for any auth.users that don't have a profile
insert into public.profiles (id, timezone, notification_enabled)
select 
    u.id,
    coalesce(u.raw_user_meta_data->>'timezone', 'UTC') as timezone,
    true as notification_enabled
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Create credits for any users that don't have credits
insert into public.usage_credits (user_id, daily_journal_credits)
select 
    p.id,
    1 as daily_journal_credits
from public.profiles p
left join public.usage_credits c on c.user_id = p.id
where c.user_id is null
on conflict (user_id) do nothing;

-- Verify setup
do $$
declare
    user_count int;
    profile_count int;
    credits_count int;
    trigger_exists bool;
begin
    -- Count users
    select count(*) into user_count from auth.users;
    select count(*) into profile_count from public.profiles;
    select count(*) into credits_count from public.usage_credits;
    
    -- Check if trigger exists
    select exists(
        select 1 from pg_trigger 
        where tgname = 'on_auth_user_created'
    ) into trigger_exists;
    
    raise notice '=== Database Status ===';
    raise notice 'Users: %', user_count;
    raise notice 'Profiles: %', profile_count;
    raise notice 'Credits: %', credits_count;
    raise notice 'Trigger exists: %', trigger_exists;
    
    if user_count != profile_count then
        raise warning 'Mismatch: % users but % profiles!', user_count, profile_count;
    else
        raise notice 'All users have profiles ✓';
    end if;
    
    if profile_count != credits_count then
        raise warning 'Mismatch: % profiles but % credits!', profile_count, credits_count;
    else
        raise notice 'All profiles have credits ✓';
    end if;
end $$;
