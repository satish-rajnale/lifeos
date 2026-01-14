import { Check, Mic, MicOff, X } from 'lucide-react-native'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { THEME } from '../../utils/constants'
import { formatTranscript } from '../../utils/formatTranscript'
import { useSpeechToText } from './useSpeechToText'

interface VoiceCaptureModalProps {
    visible: boolean
    onClose: () => void
    onCapture: (text: string) => Promise<void>
}

export const VoiceCaptureModal = ({ visible, onClose, onCapture }: VoiceCaptureModalProps) => {
    const { isListening, transcript, startListening, stopListening, error } = useSpeechToText()
    const [processing, setProcessing] = useState(false)

    // Auto-start listening when modal opens
    useEffect(() => {
        if (visible) {
            // Small delay to ensure modal animation completes
            const timer = setTimeout(() => {
                startListening()
            }, 300)
            return () => clearTimeout(timer)
        } else {
            stopListening()
            setProcessing(false) // Reset state
        }
    }, [visible])

    const handleDone = async () => {
        await stopListening()
        if (!transcript) {
            onClose()
            return
        }
        setProcessing(true)
        const formatted = formatTranscript(transcript)
        await onCapture(formatted)
        setProcessing(false)
        onClose()
    }

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} disabled={processing}>
                            <X color={THEME.colors.textSecondary} size={24} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Daily Reflection</Text>
                        <TouchableOpacity onPress={handleDone} disabled={processing || !transcript}>
                            {processing ? <ActivityIndicator color={THEME.colors.primary} /> : <Check color={THEME.colors.success} size={24} />}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorTitle}>Unable to Start Recording</Text>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : transcript ? (
                            <Text style={styles.transcript}>{transcript}</Text>
                        ) : (
                            <View style={styles.placeholderContainer}>
                                <Text style={styles.placeholder}>Speak your thoughts...</Text>
                                {isListening && (
                                    <View style={styles.listeningIndicator}>
                                        <View style={[styles.listeningDot, styles.dot1]} />
                                        <View style={[styles.listeningDot, styles.dot2]} />
                                        <View style={[styles.listeningDot, styles.dot3]} />
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    <View style={styles.controls}>
                        <TouchableOpacity
                            style={[styles.micButton, isListening && styles.micActive]}
                            onPress={isListening ? stopListening : startListening}
                            disabled={processing}
                        >
                            {isListening ? (
                                <Mic size={32} color="#fff" />
                            ) : (
                                <MicOff size={32} color="#fff" />
                            )}
                        </TouchableOpacity>
                        <Text style={styles.statusText}>
                            {isListening ? 'Listening...' : 'Tap to start recording'}
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: THEME.colors.card,
        borderTopLeftRadius: THEME.borderRadius.lg,
        borderTopRightRadius: THEME.borderRadius.lg,
        height: '80%',
        padding: THEME.spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: THEME.spacing.lg,
    },
    title: {
        color: THEME.colors.text,
        fontSize: 18,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: THEME.borderRadius.md,
        padding: THEME.spacing.md,
        marginBottom: THEME.spacing.lg,
    },
    transcript: {
        color: THEME.colors.text,
        fontSize: 16,
        lineHeight: 24,
    },
    placeholder: {
        color: THEME.colors.textSecondary,
        fontSize: 16,
        fontStyle: 'italic',
    },
    controls: {
        alignItems: 'center',
        marginBottom: THEME.spacing.xl,
    },
    micButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: THEME.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    micActive: {
        backgroundColor: THEME.colors.danger,
        shadowColor: THEME.colors.danger,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    statusText: {
        color: THEME.colors.textSecondary,
        marginTop: THEME.spacing.sm,
        fontSize: 14,
    },
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    errorTitle: {
        color: THEME.colors.danger,
        fontSize: 18,
        fontWeight: '600',
        marginBottom: THEME.spacing.sm,
    },
    errorText: {
        color: THEME.colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        maxWidth: '80%',
    },
    placeholderContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    listeningIndicator: {
        flexDirection: 'row',
        marginTop: THEME.spacing.lg,
        gap: 8,
    },
    listeningDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: THEME.colors.primary,
    },
    dot1: {
        opacity: 0.3,
    },
    dot2: {
        opacity: 0.6,
    },
    dot3: {
        opacity: 1,
    },
})
