# Authentication Session Loading Fix

## Problem

Even though a valid JWT token was found in AsyncStorage and the session was loaded successfully, the user was immediately redirected to the login screen instead of the main app.

### Log Evidence
```
LOG  ✅ Found existing session for user: efd8221e-6b5b-4407-864b-fce1d581df98
LOG  💾 JWT token loaded from AsyncStorage
```
But user remained on login screen.

## Root Cause

**Race Condition in Session Loading**

1. `useUserStore` initialized with `loading: false` and `session: null`
2. Component `index.tsx` renders for the first time
3. Since `loading` is `false` and `session` is `null`, the component immediately redirects to `/auth/SignInScreen` (line 50-51)
4. **Meanwhile**, the async `supabase.auth.getSession()` call completes and finds the session
5. But the redirect has already happened - user is stuck on login screen

### The Issue in Code

**Before Fix:**

```typescript
// userStore.ts
export const useUserStore = create<UserState>((set, get) => ({
    session: null,
    user: null,
    profile: null,
    loading: false,  // ❌ Starts as false!
    // ...
}))

// index.tsx
export default function Index() {
    const { session, setSession, loading } = useUserStore()

    useEffect(() => {
        // This is async - takes time
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            SplashScreen.hideAsync()
        })
    }, [])

    if (loading) {  // ❌ Never true on first render!
        return <View style={{ flex: 1, backgroundColor: THEME.colors.background }} />
    }

    if (!session) {  // ✅ True on first render, redirects immediately
        return <Redirect href="/auth/SignInScreen" />
    }

    return <Redirect href="/journal/DailyJournalScreen" />
}
```

## Solution

### 1. Initialize `loading` to `true`
Start with `loading: true` in the user store to prevent premature redirects while the session is being checked.

```typescript
// userStore.ts
export const useUserStore = create<UserState>((set, get) => ({
    session: null,
    user: null,
    profile: null,
    loading: true,  // ✅ Start as true
    // ...
}))
```

### 2. Properly Handle Async Session Check
Convert to async/await pattern and explicitly set `loading: false` after the session check completes.

```typescript
// index.tsx
useEffect(() => {
    let isMounted = true
    
    const checkSession = async () => {
        try {
            console.log('🔍 Checking for existing session...')
            const { data: { session }, error } = await supabase.auth.getSession()
            
            if (!isMounted) return
            
            if (error) {
                console.error('❌ Error getting session:', error)
                setSession(null)
            } else if (session) {
                console.log('✅ Found existing session for user:', session.user.id)
                console.log('💾 JWT token loaded from AsyncStorage')
                setSession(session)
            } else {
                console.log('ℹ️ No existing session found')
                setSession(null)
            }
        } catch (error) {
            console.error('❌ Exception while getting session:', error)
            if (isMounted) setSession(null)
        } finally {
            if (isMounted) {
                // ✅ Set loading to false after session check completes
                useUserStore.setState({ loading: false })
                SplashScreen.hideAsync()
            }
        }
    }

    checkSession()

    // ... auth state change listener ...

    return () => {
        isMounted = false
        subscription.unsubscribe()
    }
}, [])
```

### 3. Render Logic
Now the render logic works correctly:

```typescript
if (loading) {  // ✅ True on first render - shows loading screen
    return <View style={{ flex: 1, backgroundColor: THEME.colors.background }} />
}

if (!session) {  // ✅ Only evaluated after loading completes
    return <Redirect href="/auth/SignInScreen" />
}

return <Redirect href="/journal/DailyJournalScreen" />  // ✅ Redirects here if session exists
```

## Benefits of the Fix

1. **Prevents Race Condition**: The app waits for session check to complete before deciding where to navigate
2. **Better Error Handling**: Uses try-catch to handle any exceptions during session retrieval
3. **Cleaner Async Flow**: Uses async/await instead of `.then()` for better readability
4. **Memory Leak Prevention**: Uses `isMounted` flag to prevent state updates after unmount
5. **Explicit State Management**: Explicitly sets `loading: false` when done

## Testing

After this fix, the flow should be:

1. App starts → Shows splash screen
2. `loading` is `true` → Shows loading view (blank screen with background color)
3. Session check completes → Finds existing session
4. `loading` set to `false` → Component re-renders
5. `session` exists → Redirects to `/journal/DailyJournalScreen` ✅

### Expected Logs
```
🔍 Checking for existing session...
✅ Found existing session for user: efd8221e-6b5b-4407-864b-fce1d581df98
💾 JWT token loaded from AsyncStorage
```
Then navigates to journal screen (not login screen).

## Additional Improvements Made

- Added error handling for `getSession()` failures
- Added `isMounted` flag to prevent React state updates on unmounted components
- Converted promise chain to async/await for better error handling
- Added explicit finally block to ensure loading state is always reset
