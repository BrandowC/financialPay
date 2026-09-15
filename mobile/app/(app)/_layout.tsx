import { Redirect, Stack, type Href } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function AppLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (!loading && !isAuthenticated) {
    return <Redirect href={'/welcome' as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
