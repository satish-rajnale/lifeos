import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { supabase } from '../../services/supabase/client'
import { THEME } from '../../utils/constants'

// Simple list of past journals
export default function JournalBookScreen() {
    const [entries, setEntries] = useState<any[]>([])

    useEffect(() => {
        supabase.from('journal_entries').select('id, journal_date, summary').order('journal_date', { ascending: false })
            .then(({ data }) => {
                if (data) setEntries(data)
            })
    }, [])

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Journal Book</Text>
            <FlatList
                data={entries}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.item}>
                        <Text style={styles.date}>{item.journal_date}</Text>
                        <Text numberOfLines={2} style={styles.summary}>{item.summary.day_summary}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.colors.background, padding: THEME.spacing.md },
    title: { fontSize: 24, fontWeight: 'bold', color: THEME.colors.text, marginBottom: THEME.spacing.md },
    item: { backgroundColor: THEME.colors.card, padding: THEME.spacing.md, borderRadius: THEME.borderRadius.md, marginBottom: THEME.spacing.sm },
    date: { color: THEME.colors.accent, fontWeight: '600', marginBottom: 4 },
    summary: { color: THEME.colors.textSecondary }
})
