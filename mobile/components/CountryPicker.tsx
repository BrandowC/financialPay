import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COUNTRIES, countryName, flagUrl, type Country } from '@/lib/countries';
import { useLanguage } from '@/lib/i18n';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  value: Country | null;
  onChange: (country: Country) => void;
  hasError?: boolean;
  /** Muestra solo la bandera y el prefijo (para la fila del teléfono). */
  compact?: boolean;
  containerStyle?: ViewStyle;
};

/** Quita tildes y mayúsculas para que "peru" encuentre "Perú". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function Flag({ iso, size = 24 }: { iso: string; size?: number }) {
  return (
    <Image
      source={{ uri: flagUrl(iso, 80) }}
      style={{ width: size * 1.4, height: size, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' }}
      resizeMode="cover"
    />
  );
}

/**
 * Selector de país con búsqueda.
 *
 * Una lista de ~240 países no se puede recorrer con el dedo: la búsqueda es lo
 * que la hace usable. Se abre como pantalla completa en vez de menú
 * desplegable para que el teclado no tape las opciones.
 */
export function CountryPicker({ value, onChange, hasError, compact, containerStyle }: Props) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const items = useMemo(
    () =>
      COUNTRIES.map((c) => ({ country: c, name: countryName(c, language) })).sort((a, b) =>
        a.name.localeCompare(b.name, language),
      ),
    [language],
  );

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return items;
    return items.filter(
      ({ country, name }) =>
        fold(name).includes(q) || fold(country.es).includes(q) || country.dial.includes(q) || country.iso.toLowerCase() === q,
    );
  }, [items, query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, compact && styles.fieldCompact, hasError && styles.fieldError, containerStyle]}
        accessibilityRole="button"
        accessibilityLabel={t('countryLabel')}
      >
        {value ? <Flag iso={value.iso} /> : null}
        <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
          {value ? (compact ? value.dial : countryName(value, language)) : t('countryLabel')}
        </Text>
        {!compact && value ? <Text style={styles.dial}>{value.dial}</Text> : null}
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('searchCountry')}
              placeholderTextColor={colors.textOnDarkFaint}
              style={styles.search}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Pressable onPress={close} hitSlop={10} style={styles.cancel}>
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </Pressable>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.country.iso}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>{t('noCountryResults')}</Text>}
            renderItem={({ item }) => {
              const active = value?.iso === item.country.iso;
              return (
                <Pressable
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => {
                    onChange(item.country);
                    close();
                  }}
                >
                  <Flag iso={item.country.iso} />
                  <Text style={[styles.rowName, active && styles.rowNameActive]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowDial}>{item.country.dial}</Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.glassFillStrong,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.lg,
  },
  fieldCompact: { paddingHorizontal: 10, gap: 6, justifyContent: 'center' },
  fieldError: { borderColor: colors.danger },
  fieldText: { ...typography.body, color: colors.white, flexShrink: 1 },
  placeholder: { color: colors.textOnDarkFaint },
  dial: { ...typography.body, color: colors.textOnDarkMuted, marginLeft: 'auto' },
  chevron: { color: colors.textOnDarkFaint, fontSize: 14 },
  modal: { flex: 1, backgroundColor: colors.midnight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  search: {
    flex: 1,
    ...typography.body,
    color: colors.white,
    backgroundColor: colors.glassFillStrong,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  cancel: { paddingVertical: 8 },
  cancelText: { ...typography.bodyStrong, color: colors.gold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  rowActive: { backgroundColor: colors.glassFill },
  rowName: { ...typography.body, color: colors.white, flex: 1 },
  rowNameActive: { fontWeight: '700' },
  rowDial: { ...typography.body, color: colors.textOnDarkMuted },
  empty: { ...typography.body, color: colors.textOnDarkMuted, textAlign: 'center', marginTop: spacing.xxl },
});
