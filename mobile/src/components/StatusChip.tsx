import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

import { colors } from '@/lib/colors';
import { scaleValue } from '@/lib/responsive';

type Tone = 'yellow' | 'green' | 'red' | 'gray' | 'amber';

export function StatusChip({ label, tone = 'gray' }: { label: string; tone?: Tone }): JSX.Element {
  const palette = tones[tone];
  const { width } = useWindowDimensions();
  const padV = scaleValue(4, width);
  const padH = scaleValue(10, width);
  const size = scaleValue(11, width);
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          paddingVertical: padV,
          paddingHorizontal: padH,
        },
      ]}
    >
      <Text
        style={[styles.text, { color: palette.fg, fontSize: size }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const tones: Record<Tone, { bg: string; fg: string; border: string }> = {
  yellow: { bg: colors.accentSoft, fg: colors.accentText, border: colors.borderStrong },
  amber: { bg: '#fde68a', fg: '#78350f', border: '#f59e0b' },
  green: { bg: '#dcfce7', fg: '#14532d', border: '#86efac' },
  red: { bg: '#fee2e2', fg: '#7f1d1d', border: '#fca5a5' },
  gray: { bg: '#f5f5f4', fg: '#3f3f46', border: '#d4d4d8' },
};

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
  },
  text: { fontWeight: '800', letterSpacing: 0.4 },
});