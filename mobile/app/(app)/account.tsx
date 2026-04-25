import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/GradientBackground';
import { BrandHeader } from '@/components/BrandHeader';
import { useAuth } from '@/lib/auth';

export default function AccountScreen() {
  const { profile, loading, signOut } = useAuth();

  if (loading || !profile) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <BrandHeader compact />

        <View style={styles.greetingWrap}>
          <Text style={styles.greeting}>Hola,</Text>
          <Text style={styles.name}>{profile.full_name}</Text>
        </View>

        <LinearGradient
          colors={['#1E40AF', '#0B5FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.cardTopRow}>
            <Text style={styles.cardLabel}>Cuenta</Text>
            <Text style={styles.cardChip}>FinancialPay</Text>
          </View>
          <Text style={styles.cardNumber}>{profile.credit_number}</Text>

          <View style={styles.divider} />

          <Text style={styles.balanceLabel}>Saldo disponible</Text>
          <Text style={styles.balance}>$0.00 USD</Text>
        </LinearGradient>

        <View style={styles.spacer} />

        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutPressed,
          ]}
          onPress={signOut}
        >
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: 24, paddingTop: 24 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  greetingWrap: { marginTop: 12, marginBottom: 24 },
  greeting: { color: '#B9CBEC', fontSize: 16 },
  name: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    marginTop: 4,
  },
  card: {
    borderRadius: 22,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    color: '#C9DAFE',
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  cardChip: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardNumber: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 14,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginVertical: 20,
  },
  balanceLabel: { color: '#C9DAFE', fontSize: 14 },
  balance: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: '800',
    marginTop: 6,
  },
  spacer: { flex: 1 },
  signOutButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutPressed: { opacity: 0.7 },
  signOutText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
