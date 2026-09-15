import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 280,
            contentStyle: { backgroundColor: '#0A1A4D' },
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          <Stack.Screen name="(auth)" />
          <Stack.Screen
            name="(app)"
            options={{ animation: 'slide_from_bottom' }}
          />
        </Stack>
        <StatusBar style="light" />
      </AuthProvider>
    </LanguageProvider>
  );
}
