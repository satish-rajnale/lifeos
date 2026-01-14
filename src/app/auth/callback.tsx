import * as Linking from 'expo-linking'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { supabase } from '../../services/supabase/client'
import { ensureProfile } from '../../services/supabase/db/profiles'
import { THEME } from '../../utils/constants'

export default function AuthCallback() {
    const router = useRouter()
    const params = useLocalSearchParams()
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState('Completing sign in...')
    const [isProcessing, setIsProcessing] = useState(false)

    useEffect(() => {
        // Prevent multiple executions
        if (isProcessing) {
            console.log('⚠️ Already processing callback, skipping...')
            return
        }

        const handleCallback = async () => {
            setIsProcessing(true)
            try {
                console.log('📥 Auth callback received')
                console.log('📝 Route params:', params)

                // Check for error in URL params
                if (params.error) {
                    const error = params.error as string
                    const errorDescription = params.error_description as string || ''
                    console.error('❌ Auth callback error:', error, errorDescription)
                    setErrorMessage(errorDescription || error)
                    setTimeout(() => router.replace('/auth/SignInScreen'), 3000)
                    return
                }

                // Try to get tokens from route params first
                let access_token = params.access_token as string
                let refresh_token = params.refresh_token as string
                
                // If not in params, try to get the initial URL that opened the app
                if (!access_token) {
                    console.log('🔍 Tokens not in params, checking initial URL...')
                    const url = await Linking.getInitialURL()
                    console.log('🔗 Initial URL:', url)
                    
                    if (url) {
                        try {
                            const parsedUrl = new URL(url)
                            
                            // Try query params
                            access_token = parsedUrl.searchParams.get('access_token') || ''
                            refresh_token = parsedUrl.searchParams.get('refresh_token') || ''
                            
                            // Try hash fragment
                            if (!access_token && parsedUrl.hash) {
                                const hashParams = new URLSearchParams(parsedUrl.hash.substring(1))
                                access_token = hashParams.get('access_token') || ''
                                refresh_token = hashParams.get('refresh_token') || ''
                            }
                            
                            console.log('🔍 Extracted from URL:', {
                                hasAccessToken: !!access_token,
                                hasRefreshToken: !!refresh_token
                            })
                        } catch (urlError) {
                            console.error('❌ Error parsing URL:', urlError)
                        }
                    }
                }

                if (access_token && refresh_token) {
                    console.log('🔐 Setting session with OAuth tokens...')
                    setStatusMessage('Authenticating...')
                    
                    const { data, error } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    })

                    if (error) {
                        console.error('❌ Error setting session:', error)
                        setErrorMessage(error.message)
                        setTimeout(() => router.replace('/auth/SignInScreen'), 3000)
                        return
                    }

                    if (data?.session?.user) {
                        console.log('✅ Session established successfully:', data.session.user.id)
                        console.log('💾 Session persisted to AsyncStorage')
                        await handleOAuthSuccess(data.session.user)
                        return
                    }
                }

                // Fallback: Check if session already exists
                console.log('⏳ Checking for existing session...')
                const { data: { session } } = await supabase.auth.getSession()
                
                if (session?.user) {
                    console.log('✅ Found existing session for user:', session.user.id)
                    await handleOAuthSuccess(session.user)
                    return
                }

                // No tokens and no session - configuration issue
                console.error('❌ No tokens found in callback')
                console.error('💡 Route params:', params)
                console.error('💡 Possible causes:')
                console.error('   1. Redirect URL not configured in Supabase')
                console.error('   2. Implicit flow not enabled in Supabase')
                console.error('   3. Wrong redirect URL format')
                setErrorMessage('Authentication failed. Please check Supabase configuration.')
                setTimeout(() => router.replace('/auth/SignInScreen'), 3000)
            } catch (error: any) {
                console.error('❌ Callback exception:', error)
                setErrorMessage(error.message || 'An unexpected error occurred')
                setTimeout(() => router.replace('/auth/SignInScreen'), 3000)
            }
        }

        handleCallback()
    }, []) // Run only once on mount

    const handleOAuthSuccess = async (user: any) => {
        // Prevent multiple profile creations/navigations
        if (isProcessing) {
            console.log('⚠️ Already handling OAuth success, skipping...')
            return
        }

        try {
            console.log('👤 Handling OAuth success for user:', user.id)
            console.log('   Email:', user.email)
            console.log('   Provider:', user.app_metadata?.provider)
            
            setStatusMessage('Setting up your profile...')

            // Try to ensure profile exists, but don't block login if it fails
            // The database trigger should have already created it
            try {
                const profile = await ensureProfile(user.id)
                console.log('✅ Profile ready:', profile?.id)
            } catch (profileError: any) {
                console.error('⚠️ Profile setup error (non-blocking):', profileError.message)
                // Continue anyway - profile might already exist or trigger will create it
            }

            setStatusMessage('Success! Redirecting...')
            console.log('🚀 Login successful, redirecting to journal...')
            
            // Navigate to journal screen (use replace to prevent back navigation)
            router.replace('/journal/DailyJournalScreen')
        } catch (error: any) {
            console.error('❌ OAuth success handler error:', error)
            // Even if profile setup fails, navigate anyway
            router.replace('/journal/DailyJournalScreen')
        }
    }

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text style={styles.text}>
                {errorMessage ? `Error: ${errorMessage}` : statusMessage}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    text: {
        color: THEME.colors.text,
        fontSize: 16,
    },
})
