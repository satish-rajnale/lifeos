import { create } from 'zustand'
import { supabase } from '../services/supabase/client'

interface CreditState {
    credits: number
    loading: boolean
    fetchCredits: () => Promise<void>
}

export const useCreditStore = create<CreditState>((set) => ({
    credits: 0,
    loading: false,
    fetchCredits: async () => {
        set({ loading: true })
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user) {
                console.log('No user found, cannot fetch credits')
                set({ loading: false, credits: 0 })
                return
            }

            // Fetch credits for the current user
            const { data, error } = await supabase
                .from('usage_credits')
                .select('daily_journal_credits')
                .eq('user_id', user.id)
                .single()
            
            if (data) {
                set({ credits: data.daily_journal_credits })
            } else if (error) {
                console.log('Error fetching credits:', error)
                set({ credits: 0 })
            }
        } catch (err) {
            console.error('Exception fetching credits:', err)
            set({ credits: 0 })
        }
        set({ loading: false })
    }
}))
