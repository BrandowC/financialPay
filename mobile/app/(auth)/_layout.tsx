import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function AuthLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (!loading && isAuthenticated) {
    return <Redirect href="/(app)/account" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
