import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useLanguage } from '@/lib/i18n';

type Props = {
  style?: ViewStyle;
};

export function LanguageToggle({ style }: Props) {
  const { language, setLanguage } = useLanguage();

  return (
    <View style={[styles.container, style]}>
      <Pressable
        onPress={() => setLanguage('es')}
        style={({ pressed }) => [
          styles.option,
          language === 'es' && styles.optionActive,
          pressed && styles.optionPressed,
        ]}
      >
        <Text
          style={[
            styles.optionText,
            language === 'es' && styles.optionTextActive,
          ]}
        >
          ES
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setLanguage('en')}
        style={({ pressed }) => [
          styles.option,
          language === 'en' && styles.optionActive,
          pressed && styles.optionPressed,
        ]}
      >
        <Text
          style={[
            styles.optionText,
            language === 'en' && styles.optionTextActive,
          ]}
        >
          EN
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.35)',
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 44,
    alignItems: 'center',
  },
  optionPressed: { opacity: 0.7 },
  optionActive: {
    backgroundColor: '#C9A961',
  },
  optionText: {
    color: '#C9DAFE',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  optionTextActive: {
    color: '#0A1A4D',
  },
});
