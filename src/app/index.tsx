import { Redirect, SplashScreen } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { supabase } from '../services/supabase/client'
import { useUserStore } from '../state/userStore'
import { THEME } from '../utils/constants'

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync()

export default function Index() {
    const { session, setSession } = useUserStore()
    const [isCheckingSession, setIsCheckingSession] = useState(true)

    useEffect(() => {
        /**
         * Session Persistence Check
         * 
         * This runs ONCE on app startup:
         * 1. Checks AsyncStorage for existing JWT tokens
         * 2. If found, automatically restores the session (user stays logged in)
         * 3. If not found, redirects to sign-in screen
         * 
         * User will NOT need to log in again unless:
         * - They manually log out
         * - They clear app data
         * - Token expires and can't be refreshed (very rare)
         */
        console.log('🚀 App starting - checking for persisted session...')
        console.log('💾 Looking in AsyncStorage for JWT tokens...')
        
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                console.log('✅ Session restored from storage!')
                console.log('👤 User ID:', session.user.id)
                console.log('📧 Email:', session.user.email)
                console.log('⏰ Token expires:', new Date(session.expires_at! * 1000).toLocaleString())
                console.log('🎉 User is automatically logged in - no need to sign in again!')
                
                // Log access token for edge function testing
                console.log('\n🔑 ===== USER ACCESS TOKEN (for testing) =====')
                console.log(session.access_token)
                console.log('💡 Token loaded from AsyncStorage (persisted from previous login)')
                console.log('============================================\n')
            } else {
                console.log('ℹ️ No existing session found in storage')
                console.log('🔓 User needs to sign in')
            }
            
            setSession(session)
            setIsCheckingSession(false)
            SplashScreen.hideAsync()
        })

        /**
         * Auth State Change Listener
         * 
         * Listens for:
         * - SIGNED_IN: User just logged in (saves to AsyncStorage)
         * - SIGNED_OUT: User logged out (clears AsyncStorage)
         * - TOKEN_REFRESHED: Token auto-refreshed (updates AsyncStorage)
         * - USER_UPDATED: User profile changed
         */
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔔 Auth state changed:', event)
            
            if (event === 'SIGNED_IN') {
                console.log('✅ User signed in:', session?.user?.id)
                console.log('💾 Session saved to AsyncStorage (will persist across restarts)')
            } else if (event === 'SIGNED_OUT') {
                console.log('🚪 User signed out')
                console.log('🗑️ Session cleared from AsyncStorage')
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('🔄 Token auto-refreshed for user:', session?.user?.id)
                console.log('💾 Updated token saved to AsyncStorage')
            } else if (event === 'USER_UPDATED') {
                console.log('👤 User profile updated:', session?.user?.id)
            }
            
            setSession(session)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    // Show loading screen while checking for session
    if (isCheckingSession) {
        return <View style={{ flex: 1, backgroundColor: THEME.colors.background }} />
    }

    // If no session, redirect to sign-in
    if (!session) {
        console.log('🔀 Redirecting to sign-in screen...')
        return <Redirect href="/auth/SignInScreen" />
    }

    // If session exists, redirect to journal
    console.log('🔀 Redirecting to journal screen...')
    return <Redirect href="/journal/DailyJournalScreen" />
}
