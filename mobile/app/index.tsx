import { Redirect, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function Index() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.brand400} />
      </View>
    );
  }

  const href: Href = isAuthenticated ? '/(app)/account' : ('/welcome' as Href);
  return <Redirect href={href} />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand900,
  },
});
