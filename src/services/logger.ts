type LogEvent = 'VOICE_START' | 'VOICE_STOP' | 'EDGE_START' | 'EDGE_END' | 'JOURNAL_INSERT' | 'TTS_START' | 'TTS_DONE' | 'TTS_ERROR' | 'TTS_SPEAK_ERROR' | 'TTS_STOP_ERROR'

export const logger = {
    info: (event: LogEvent, meta?: any) => {
        console.log(`[${event}]`, meta ? JSON.stringify(meta) : '')
        // In future: Push to Supabase 'logs' table
    },
    error: (event: LogEvent, error: any) => {
        console.error(`[${event}]`, error)
    }
}
