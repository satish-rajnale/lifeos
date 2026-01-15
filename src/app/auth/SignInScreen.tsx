import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { supabase } from '../../services/supabase/client'
import { useUserStore } from '../../state/userStore'
import { THEME } from '../../utils/constants'

// Required for OAuth flow to work on some platforms
WebBrowser.maybeCompleteAuthSession()

export default function SignInScreen() {
    const router = useRouter()
    const { session } = useUserStore()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [isGoogleLoading, setIsGoogleLoading] = useState(false)

    // Redirect to journal if user is already logged in
    useEffect(() => {
        if (session?.user) {
            console.log('👤 User already logged in, redirecting to journal...')
            router.replace('/journal/DailyJournalScreen')
        }
    }, [session])

    const getRedirectUrl = () => {
        const redirectUrl = 'lifeos://auth/callback';
        console.log('Generated redirect URL:', redirectUrl);
        return redirectUrl;
    }

    const handleSignIn = async () => {
        setLoading(true)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            Alert.alert('Error', error.message)
        } else if (data?.session) {
            // Log access token for testing edge functions
            console.log('\n🔑 ===== USER ACCESS TOKEN (for testing) =====')
            console.log(data.session.access_token)
            console.log('============================================\n')
            console.log('💡 Use this token to test edge functions:')
            console.log('   curl -X POST "https://your-project.supabase.co/functions/v1/generate-journal-tts" \\')
            console.log(`     -H "Authorization: Bearer ${data.session.access_token}" \\`)
            console.log('     -H "Content-Type: application/json" \\')
            console.log('     -d \'{"date":"2026-01-15"}\'')
            console.log('============================================\n')
        }
        setLoading(false)
    }

    const handleSignUp = async () => {
        setLoading(true)
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) Alert.alert('Error', error.message)
        else Alert.alert('Check your email for the login link!')
        setLoading(false)
    }

    const handleGoogleSignIn = async () => {
        try {
            setIsGoogleLoading(true)
            console.log('🔐 Starting Google Sign-In...')

            // Use the app's deep link URL for redirect
            const redirectUrl = getRedirectUrl()
            console.log('📍 Redirect URL:', redirectUrl)
            console.log('💡 Make sure this URL is added to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs')

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true, // We handle the browser ourselves
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            })

            if (error) {
                console.error('❌ Google OAuth error:', error);
                Alert.alert(
                    'Sign In Failed', 
                    error.message || 'Failed to sign in with Google. Check console for details.'
                );
                setIsGoogleLoading(false);
                return;
            }

            if (data?.url) {
                console.log('🌐 Opening OAuth URL...');
                // Open the OAuth URL in a browser
                // Supabase will handle the OAuth flow and redirect to our deep link
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

                console.log('📱 OAuth result type:', result.type);

                if (result.type === 'success') {
                    console.log('✅ OAuth callback received');
                    console.log('📋 Full URL:', result.url);
                    
                    // Extract URL to check for tokens or errors
                    if (result.url) {
                        try {
                            const url = new URL(result.url);
                            
                            // Check both query params and hash
                            const hasTokensInQuery = url.searchParams.has('access_token');
                            const hasTokensInHash = url.hash.includes('access_token');
                            const hasError = url.searchParams.has('error') || url.searchParams.has('error_description');
                            
                            console.log('🔍 URL breakdown:');
                            console.log('  - Protocol + Host:', url.protocol + '//' + url.host);
                            console.log('  - Path:', url.pathname);
                            console.log('  - Query params:', url.search);
                            console.log('  - Hash:', url.hash);
                            console.log('  - Has tokens in query:', hasTokensInQuery);
                            console.log('  - Has tokens in hash:', hasTokensInHash);
                            console.log('  - Has error:', hasError);
                            
                            if (hasError) {
                                const errorDesc = url.searchParams.get('error_description') || 'Unknown error';
                                Alert.alert('Authentication Error', errorDesc);
                                setIsGoogleLoading(false);
                                return;
                            }
                            
                            // Extract tokens from URL and pass them as route params
                            let access_token = url.searchParams.get('access_token');
                            let refresh_token = url.searchParams.get('refresh_token');
                            
                            // If not in query, check hash
                            if (!access_token && url.hash) {
                                const hashParams = new URLSearchParams(url.hash.substring(1));
                                access_token = hashParams.get('access_token');
                                refresh_token = hashParams.get('refresh_token');
                            }
                            
                            if (access_token && refresh_token) {
                                console.log('🔑 Tokens extracted, navigating with params...');
                                setIsGoogleLoading(false);
                                router.replace({
                                    pathname: '/auth/callback',
                                    params: { access_token, refresh_token }
                                });
                                return;
                            }
                        } catch (urlError) {
                            console.error('❌ Error parsing URL:', urlError);
                        }
                    }
                    
                    // Fallback: Navigate without params and let callback try to extract
                    console.log('🚀 Navigating to callback screen (no tokens extracted)...');
                    setIsGoogleLoading(false);
                    router.replace('/auth/callback');
                } else if (result.type === 'cancel') {
                    console.log('⚠️ User cancelled Google sign-in');
                    setIsGoogleLoading(false);
                } else if (result.type === 'dismiss') {
                    console.log('⚠️ OAuth session dismissed');
                    setIsGoogleLoading(false);
                } else {
                    console.log('⚠️ Unexpected result type:', result.type);
                    setIsGoogleLoading(false);
                }
            } else {
                console.error('❌ No OAuth URL received from Supabase');
                Alert.alert('Error', 'Failed to initialize Google sign-in');
                setIsGoogleLoading(false);
            }
        } catch (error: any) {
            console.error('❌ Google Sign-In exception:', error);
            Alert.alert('Error', error.message || 'An unexpected error occurred');
            setIsGoogleLoading(false);
        }
    }

    const isAnyLoading = loading || isGoogleLoading

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome Back</Text>

            <View style={styles.form}>
                <TextInput
                    placeholder="Email"
                    placeholderTextColor={THEME.colors.textSecondary}
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    editable={!isAnyLoading}
                />
                <TextInput
                    placeholder="Password"
                    placeholderTextColor={THEME.colors.textSecondary}
                    style={styles.input}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    editable={!isAnyLoading}
                />

                <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={isAnyLoading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
                </TouchableOpacity>

                <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.line} />
                </View>

                <TouchableOpacity
                    style={[styles.button, styles.googleButton]}
                    onPress={handleGoogleSignIn}
                    disabled={isAnyLoading}
                >
                    {isGoogleLoading ? (
                        <ActivityIndicator color="#3c4043" />
                    ) : (
                        <Text style={styles.googleButtonText}>Continue with Google</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleSignUp} disabled={isAnyLoading} style={{ marginTop: 20 }}>
                    <Text style={styles.link}>Create Account</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.colors.background,
        justifyContent: 'center',
        padding: THEME.spacing.xl,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: THEME.colors.text,
        marginBottom: 40,
        textAlign: 'center',
    },
    form: {
        gap: 16,
    },
    input: {
        backgroundColor: THEME.colors.card,
        borderRadius: THEME.borderRadius.md,
        padding: THEME.spacing.md,
        fontSize: 16,
        color: THEME.colors.text,
        borderWidth: 1,
        borderColor: THEME.colors.border,
    },
    button: {
        backgroundColor: THEME.colors.primary,
        padding: THEME.spacing.md,
        borderRadius: THEME.borderRadius.md,
        alignItems: 'center',
        marginTop: 10,
        height: 52,
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    googleButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#dadce0',
    },
    googleButtonText: {
        color: '#3c4043',
        fontWeight: 'bold',
        fontSize: 16,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: THEME.colors.border,
    },
    dividerText: {
        color: THEME.colors.textSecondary,
        paddingHorizontal: 10,
        fontSize: 14,
    },
    link: {
        color: THEME.colors.accent,
        textAlign: 'center',
    }
})
