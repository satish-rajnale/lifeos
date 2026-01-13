# OAuth Token Missing - Troubleshooting Guide

## Issue
Callback screen shows:
```
📥 Callback params: {"hasAccessToken": false, "hasError": false, "hasRefreshToken": false}
⚠️ No tokens found in callback
❌ No session found
```

## Root Cause
OAuth tokens are not being included in the callback URL. This happens when:

1. **Redirect URL mismatch** - Supabase doesn't recognize the redirect URL
2. **Wrong OAuth flow configured** - Implicit flow settings incorrect
3. **Supabase not sending tokens** - OAuth configuration issue

## Fixes to Apply

### 1. Configure Supabase Redirect URLs (CRITICAL)

Go to [Supabase Dashboard](https://app.supabase.com/project/yokalllxfaixpfjjlkun) → **Authentication** → **URL Configuration**

Add **ALL** of these redirect URLs:

```
lifeos://auth/callback
lifeos://--/auth/callback
exp://192.168.1.1:8081/--/auth/callback
exp://localhost:8081/--/auth/callback
```

**Replace** `192.168.1.1` with your actual local IP address (check terminal output from `npx expo start`).

**Why multiple URLs?**
- `lifeos://` - Production deep link
- `lifeos://--/auth/callback` - Expo Router format
- `exp://192.168.1.1:8081/...` - Expo development server
- `exp://localhost:8081/...` - Local development

### 2. Check OAuth Flow Settings

In Supabase Dashboard → **Authentication** → **Settings**:

**Enable these:**
- ✅ Enable OAuth
- ✅ Enable implicit grant (for mobile apps)

**OAuth Settings:**
- Response Type: `token` or `id_token token` (NOT `code`)
- Grant Type: `implicit`

### 3. Test the OAuth URL Format

The OAuth callback URL should look like ONE of these:

**✅ GOOD - Tokens in query:**
```
lifeos://auth/callback?access_token=eyJhb...&refresh_token=v1.5pL...&expires_in=3600
```

**✅ GOOD - Tokens in hash:**
```
lifeos://auth/callback#access_token=eyJhb...&refresh_token=v1.5pL...&expires_in=3600
```

**❌ BAD - No tokens:**
```
lifeos://auth/callback
```

**❌ BAD - Authorization code:**
```
lifeos://auth/callback?code=abc123...
```
(This is PKCE flow, which we don't use)

## Debugging Steps

### Step 1: Check What URL You're Getting

After OAuth, check the console logs:

```
✅ OAuth callback received
📋 Full URL: [THE ACTUAL URL]
🔍 URL breakdown:
  - Protocol + Host: lifeos://
  - Path: /auth/callback
  - Query params: ?...
  - Hash: #...
  - Has tokens in query: true/false
  - Has tokens in hash: true/false
```

**Look for:**
- Is `access_token` present?
- Is it in query params (`?access_token=...`) or hash (`#access_token=...`)?

### Step 2: Check Supabase Redirect URL Match

The redirect URL in Supabase **MUST EXACTLY MATCH** the one your app is using.

**To find your app's redirect URL:**
```typescript
// In SignInScreen, look for this log:
📍 Redirect URL: lifeos://auth/callback
```

**Copy that EXACT URL** and add it to Supabase.

### Step 3: Test OAuth Flow Manually

1. Get the OAuth URL from logs:
```
🌐 Opening OAuth URL: https://yokalllxfaixpfjjlkun.supabase.co/auth/v1/authorize?...
```

2. Copy the URL and open it in a browser
3. Complete Google authentication
4. See where it redirects - does the URL have tokens?

### Step 4: Verify Supabase Configuration

Run this in Supabase SQL Editor to check settings:

```sql
-- Check auth settings
SELECT * FROM auth.config;

-- Check if Google OAuth is enabled
SELECT * FROM auth.providers WHERE name = 'google';
```

## Common Issues and Solutions

### Issue: "Redirect URL not allowed"

**Symptom:** Supabase shows error page after OAuth

**Fix:**
1. Go to Supabase → Authentication → URL Configuration
2. Add your redirect URL EXACTLY as shown in app logs
3. Save and test again

### Issue: Tokens in wrong format

**Symptom:** URL has `code=...` instead of `access_token=...`

**Fix:**
1. Check Supabase auth settings
2. Ensure "Enable implicit grant" is ON
3. Set response_type to "token" not "code"

### Issue: Empty callback URL

**Symptom:** Callback URL is just `lifeos://auth/callback` with nothing after

**Fix:**
1. Redirect URL might not be recognized by Supabase
2. Check for typos in Supabase configuration
3. Ensure you're using the correct project URL

### Issue: WebBrowser not returning URL

**Symptom:** OAuth completes but no URL in `result.url`

**Fix:**
1. Check if WebBrowser is configured properly:
```typescript
import * as WebBrowser from 'expo-web-browser'

// Add this at top of SignInScreen
WebBrowser.maybeCompleteAuthSession()
```

2. Ensure redirect URL scheme matches `app.json`:
```json
{
  "expo": {
    "scheme": "lifeos"  // ← Must match!
  }
}
```

## Updated Code Changes

The callback now:
1. ✅ Checks query parameters
2. ✅ Checks hash fragments
3. ✅ Uses `Linking.getInitialURL()` to get full URL
4. ✅ Parses both `?` and `#` formats
5. ✅ Falls back to Supabase session detection
6. ✅ Provides detailed logging

## Test Again

After applying fixes:

```bash
# Clear cache
npx expo start -c
```

**Expected logs:**
```
🔐 Starting Google Sign-In...
📍 Redirect URL: lifeos://auth/callback
🌐 Opening OAuth URL...
✅ OAuth callback received
📋 Full URL: lifeos://auth/callback#access_token=eyJ...
🔍 URL breakdown:
  - Has tokens in hash: true
🚀 Navigating to callback screen...
📥 URL params received: {...}
🔍 Hash fragment: access_token=eyJ...&refresh_token=...
📥 Parsed tokens: { hasAccessToken: true, hasRefreshToken: true }
🔐 Setting session with tokens from callback
✅ Session established successfully
🚀 Redirecting to journal...
```

## Still Not Working?

If you're still getting no tokens:

1. **Double-check Supabase redirect URLs** - This is the #1 cause
2. **Try adding Site URL** in Supabase:
   - Go to Authentication → URL Configuration
   - Add Site URL: `http://localhost:8081`
3. **Check Google OAuth credentials** in Google Cloud Console:
   - Authorized redirect URIs should include Supabase's OAuth callback
4. **Contact Supabase support** if tokens still don't appear

## Quick Checklist

- [ ] Applied migration `005_profile_trigger.sql`
- [ ] Added `lifeos://auth/callback` to Supabase redirect URLs
- [ ] Added `exp://[YOUR-IP]:8081/--/auth/callback` to redirect URLs
- [ ] Enabled implicit OAuth grant in Supabase
- [ ] Cleared app cache and restarted
- [ ] Checked logs for actual redirect URL
- [ ] Verified redirect URL matches Supabase exactly

## Next Steps

With the updated code:
1. OAuth URL will be logged in full detail
2. Callback will try multiple methods to extract tokens
3. Falls back to Supabase session detection
4. Provides clear error messages if it still fails

The logs will tell us exactly what's happening and where to fix it!
