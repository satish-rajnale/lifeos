import { Stack } from 'expo-router'
import { THEME } from '../utils/constants'

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: THEME.colors.background,
        },
        headerTintColor: THEME.colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: THEME.colors.background,
        },
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/SignInScreen" options={{ headerShown: false }} />
      <Stack.Screen name="journal/DailyJournalScreen" options={{ headerShown: false }} />
      <Stack.Screen name="settings/SettingsScreen" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
