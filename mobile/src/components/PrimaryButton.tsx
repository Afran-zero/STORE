import { Pressable, Text, StyleSheet } from 'react-native';

import { colors } from '@/lib/colors';

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }): JSX.Element {
  return (
    <Pressable onPress={onPress} style={styles.button}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16, alignItems: 'center' },
  label: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
