import { create } from 'zustand'
import { journalCache } from '../app/journal/journalCache'
import { logger } from '../services/logger'
import { supabase } from '../services/supabase/client'
import { useCreditStore } from './creditStore'

interface JournalState {
    currentEntry: any | null
    loading: boolean
    creating: boolean
    error: string | null
    fetchJournal: (date: string) => Promise<void>
    createJournal: (text: string, date: string) => Promise<boolean>
}

export const useJournalStore = create<JournalState>((set, get) => ({
    currentEntry: null,
    loading: false,
    creating: false,
    error: null,

    fetchJournal: async (date: string) => {
        set({ loading: true, currentEntry: null, error: null })

        try {
            // 1. Check Cache
            const cached = await journalCache.get(date)
            if (cached) {
                set({ currentEntry: cached.summary, loading: false })
                return
            }

            // 2. Fetch from DB
            const { data, error } = await supabase
                .from('journal_entries')
                .select('summary')
                .eq('journal_date', date)
                .single()

            if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
                console.warn(error)
            }

            if (data) {
                // 3. Update Cache
                await journalCache.set(date, data.summary)
                set({ currentEntry: data.summary })
            }
        } catch (err: any) {
            console.error('Fetch journal error:', err)
            set({ error: err.message })
        } finally {
            set({ loading: false })
        }
    },

    createJournal: async (text: string, date: string) => {
        set({ creating: true, error: null })

        try {
            logger.info('EDGE_START', { date })
            const startTime = Date.now()
            
            // Create journal entry (returns immediately with entry_id)
            const { data, error } = await supabase.functions.invoke('create-daily-journal', {
                body: { text, date }
            })

            logger.info('EDGE_END', { duration: Date.now() - startTime, success: !error })

            if (error) throw error

            const entryId = data.entry_id

            // Poll for summary (async summarization via webhook)
            console.log('⏳ Waiting for AI summary generation...')
            const summary = await pollForSummary(entryId, date, 10) // 10 retries = ~10 seconds

            if (summary) {
                // Update Cache and Store
                await journalCache.set(date, summary)
                set({ currentEntry: summary })
            } else {
                console.warn('Summary generation taking longer than expected')
                // Set a placeholder while we wait
                set({ currentEntry: { 
                    day_summary: 'Generating your AI summary...', 
                    what_was_done: [],
                    energy_level: 'unclear',
                    emotional_tone: 'neutral',
                    reflection: 'Your summary will appear shortly.'
                }})
            }

            // Refresh Credits
            useCreditStore.getState().fetchCredits()

            return true
        } catch (err: any) {
            console.error('Create journal error:', err)
            set({ error: err.message || 'Failed to create journal' })
            return false
        } finally {
            set({ creating: false })
        }
    }
}))

/**
 * Poll for summary generation
 * Checks every second for up to maxRetries
 */
async function pollForSummary(
    entryId: string, 
    date: string, 
    maxRetries: number = 10
): Promise<any | null> {
    for (let i = 0; i < maxRetries; i++) {
        const { data, error } = await supabase
            .from('journal_entries')
            .select('summary, is_summarized')
            .eq('id', entryId)
            .single()

        if (error) {
            console.error('Error polling for summary:', error)
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
        }

        if (data?.is_summarized && data?.summary) {
            console.log('✅ Summary ready!')
            return data.summary
        }

        console.log(`⏳ Waiting for summary... (${i + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.warn('⚠️ Summary generation timeout - will appear when ready')
    return null
}
}))
