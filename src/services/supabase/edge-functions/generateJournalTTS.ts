import { supabase } from '../client'

export interface GenerateWeeklyTTSResponse {
    status: 'success' | 'empty' | 'error'
    summary_text?: string
    audio_path?: string
    week_start_date?: string
    week_end_date?: string
    stats?: {
        days_journaled: number
        avg_energy_level: string
        dominant_mood: string
        top_activities: string[]
        key_achievement: string
    }
    days_included?: number
    message?: string
    error?: string
}

/**
 * Call the edge function to generate weekly TTS audio summary
 * Generates a reflection covering the past 7 days from the given end date
 */
export async function generateWeeklyJournalTTS(endDate?: string): Promise<GenerateWeeklyTTSResponse> {
    try {
        const end_date = endDate || new Date().toISOString().split('T')[0]
        console.log('🎙️ Generating weekly TTS ending on:', end_date)

        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
            throw new Error('No active session')
        }

        const { data, error } = await supabase.functions.invoke('generate-weekly-journal-tts', {
            body: { end_date },
        })

        if (error) {
            console.error('❌ Weekly TTS generation error:', error)
            throw error
        }

        console.log('✅ Weekly TTS generated:', data)
        return data as GenerateWeeklyTTSResponse
    } catch (error: any) {
        console.error('❌ Failed to generate weekly TTS:', error)
        return {
            status: 'error',
            error: error.message || 'Failed to generate weekly audio',
        }
    }
}

/**
 * Get the public URL for a weekly TTS audio file
 */
export function getWeeklyTTSAudioUrl(audioPath: string): string {
    const { data } = supabase.storage
        .from('journal-weekly-tts')
        .getPublicUrl(audioPath)

    return data.publicUrl
}

/**
 * Get weekly summary for a specific week
 */
export async function getWeeklySummary(weekStartDate: string) {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        throw new Error('No user found')
    }

    const { data, error } = await supabase
        .from('journal_weekly_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start_date', weekStartDate)
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching weekly summary:', error)
        throw error
    }

    return data
}

/**
 * Get all weekly summaries for a user
 */
export async function getAllWeeklySummaries() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        throw new Error('No user found')
    }

    const { data, error } = await supabase
        .from('journal_weekly_summaries')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start_date', { ascending: false })

    if (error) {
        console.error('Error fetching weekly summaries:', error)
        throw error
    }

    return data || []
}
