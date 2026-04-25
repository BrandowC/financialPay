import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 280,
          contentStyle: { backgroundColor: '#050E2C' },
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
  );
}
