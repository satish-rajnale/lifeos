import { Battery, BookOpen, Brain, Mic, Zap } from 'lucide-react-native'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Platform, PermissionsAndroid, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCreditStore } from '../../state/creditStore'
import { useJournalStore } from '../../state/journalStore'
import { THEME } from '../../utils/constants'
import { VoiceCaptureModal } from '../voice/VoiceCaptureModal'

const getTodayDate = () => new Date().toISOString().split('T')[0]

export default function DailyJournalScreen() {
    const insets = useSafeAreaInsets()
    const date = getTodayDate()

    const { currentEntry, loading, fetchJournal, createJournal, creating } = useJournalStore()
    const { credits, fetchCredits } = useCreditStore()

    const [modalVisible, setModalVisible] = useState(false)
    const [hasPermissions, setHasPermissions] = useState(false)
    const [permissionsChecked, setPermissionsChecked] = useState(false)

    useEffect(() => {
        // Only run once on mount
        if (permissionsChecked) return
        
        setPermissionsChecked(true)
        fetchJournal(date)
        fetchCredits()
        requestPermissions()
    }, [])

    const requestPermissions = async () => {
        try {
            console.log('🎤 Requesting microphone permissions...')
            
            if (Platform.OS === 'android') {
                // Android: Request RECORD_AUDIO permission
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    {
                        title: 'Microphone Permission',
                        message: 'LifeOS needs microphone access to record your daily reflections.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                )
                
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    console.log('✅ Microphone permission granted')
                    setHasPermissions(true)
                } else {
                    console.log('❌ Microphone permission denied')
                    setHasPermissions(false)
                }
            } else {
                // iOS: Permissions are requested by the native module on first use
                // Set to true and let the native module handle it
                setHasPermissions(true)
            }
        } catch (error) {
            console.error('❌ Error requesting permissions:', error)
            // On iOS, assume we can try (native module will handle rejection)
            if (Platform.OS === 'ios') {
                setHasPermissions(true)
            }
        }
    }

    const openSettings = () => {
        if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:')
        } else {
            Linking.openSettings()
        }
    }

    const handleOpenVoiceModal = () => {
        if (Platform.OS === 'android' && !hasPermissions) {
            Alert.alert(
                'Microphone Permission Required',
                'Please grant microphone access to record your reflections.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Grant Access', onPress: requestPermissions },
                    { text: 'Open Settings', onPress: openSettings }
                ]
            )
            return
        }
        setModalVisible(true)
    }

    const handleCapture = async (text: string) => {
        if (credits <= 0) {
            Alert.alert("No Credits", "You have used your daily journal credit.")
            return
        }
        const success = await createJournal(text, date)
        if (!success) {
            Alert.alert("Error", "Failed to create journal.")
        }
    }

    // Derived UI
    const hasEntry = !!currentEntry

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Good Evening</Text>
                    <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
                </View>
                <View style={styles.creditBadge}>
                    <Zap size={14} color={THEME.colors.accent} fill={credits > 0 ? THEME.colors.accent : 'transparent'} />
                    <Text style={styles.creditText}>{credits} Credits</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { fetchJournal(date); fetchCredits(); }} tintColor={THEME.colors.primary} />}
            >
                {!hasEntry && !loading && (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconCircle}>
                            <BookOpen size={48} color={THEME.colors.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>Your page is empty</Text>
                        <Text style={styles.emptySubtitle}>Reflect on your day to clear your mind.</Text>

                        <TouchableOpacity style={styles.ctaButton} onPress={handleOpenVoiceModal}>
                            <Mic size={24} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.ctaText}>Record Reflection</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {hasEntry && (
                    <View style={styles.journalCard}>
                        <View style={styles.summarySection}>
                            <Text style={styles.sectionTitle}>Summary</Text>
                            <Text style={styles.summaryText}>{currentEntry.day_summary}</Text>
                        </View>

                        <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                                <Battery size={16} color={THEME.colors.textSecondary} />
                                <Text style={styles.metaText}>{currentEntry.energy_level} Energy</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Brain size={16} color={THEME.colors.textSecondary} />
                                <Text style={styles.metaText}>{currentEntry.emotional_tone}</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Highlights</Text>
                            {currentEntry.what_was_done.map((item: string, i: number) => (
                                <View key={i} style={styles.bulletItem}>
                                    <View style={styles.bulletDot} />
                                    <Text style={styles.bulletText}>{item}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Reflection</Text>
                            <Text style={styles.reflectionText}>{currentEntry.reflection}</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            <VoiceCaptureModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onCapture={handleCapture}
            />

            {creating && (
                <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color={THEME.colors.primary} />
                    <Text style={styles.loaderText}>Summarizing your day...</Text>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.colors.background,
    },
    header: {
        paddingHorizontal: THEME.spacing.md,
        paddingVertical: THEME.spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    greeting: {
        color: THEME.colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    date: {
        color: THEME.colors.text,
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 4,
    },
    creditBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: THEME.borderRadius.full,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    creditText: {
        color: THEME.colors.accent,
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    scrollContent: {
        padding: THEME.spacing.md,
        flexGrow: 1,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 60,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: THEME.spacing.lg,
    },
    emptyTitle: {
        color: THEME.colors.text,
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: THEME.spacing.xs,
    },
    emptySubtitle: {
        color: THEME.colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        maxWidth: '70%',
        marginBottom: THEME.spacing.xl,
    },
    ctaButton: {
        flexDirection: 'row',
        backgroundColor: THEME.colors.primary,
        paddingHorizontal: THEME.spacing.xl,
        paddingVertical: THEME.spacing.md,
        borderRadius: THEME.borderRadius.full,
        alignItems: 'center',
        shadowColor: THEME.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    ctaText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    journalCard: {
        backgroundColor: THEME.colors.card,
        borderRadius: THEME.borderRadius.lg,
        padding: THEME.spacing.lg,
        borderWidth: 1,
        borderColor: THEME.colors.border,
    },
    summarySection: {
        marginBottom: THEME.spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        paddingBottom: THEME.spacing.md,
    },
    sectionTitle: {
        color: THEME.colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: THEME.spacing.sm,
        letterSpacing: 1,
    },
    summaryText: {
        color: THEME.colors.text,
        fontSize: 18,
        lineHeight: 28,
    },
    metaRow: {
        flexDirection: 'row',
        marginBottom: THEME.spacing.lg,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: THEME.spacing.lg,
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: THEME.borderRadius.sm,
    },
    metaText: {
        color: THEME.colors.textSecondary,
        fontSize: 13,
        marginLeft: 6,
        textTransform: 'capitalize',
    },
    section: {
        marginBottom: THEME.spacing.lg,
    },
    bulletItem: {
        flexDirection: 'row',
        marginBottom: 8,
        paddingRight: 10,
    },
    bulletDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: THEME.colors.accent,
        marginTop: 8,
        marginRight: 12,
    },
    bulletText: {
        color: THEME.colors.text,
        fontSize: 16,
        lineHeight: 24,
        flex: 1,
    },
    reflectionText: {
        color: THEME.colors.text,
        fontSize: 16,
        fontStyle: 'italic',
        lineHeight: 26,
        opacity: 0.9,
    },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    loaderText: {
        color: THEME.colors.text,
        marginTop: THEME.spacing.md,
        fontSize: 16,
    }
})
