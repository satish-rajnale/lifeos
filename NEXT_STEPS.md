# Next Steps - OAuth Fix

## Critical Step 1: Configure Supabase Redirect URLs

**You MUST add these URLs to Supabase:**

1. Go to [Supabase Dashboard](https://app.supabase.com/project/yokalllxfaixpfjjlkun)
2. Navigate to **Authentication** → **URL Configuration**
3. Under **Redirect URLs**, add these (one per line):

```
lifeos://auth/callback
lifeos://--/auth/callback
exp://192.168.1.1:8081/--/auth/callback
exp://localhost:8081/--/auth/callback
```

**Replace `192.168.1.1` with your actual local IP** (shown in terminal when you run `npx expo start`)

4. Click **Save**

## Critical Step 2: Apply Database Migration

**Run this SQL in your Supabase database:**

1. Go to [Supabase Dashboard](https://app.supabase.com/project/yokalllxfaixpfjjlkun)
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `supabase/migrations/005_profile_trigger.sql`
5. Click **Run**

**What this does:**
- Enables RLS on profiles table
- Adds INSERT policy so users can create their own profiles
- Creates database trigger to auto-create profiles on signup
- Creates credits trigger to initialize user credits

## Then: Clear App Storage

The app might have cached the old PKCE attempt:

**Option 1: Delete and reinstall app (recommended)**

**Option 2: Clear storage programmatically**
- Add this temporarily to SignInScreen before testing:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

// In handleGoogleSignIn, before the OAuth call:
await AsyncStorage.clear()
```

## Finally: Test OAuth

```bash
npx expo start -c
```

Try signing in with Google. You should see:

```
✅ OAuth callback received: lifeos://auth/callback?access_token=...
🔍 URL has tokens: true
📥 Callback params: { hasAccessToken: true, hasRefreshToken: true, hasError: false }
🔐 Setting session with tokens from callback
✅ Session established successfully
🚀 Redirecting to journal...
```

## What Changed?

### ✅ Fixed Issues:
1. **PKCE Error** - Changed from PKCE to Implicit flow (better for React Native)
2. **RLS Policy Error** - Added INSERT policy for profiles table
3. **Profile Creation** - Now handled by database trigger (more reliable)

### 📝 Files Modified:
- `src/services/supabase/client.ts` - Changed to implicit flow
- `src/app/auth/callback.tsx` - Simplified token handling
- `supabase/migrations/005_profile_trigger.sql` - Added INSERT policy
- `src/services/supabase/db/profiles.ts` - Better error handling

## Verification

After successful login, verify in Supabase Dashboard:

1. **Table Editor → profiles**
   - Your user ID should appear
   - `timezone` and `notification_enabled` populated

2. **Table Editor → usage_credits**
   - Your user ID should appear
   - `total_credits` = 50
   - `credits_used` = 0

## If OAuth Still Failing (No Tokens)

**See `OAUTH_TROUBLESHOOTING.md` for detailed guide**

Common issues:
- **Redirect URL mismatch** → Check logs for exact URL, add to Supabase
- **Tokens not in callback** → Check Supabase OAuth settings, enable implicit grant
- Migration not applied → Re-run SQL
- Storage not cleared → Delete and reinstall app

The updated callback now:
- ✅ Checks both query params AND hash fragments
- ✅ Uses multiple methods to extract tokens
- ✅ Falls back to Supabase session detection
- ✅ Provides detailed logging for debugging
