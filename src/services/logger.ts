type LogEvent = 'VOICE_START' | 'VOICE_STOP' | 'VOICE_ERROR' | 'VOICE_START_ERROR' | 'VOICE_STOP_ERROR' 
    | 'VOICE_PARTIAL' | 'VOICE_PERMISSION_CHECK' | 'VOICE_NATIVE_START' | 'VOICE_NATIVE_STOP' 
    | 'EDGE_START' | 'EDGE_END' | 'JOURNAL_INSERT'

export const logger = {
    info: (event: LogEvent, meta?: any) => {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] [${event}]`, meta ? JSON.stringify(meta, null, 2) : '')
        // In future: Push to Supabase 'logs' table
    },
    error: (event: LogEvent, error: any) => {
        const timestamp = new Date().toISOString()
        console.error(`[${timestamp}] [${event}]`, error)
    },
    warn: (event: LogEvent, meta?: any) => {
        const timestamp = new Date().toISOString()
        console.warn(`[${timestamp}] [${event}]`, meta ? JSON.stringify(meta, null, 2) : '')
    }
}
