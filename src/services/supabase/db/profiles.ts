import { supabase } from '../client'

export interface UserProfile {
    id: string
    created_at: string
    timezone: string | null
    notification_enabled: boolean
}

/**
 * Get user profile by user ID
 */
export async function getProfile(userId: string) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching profile:', error)
        throw error
    }

    return data
}

/**
 * Create a new user profile
 */
export async function createProfile(userId: string, timezone?: string) {
    // Try to detect timezone
    const userTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

    const { data, error } = await supabase
        .from('profiles')
        .insert({
            id: userId,
            timezone: userTimezone,
            notification_enabled: true,
        })
        .select()
        .single()

    if (error) {
        // If profile already exists (race condition with trigger), that's okay
        if (error.code === '23505') { // unique_violation
            console.log('ℹ️ Profile already exists for user:', userId)
            return await getProfile(userId)
        }
        console.error('Error creating profile:', error)
        throw error
    }

    console.log('✅ Profile created successfully for user:', userId)
    return data
}

/**
 * Get or create user profile - ensures profile exists
 */
export async function ensureProfile(userId: string): Promise<UserProfile> {
    // First, try to get existing profile
    let profile = await getProfile(userId)

    // If no profile exists, create one
    if (!profile) {
        console.log('📝 No profile found for user, creating new profile...')
        profile = await createProfile(userId)
    } else {
        console.log('✅ Profile found for user:', userId)
    }

    return profile
}

/**
 * Update user profile
 */
export async function updateProfile(userId: string, updates: Partial<Omit<UserProfile, 'id' | 'created_at'>>) {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

    if (error) {
        console.error('Error updating profile:', error)
        throw error
    }

    return data
}
