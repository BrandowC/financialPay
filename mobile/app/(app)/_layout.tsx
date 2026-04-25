import { Redirect, Stack, type Href } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function AppLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href={'/welcome' as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
