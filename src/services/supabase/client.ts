import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import 'react-native-url-polyfill/auto'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://yokalllxfaixpfjjlkun.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_X9J633JLTseJN7gKHsxggA_qJS3t06q'

/**
 * Supabase Client with Persistent Authentication
 * 
 * Session Persistence:
 * - Uses AsyncStorage to persist JWT tokens across app restarts
 * - User stays logged in until they manually log out or clear app data
 * - Tokens are automatically refreshed before expiration
 * 
 * Security:
 * - Tokens are stored securely in device storage
 * - Auto-refresh keeps sessions alive without re-authentication
 * - AppState listener manages token refresh based on app activity
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage, // Persist tokens in AsyncStorage (secure, isolated per app)
        autoRefreshToken: true, // Auto-refresh tokens before expiration (keeps user logged in)
        persistSession: true, // Save session to storage (survives app restarts)
        detectSessionInUrl: false, // We handle OAuth tokens manually in callback
        flowType: 'implicit', // OAuth implicit flow for mobile (tokens in URL)
    },
})

/**
 * Manage token refresh based on app state
 * - Active: Enable auto-refresh to keep tokens fresh
 * - Background: Stop refresh to save battery/resources
 */
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        console.log('📱 App became active - enabling token auto-refresh')
        supabase.auth.startAutoRefresh()
    } else {
        console.log('💤 App went to background - stopping token auto-refresh')
        supabase.auth.stopAutoRefresh()
    }
})
