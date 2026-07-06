import type { ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';

import { colors } from '@/lib/colors';
import { scaleValue } from '@/lib/responsive';

export function Card({
  children,
  style,
  accent,
}: {
  children: ReactNode;
  style?: ViewStyle;
  accent?: 'yellow' | 'red' | 'green';
}): JSX.Element {
  const { width } = useWindowDimensions();
  const pad = scaleValue(18, width);
  const radius = scaleValue(22, width);
  const accentColor =
    accent === 'red' ? '#fecaca' : accent === 'green' ? '#bbf7d0' : colors.border;
  return (
    <View
      style={[
        styles.card,
        {
          padding: pad,
          borderRadius: radius,
        },
        { borderColor: accentColor },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    backgroundColor: colors.surface,
    gap: 8,
  },
});