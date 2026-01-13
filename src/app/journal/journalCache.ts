import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_KEY = 'journal_cache'

export interface CachedJournal {
    summary: any
    fetchedAt: number
}

export interface JournalCacheMap {
    [date: string]: CachedJournal
}

export const journalCache = {
    async getAll(): Promise<JournalCacheMap> {
        try {
            const raw = await AsyncStorage.getItem(CACHE_KEY)
            return raw ? JSON.parse(raw) : {}
        } catch {
            return {}
        }
    },

    async get(date: string): Promise<CachedJournal | null> {
        const all = await this.getAll()
        const entry = all[date]
        if (!entry) return null

        // Cache validity check: App relaunched after 24h?
        // The requirement says: "Never refetch unless: ... App relaunched after 24h"
        // This implies we need to check if the cache is stale based on time.
        // "24h" logic:
        const now = Date.now()
        if (now - entry.fetchedAt > 24 * 60 * 60 * 1000) {
            return null // Expired
        }
        return entry
    },

    async set(date: string, summary: any) {
        const all = await this.getAll()
        all[date] = { summary, fetchedAt: Date.now() }
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(all))
    },

    async clear() {
        await AsyncStorage.removeItem(CACHE_KEY)
    }
}
