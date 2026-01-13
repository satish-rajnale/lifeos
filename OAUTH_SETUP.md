# OAuth Setup Guide for LifeOS

## Issue
After Google authentication, Supabase doesn't redirect back to the local development app and shows "requested path is invalid" message.

## Solution

### 1. Configure Supabase Redirect URLs

You need to add your app's deep link URL to Supabase's allowed redirect URLs:

1. Go to your Supabase Dashboard: https://app.supabase.com/project/yokalllxfaixpfjjlkun
2. Navigate to **Authentication** → **URL Configuration**
3. Under **Redirect URLs**, add the following URLs:

   **For Development:**
   ```
   lifeos://auth/callback
   exp://192.168.1.*:8081/--/auth/callback
   ```
   
   **For Production (when published):**
   ```
   lifeos://auth/callback
   com.lifeos.app://auth/callback
   ```

4. Click **Save**

> **Note:** The `exp://` URL is for Expo Go during development. Replace `192.168.1.*` with your actual local IP address, or use a wildcard pattern if your Supabase plan supports it.

### 2. Find Your Local IP Address

To get the correct redirect URL for Expo development:

```bash
# On macOS/Linux
ipconfig getifaddr en0

# Or check your Expo dev server output
# It shows something like: exp://192.168.1.100:8081
```

### 3. Test the OAuth Flow

After updating Supabase:

1. Restart your Expo development server:
   ```bash
   npx expo start -c
   ```

2. Clear your app's data (if needed):
   - On iOS: Delete and reinstall the app
   - On Android: Long press app → App info → Storage → Clear data

3. Try Google Sign-In again

### 4. Debugging

If you still encounter issues, check the console logs for:

```
Starting Google Sign-In...
Redirect URL: lifeos://auth/callback
Opening OAuth URL: [Supabase OAuth URL]
OAuth callback received: [callback URL with tokens]
```

The callback URL should contain `access_token` and `refresh_token` parameters (implicit flow).

### 5. Common Issues

**Issue:** "Invalid redirect URL" error
- **Solution:** Ensure the exact redirect URL is added to Supabase (case-sensitive)

**Issue:** OAuth popup closes but nothing happens
- **Solution:** Check that `app.json` has the correct scheme: `"scheme": "lifeos"`

**Issue:** "Session not found" after successful auth
- **Solution:** The callback screen now properly extracts tokens from the URL and sets the session

## What Was Fixed in the Code

1. **Updated `/src/app/auth/callback.tsx`:**
   - Now extracts `access_token` and `refresh_token` from URL parameters
   - Manually calls `supabase.auth.setSession()` with the tokens
   - **Ensures user profile exists** using `ensureProfile()` function
   - Creates profile for new users automatically
   - Added status messages and error handling

2. **Created `/src/services/supabase/db/profiles.ts`:**
   - Profile management service with functions:
     - `getProfile()` - Fetch existing profile
     - `createProfile()` - Create new profile with timezone detection
     - `ensureProfile()` - Get or create profile (handles new users)
     - `updateProfile()` - Update profile data

3. **Updated `/src/services/supabase/client.ts`:**
   - Added `flowType: 'implicit'` for React Native compatibility

4. **Added `/supabase/migrations/005_profile_trigger.sql`:**
   - Database trigger to automatically create profiles on user signup
   - RLS policies for profile security (including INSERT policy)
   - Automatic credits initialization for new users
   - Handles race conditions with `on conflict do nothing`

5. **Complete OAuth Flow (Implicit):**
   - SignInScreen → Opens Google OAuth in browser
   - Google authenticates user
   - Supabase processes OAuth and redirects to `lifeos://auth/callback?access_token=XXX&refresh_token=YYY`
   - App catches deep link and Expo Router navigates to callback screen
   - Callback screen:
     - Extracts tokens from URL
     - Creates session with `setSession()`
     - Database trigger automatically creates profile
     - Redirects to DailyJournalScreen
   - User can now use the app!
   
   **Note:** Implicit flow is used instead of PKCE because React Native's WebBrowser doesn't support the PKCE code verifier storage pattern. This is acceptable for mobile apps where deep links are only accessible to the app.

## Testing Checklist

- [ ] Added redirect URLs to Supabase dashboard
- [ ] Restarted Expo development server
- [ ] Cleared app data (if needed)
- [ ] Tested Google Sign-In flow
- [ ] Verified user is redirected to journal screen after auth
- [ ] Checked that session persists on app restart
