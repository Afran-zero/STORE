import { View, Text, StyleSheet } from 'react-native';

import { colors } from '@/lib/colors';

type Tone = 'yellow' | 'green' | 'red' | 'gray' | 'amber';

export function StatusChip({ label, tone = 'gray' }: { label: string; tone?: Tone }): JSX.Element {
  const palette = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
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
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
});