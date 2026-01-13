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
            logger.info('EDGE_START', { date, textLength: text.length })
            const startTime = Date.now()
            
            const { data, error } = await supabase.functions.invoke('create-daily-journal', {
                body: { text, date }
            })

            const duration = Date.now() - startTime
            
            if (error) {
                logger.error('EDGE_END', { 
                    duration, 
                    success: false,
                    errorName: error.name,
                    errorMessage: error.message,
                    errorContext: error.context,
                    errorDetails: JSON.stringify(error, null, 2)
                })
                throw error
            }

            logger.info('EDGE_END', { duration, success: true, hasData: !!data })

            if (!data) {
                throw new Error('No data returned from Edge Function')
            }

            // Update Cache and Store
            const summary = data
            await journalCache.set(date, summary)
            set({ currentEntry: summary })

            // Refresh Credits
            useCreditStore.getState().fetchCredits()

            return true
        } catch (err: any) {
            logger.error('JOURNAL_INSERT', { 
                error: err.message,
                errorName: err.name,
                stack: err.stack,
                fullError: JSON.stringify(err, null, 2)
            })
            console.error('Create journal error:', err)
            set({ error: err.message || 'Failed to create journal' })
            return false
        } finally {
            set({ creating: false })
        }
    }
}))
