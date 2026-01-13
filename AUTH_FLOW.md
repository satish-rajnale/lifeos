# Authentication Flow Documentation

## Overview
This document explains the complete authentication flow in LifeOS, including user registration, profile creation, and navigation.

## File Structure

```
src/
├── app/
│   ├── auth/
│   │   ├── SignInScreen.tsx       # Login/OAuth entry point
│   │   └── callback.tsx           # OAuth callback handler (Route: /auth/callback)
│   └── index.tsx                  # Root route with auth check
├── services/
│   └── supabase/
│       ├── client.ts              # Supabase client config
│       └── db/
│           └── profiles.ts        # Profile management service
└── state/
    └── userStore.ts               # User state management
```

## Authentication Flow

### 1. Google OAuth Flow

```
User clicks "Continue with Google"
    ↓
SignInScreen.handleGoogleSignIn()
    ↓
Opens Google OAuth in browser
    ↓
User authenticates with Google
    ↓
Google redirects to Supabase
    ↓
Supabase processes OAuth
    ↓
Redirects to: lifeos://auth/callback?access_token=XXX&refresh_token=YYY
    ↓
App catches deep link
    ↓
Expo Router navigates to /auth/callback
    ↓
callback.tsx handles authentication
```

### 2. Callback Screen (`/auth/callback`)

The callback screen at `src/app/auth/callback.tsx` handles:

1. **Extract Tokens** - Gets `access_token` and `refresh_token` from URL params
2. **Set Session** - Calls `supabase.auth.setSession({ access_token, refresh_token })`
3. **Profile Created** - Database trigger automatically creates profile
4. **Navigate** - Redirects to `/journal/DailyJournalScreen`

```typescript
// Simplified flow in callback.tsx (Implicit Flow)
const handleCallback = async () => {
  // 1. Extract tokens from URL
  const { access_token, refresh_token } = params
  
  // 2. Set session with tokens
  const { data } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  })
  
  // 3. Profile is created by database trigger automatically
  
  // 4. Navigate to journal
  router.replace('/journal/DailyJournalScreen')
}
```

### Implicit Flow (Used for React Native)

**Implicit Flow** sends tokens directly in the callback URL:

1. Supabase → `lifeos://auth/callback?access_token=XXX&refresh_token=YYY`
2. App extracts tokens from URL parameters
3. App calls `supabase.auth.setSession({ access_token, refresh_token })`

**Why not PKCE?**
- PKCE requires storing a code verifier before OAuth starts
- React Native's WebBrowser opens in separate context
- Code verifier storage isn't accessible during callback
- Implicit flow is acceptable for mobile apps with deep links (tokens not exposed to other apps)

### 3. Profile Creation

Two mechanisms ensure user profiles are created:

#### Server-Side (Primary)
Database trigger in `005_profile_trigger.sql`:
- Automatically creates profile when user signs up
- Runs server-side, guaranteed execution
- Also initializes user credits

#### Client-Side (Fallback)
`ensureProfile()` function in `profiles.ts`:
- Checks if profile exists
- Creates profile if missing
- Handles edge cases where trigger didn't fire

```typescript
// profiles.ts
export async function ensureProfile(userId: string) {
  // Try to get existing profile
  let profile = await getProfile(userId)
  
  // Create if doesn't exist
  if (!profile) {
    profile = await createProfile(userId)
  }
  
  return profile
}
```

## Navigation Paths

### Expo Router Convention
File paths map to routes:

| File Path | Route |
|-----------|-------|
| `src/app/auth/SignInScreen.tsx` | `/auth/SignInScreen` |
| `src/app/auth/callback.tsx` | `/auth/callback` |
| `src/app/journal/DailyJournalScreen.tsx` | `/journal/DailyJournalScreen` |

### Deep Link Configuration
In `app.json`:
```json
{
  "scheme": "lifeos"
}
```

This allows the app to handle URLs like:
- `lifeos://auth/callback?access_token=...`

## Status Messages During OAuth

The callback screen shows different status messages:

1. **"Completing sign in..."** - Initial state
2. **"Authenticating..."** - Setting session with tokens
3. **"Setting up your profile..."** - Creating/verifying profile
4. **"Redirecting..."** - Navigating to journal

## Error Handling

### Common Errors and Solutions

**"Invalid redirect URL"**
- Cause: Redirect URL not in Supabase allowed list
- Solution: Add `lifeos://auth/callback` to Supabase Dashboard → Authentication → URL Configuration

**"Profile creation failed"**
- Cause: Database trigger or permissions issue
- Impact: User can still log in (non-blocking)
- Solution: Profile will be retried on next login

**"No session found"**
- Cause: Tokens not in callback URL
- Solution: Check Supabase OAuth configuration and redirect URL

## Database Schema

### Profiles Table
```sql
create table profiles (
  id uuid primary key references auth.users(id),
  created_at timestamptz default now(),
  timezone text,
  notification_enabled boolean default true
);
```

### Trigger Function
```sql
create function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, timezone, notification_enabled)
  values (new.id, 'UTC', true);
  return new;
end;
$$;
```

## Testing Checklist

- [ ] Configure Supabase redirect URLs
- [ ] Apply database migration `005_profile_trigger.sql`
- [ ] Test Google OAuth flow
- [ ] Verify profile is created for new users
- [ ] Verify existing users can log in
- [ ] Check navigation to journal screen
- [ ] Test error handling (cancel OAuth, network issues)

## Next Steps

1. **Apply the database migration:**
   ```bash
   # If using Supabase CLI
   supabase db push
   
   # Or apply manually in Supabase Dashboard → SQL Editor
   ```

2. **Configure Supabase redirect URLs** (see OAUTH_SETUP.md)

3. **Test the flow:**
   ```bash
   npx expo start -c
   ```

## Console Logs to Watch

When testing, look for these console logs:

```
🔐 Starting Google Sign-In...
📍 Redirect URL: lifeos://auth/callback
🌐 Opening OAuth URL...
✅ OAuth callback received: lifeos://auth/callback?access_token=...
🔍 URL has tokens: true
🚀 Navigating to callback screen...
📥 Callback params: { hasAccessToken: true, hasRefreshToken: true, hasError: false }
🔐 Setting session with tokens from callback
✅ Session established successfully
🚀 Redirecting to journal...
```

Any errors will be prefixed with ❌.
