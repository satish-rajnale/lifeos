import { useEffect, useState } from 'react'
import { Alert, Linking, Platform } from 'react-native'
import * as Speech from 'speech-recognition'
import { logger } from '../../services/logger'

const getErrorMessage = (error: string, errorCode?: string): string => {
    // Check error code first for more specific handling
    if (errorCode === 'ERROR_CLIENT') {
        return 'Speech recognition failed. Please:\n1. Close other apps using the microphone\n2. Update Google app from Play Store\n3. Restart your device'
    }
    if (errorCode === 'ERROR_AUDIO') {
        return 'Microphone is in use. Please close other apps using the microphone.'
    }
    if (errorCode === 'ERROR_INSUFFICIENT_PERMISSIONS') {
        return 'Microphone permission denied. Please enable it in Settings.'
    }
    if (errorCode === 'ERROR_NETWORK') {
        return 'Internet connection required for speech recognition.'
    }
    
    // Fallback to message checking
    if (error.includes('denied') || error.includes('PERMISSION')) {
        return 'Microphone access denied. Please enable it in Settings.'
    }
    if (error.includes('restricted')) {
        return 'Speech recognition is restricted on this device.'
    }
    if (error.includes('Client side error') || error.includes('unavailable')) {
        return 'Speech recognition unavailable. Please check:\n• Microphone not in use\n• Google app is updated\n• Internet connected'
    }
    return error || 'An error occurred with speech recognition.'
}

export const useSpeechToText = () => {
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        logger.info('VOICE_PERMISSION_CHECK', { 
            platform: Platform.OS,
            message: 'Setting up speech recognition listeners' 
        })

        const partialSub = Speech.onPartialResult((text) => {
            logger.info('VOICE_PARTIAL', { 
                textLength: text.length,
                text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                timestamp: new Date().toISOString()
            })
            setTranscript(text)
            setError(null) // Clear error on successful transcription
        })
        
        const errorSub = Speech.onError((msg, code) => {
            const errorMessage = getErrorMessage(msg, code)
            logger.error('VOICE_ERROR', { message: msg, code, formatted: errorMessage })
            setError(errorMessage)
            setIsListening(false)
            
            // Show alerts for critical errors
            if (code === 'ERROR_CLIENT') {
                // ERROR_CLIENT on Android usually means Google app issue or mic in use
                Alert.alert(
                    'Speech Recognition Failed',
                    errorMessage,
                    [
                        { text: 'OK', style: 'cancel' },
                        Platform.OS === 'android' ? {
                            text: 'Open Settings',
                            onPress: () => Linking.openSettings()
                        } : undefined
                    ].filter(Boolean) as any
                )
            } else if (code === 'ERROR_INSUFFICIENT_PERMISSIONS' || msg.includes('PERMISSION')) {
                Alert.alert(
                    'Microphone Permission Required',
                    errorMessage,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Open Settings',
                            onPress: () => Linking.openSettings()
                        }
                    ]
                )
            }
        })

        return () => {
            logger.info('VOICE_PERMISSION_CHECK', { message: 'Removing speech recognition listeners' })
            partialSub.remove()
            errorSub.remove()
        }
    }, [])

    const startListening = async () => {
        try {
            logger.info('VOICE_START', { 
                timestamp: new Date().toISOString(),
                platform: Platform.OS,
                message: 'Attempting to start speech recognition'
            })

            // On Android, double-check permission before starting
            if (Platform.OS === 'android') {
                const hasPermission = await Speech.checkPermission()
                logger.info('VOICE_PERMISSION_CHECK', { 
                    hasPermission, 
                    platform: 'android' 
                })
                if (!hasPermission) {
                    const errorMessage = 'Microphone permission not granted. Please enable it in Settings.'
                    setError(errorMessage)
                    logger.error('VOICE_START_ERROR', { 
                        error: 'Permission denied',
                        platform: 'android'
                    })
                    Alert.alert(
                        'Microphone Permission Required',
                        errorMessage,
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Open Settings',
                                onPress: () => Linking.openSettings()
                            }
                        ]
                    )
                    return
                }
            }

            setTranscript('')
            setError(null)
            setIsListening(true)
            
            logger.info('VOICE_NATIVE_START', { 
                message: 'Calling native startListening method',
                platform: Platform.OS
            })
            
            await Speech.startListening()
            
            logger.info('VOICE_START', { 
                message: 'Speech recognition started successfully',
                platform: Platform.OS
            })
        } catch (e: any) {
            const errorMessage = getErrorMessage(e.message || 'Unknown error', e.code)
            logger.error('VOICE_START_ERROR', { 
                error: e.message, 
                code: e.code,
                formatted: errorMessage,
                stack: e.stack
            })
            setError(errorMessage)
            setIsListening(false)
            
            // Show actionable alert
            Alert.alert(
                'Unable to Start Recording',
                errorMessage,
                [
                    { text: 'OK', style: 'cancel' },
                    e.code === 'PERMISSION_DENIED' || e.code === 'ERROR_INSUFFICIENT_PERMISSIONS' ? {
                        text: 'Open Settings',
                        onPress: () => Linking.openSettings()
                    } : undefined
                ].filter(Boolean) as any
            )
        }
    }

    const stopListening = async () => {
        try {
            logger.info('VOICE_NATIVE_STOP', { 
                message: 'Calling native stopListening method' 
            })
            const final = await Speech.stopListening()
            logger.info('VOICE_STOP', { 
                transcriptLength: final?.length || 0,
                hasTranscript: !!final,
                finalText: final ? final.substring(0, 100) + (final.length > 100 ? '...' : '') : 'none'
            })
            setIsListening(false)
            // Ensure the state reflects the final value
            if (final) setTranscript(final)
        } catch (e: any) {
            logger.error('VOICE_STOP_ERROR', { 
                error: e.message,
                stack: e.stack
            })
            setIsListening(false)
        }
    }

    return {
        isListening,
        transcript,
        startListening,
        stopListening,
        error
    }
}
