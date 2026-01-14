import { Redirect, SplashScreen } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'
import { supabase } from '../services/supabase/client'
import { useUserStore } from '../state/userStore'
import { THEME } from '../utils/constants'

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync()

export default function Index() {
    const { session, setSession, loading } = useUserStore()

    useEffect(() => {
        // Check for existing session on app startup (persisted in AsyncStorage)
        console.log('🔍 Checking for existing session...')
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                console.log('✅ Found existing session for user:', session.user.id)
                console.log('💾 JWT token loaded from AsyncStorage')
            } else {
                console.log('ℹ️ No existing session found')
            }
            setSession(session)
            SplashScreen.hideAsync()
        })

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔔 Auth state changed:', event)
            if (event === 'SIGNED_IN') {
                console.log('✅ User signed in:', session?.user?.id)
            } else if (event === 'SIGNED_OUT') {
                console.log('🚪 User signed out')
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('🔄 Token refreshed for user:', session?.user?.id)
            }
            setSession(session)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    if (loading) {
        return <View style={{ flex: 1, backgroundColor: THEME.colors.background }} />
    }

    if (!session) {
        return <Redirect href="/auth/SignInScreen" />
    }

    return <Redirect href="/journal/DailyJournalScreen" />
}
