import type { ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

import { colors } from '@/lib/colors';

export function Card({
  children,
  style,
  accent,
}: {
  children: ReactNode;
  style?: ViewStyle;
  accent?: 'yellow' | 'red' | 'green';
}): JSX.Element {
  const accentColor =
    accent === 'red' ? '#fecaca' : accent === 'green' ? '#bbf7d0' : colors.border;
  return <View style={[styles.card, { borderColor: accentColor }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: colors.surface,
    gap: 8,
  },
});