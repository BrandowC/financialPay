import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

export type SelectOption = {
  value: string;
  label: string;
  displayLabel?: string;
  hint?: string;
};

type Props = {
  value: string | null;
  options: SelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
  containerStyle?: ViewStyle;
  title?: string;
  hasError?: boolean;
};

export function Select({
  value,
  options,
  placeholder,
  onChange,
  containerStyle,
  title,
  hasError,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const visibleText = selected
    ? selected.displayLabel ?? selected.label
    : placeholder;

  return (
    <>
      <Pressable
        style={[
          styles.field,
          hasError && styles.fieldError,
          containerStyle,
        ]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.text, !selected && styles.placeholder]}>
          {visibleText}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <ScrollView style={styles.scroll}>
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {opt.hint ? (
                      <Text style={styles.optionHint}>{opt.hint}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  fieldError: { borderColor: '#FF6B6B' },
  text: { fontSize: 16, color: '#0B2A6B' },
  placeholder: { color: '#8aa0c4' },
  chevron: { color: '#8aa0c4', fontSize: 16 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 8,
    maxHeight: '70%',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B2A6B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dde6f5',
  },
  scroll: { paddingVertical: 4 },
  option: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionActive: { backgroundColor: '#EEF4FF' },
  optionText: { fontSize: 16, color: '#0B2A6B' },
  optionTextActive: { fontWeight: '700' },
  optionHint: { fontSize: 14, color: '#7388ad' },
});
