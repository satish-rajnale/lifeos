# PKCE and RLS Fixes

## Issues Found

### 1. PKCE Code Verifier Missing Error
```
AuthPKCECodeVerifierMissingError: PKCE code verifier not found in storage.
```

**Root Cause:** 
- PKCE flow requires storing a "code verifier" before opening the OAuth browser
- When using `WebBrowser.openAuthSessionAsync()` in React Native, the browser opens in a separate context
- The code verifier stored in AsyncStorage isn't accessible during the OAuth callback
- This is a known limitation of PKCE with React Native's WebBrowser

**Solution:**
- Changed from PKCE flow to **Implicit flow**
- Implicit flow sends tokens directly in the callback URL (no code exchange needed)
- Better suited for React Native mobile apps

### 2. Profile RLS Policy Error
```
new row violates row-level security policy for table "profiles"
```

**Root Cause:**
- RLS (Row Level Security) was enabled on profiles table
- No policy existed to allow users to insert their own profiles
- Database trigger runs with `security definer` but needed proper configuration

**Solution:**
- Added INSERT policy: `"Enable insert for authenticated users"`
- Updated trigger function with `security definer set search_path = public`
- Added `on conflict do nothing` to handle race conditions
- Client-side profile creation now works as a fallback

## Changes Made

### 1. Supabase Client Configuration
**File:** `src/services/supabase/client.ts`

```typescript
// BEFORE
flowType: 'pkce'

// AFTER
flowType: 'implicit'
```

### 2. Callback Screen
**File:** `src/app/auth/callback.tsx`

- Removed PKCE code exchange logic
- Now handles implicit flow (direct tokens in URL)
- Simplified to just set session with tokens
- Removed client-side profile creation (handled by database trigger)

### 3. Database Migration
**File:** `supabase/migrations/005_profile_trigger.sql`

**Added:**
- INSERT policy for authenticated users
- `on conflict (id) do nothing` in trigger
- `set search_path = public` for security

### 4. Profile Service
**File:** `src/services/supabase/db/profiles.ts`

**Added:**
- Handle unique constraint violation (code 23505)
- If profile exists, fetch and return it
- Better error handling for race conditions

## OAuth Flow (Updated)

### Implicit Flow (Current)

```
1. User clicks "Continue with Google"
2. App opens Google OAuth in browser
3. User authenticates
4. Google → Supabase → App
5. Callback URL: lifeos://auth/callback?access_token=XXX&refresh_token=YYY
6. App extracts tokens from URL
7. App calls supabase.auth.setSession({ access_token, refresh_token })
8. Session established ✓
9. Database trigger creates profile automatically
10. User redirected to journal screen ✓
```

### Why Not PKCE for React Native?

PKCE is more secure for web apps, but has limitations in React Native:

| Aspect | PKCE Flow | Implicit Flow |
|--------|-----------|---------------|
| **Security** | More secure (code exchange) | Less secure (tokens in URL) |
| **RN Support** | ❌ Limited (storage issues) | ✅ Works well |
| **Complexity** | Higher (2-step process) | Lower (direct tokens) |
| **Best For** | Web apps, SSR frameworks | Mobile apps |

For production mobile apps, implicit flow is acceptable because:
- Deep links are only accessible to the app
- Tokens are short-lived
- OAuth happens in secure browser context
- Alternative is Universal Links (requires more setup)

## Testing Instructions

### 1. Apply Database Migration

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Copy entire contents of supabase/migrations/005_profile_trigger.sql
```

Or if using Supabase CLI:

```bash
supabase db push
```

### 2. Clear App Storage

The app might have cached the old PKCE attempt. Clear storage:

**iOS Simulator:**
```bash
# Delete and reinstall app
```

**Android:**
```bash
# Settings → Apps → LifeOS → Storage → Clear Data
```

**Or in code (temporary):**
```typescript
// Add to SignInScreen before OAuth
await AsyncStorage.clear()
```

### 3. Test OAuth Flow

```bash
npx expo start -c
```

**Expected console logs:**

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

## Verification Checklist

After testing, verify:

- [ ] No PKCE error
- [ ] No RLS policy error  
- [ ] User successfully authenticated
- [ ] Profile created in database (check Supabase Dashboard → Table Editor → profiles)
- [ ] Credits initialized (check usage_credits table)
- [ ] User redirected to journal screen
- [ ] Session persists on app restart

## Troubleshooting

### Still getting RLS errors?

Check that migration was applied:
```sql
-- Check if policies exist
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Should show 3 policies:
-- 1. Users can read own profile
-- 2. Users can update own profile
-- 3. Enable insert for authenticated users
```

### Tokens not in callback URL?

Check Supabase project settings:
- Authentication → Settings → Auth Flow
- Ensure "Implicit" is allowed (should be by default)

### Profile not created?

Check trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

If missing, re-run the migration.
