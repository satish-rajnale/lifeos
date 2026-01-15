import { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '../services/supabase/client'
import { UserProfile, getProfile } from '../services/supabase/db/profiles'

interface UserState {
    session: Session | null
    user: User | null
    profile: UserProfile | null
    loading: boolean
    setSession: (session: Session | null) => void
    fetchProfile: () => Promise<void>
    signOut: () => Promise<void>
}

export const useUserStore = create<UserState>((set, get) => ({
    session: null,
    user: null,
    profile: null,
    loading: false,
    setSession: (session) => set({ session, user: session?.user ?? null }),
    fetchProfile: async () => {
        const { user } = get()
        if (!user) return
        
        set({ loading: true })
        try {
            const profile = await getProfile(user.id)
            if (profile) set({ profile })
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            set({ loading: false })
        }
    },
    signOut: async () => {
        console.log('🚪 Signing out user...')
        console.log('🗑️ Clearing session from AsyncStorage...')
        
        await supabase.auth.signOut()
        
        console.log('✅ User signed out successfully')
        console.log('💡 User will need to log in again on next app open')
        
        set({ session: null, user: null, profile: null })
    }
}))
