import { Bell, FileText, LogOut, Shield, Trash2 } from 'lucide-react-native'
import React from 'react'
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useUserStore } from '../../state/userStore'
import { THEME } from '../../utils/constants'

export default function SettingsScreen() {
    const { signOut } = useUserStore()

    const handleLogout = async () => {
        await signOut()
    }

    const handleDelete = () => {
        Alert.alert('Delete Account', 'This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    // Call supabase delete function or auth admin
                    Alert.alert('Not implemented', 'This requires a backend function.')
                }
            }
        ])
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>Settings</Text>

            <View style={styles.section}>
                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <Bell size={20} color={THEME.colors.textSecondary} />
                        <Text style={styles.rowText}>Notifications</Text>
                    </View>
                    <Switch value={true} trackColor={{ true: THEME.colors.primary }} />
                </View>
                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <Shield size={20} color={THEME.colors.textSecondary} />
                        <Text style={styles.rowText}>Privacy Policy</Text>
                    </View>
                </View>
                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <FileText size={20} color={THEME.colors.textSecondary} />
                        <Text style={styles.rowText}>Terms of Service</Text>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <TouchableOpacity style={styles.button} onPress={handleLogout}>
                    <LogOut size={20} color={THEME.colors.text} />
                    <Text style={styles.buttonText}>Log Out</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={handleDelete}>
                    <Trash2 size={20} color={THEME.colors.danger} />
                    <Text style={[styles.buttonText, { color: THEME.colors.danger }]}>Delete Account</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.colors.background,
        padding: THEME.spacing.md,
    },
    header: {
        fontSize: 32,
        fontWeight: 'bold',
        color: THEME.colors.text,
        marginBottom: THEME.spacing.xl,
        marginTop: THEME.spacing.lg,
    },
    section: {
        backgroundColor: THEME.colors.card,
        borderRadius: THEME.borderRadius.lg,
        padding: THEME.spacing.md,
        marginBottom: THEME.spacing.lg,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: THEME.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rowText: {
        color: THEME.colors.text,
        fontSize: 16,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: THEME.spacing.md,
    },
    buttonText: {
        color: THEME.colors.text,
        fontSize: 16,
        fontWeight: '500',
    },
    dangerButton: {
        marginTop: THEME.spacing.sm,
    }
})
