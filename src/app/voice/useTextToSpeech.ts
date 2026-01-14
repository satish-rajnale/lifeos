import { useEffect, useState } from 'react'
import * as TTS from 'text-to-speech'
import { logger } from '../../services/logger'

export const useTextToSpeech = () => {
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const startSub = TTS.onStart(() => {
            logger.info('TTS_START', { timestamp: new Date().toISOString() })
            setIsSpeaking(true)
            setError(null)
        })

        const doneSub = TTS.onDone(() => {
            logger.info('TTS_DONE', { timestamp: new Date().toISOString() })
            setIsSpeaking(false)
        })

        const errorSub = TTS.onError((errorMessage) => {
            logger.error('TTS_ERROR', { message: errorMessage })
            setError(errorMessage)
            setIsSpeaking(false)
        })

        return () => {
            startSub.remove()
            doneSub.remove()
            errorSub.remove()
        }
    }, [])

    const speak = async (text: string, options?: { pitch?: number; rate?: number }) => {
        try {
            setError(null)
            await TTS.speak(text, options)
        } catch (e: any) {
            const errorMessage = e.message || 'Failed to speak text'
            logger.error('TTS_SPEAK_ERROR', { error: errorMessage })
            setError(errorMessage)
        }
    }

    const stop = async () => {
        try {
            await TTS.stop()
            setIsSpeaking(false)
        } catch (e: any) {
            logger.error('TTS_STOP_ERROR', { error: e.message })
        }
    }

    return {
        isSpeaking,
        speak,
        stop,
        error
    }
}
