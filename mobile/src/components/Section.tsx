import { memo, type ReactNode } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

import { colors } from '@/lib/colors';
import { AppText } from '@/lib/typography';

interface SectionHeaderProps {
  label: string;
  action?: { label: string; onPress: () => void };
}

function SectionHeaderImpl({ label, action }: SectionHeaderProps): JSX.Element {
  return (
    <View style={styles.row}>
      <AppText variant="overline">{label}</AppText>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <AppText variant="overline" style={styles.action}>
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export const SectionHeader = memo(SectionHeaderImpl);

interface MetricProps {
  label: string;
  value: string;
  accent?: boolean;
}

function MetricImpl({ label, value, accent }: MetricProps): JSX.Element {
  return (
    <View style={styles.metric}>
      <AppText variant="overline" style={accent ? styles.accentLabel : undefined}>
        {label}
      </AppText>
      <AppText variant="metric" style={accent ? styles.accentValue : undefined}>
        {value}
      </AppText>
    </View>
  );
}

export const Metric = memo(MetricImpl);

interface DividerProps {
  label?: string;
  trailing?: ReactNode;
}

function DividerImpl({ label, trailing }: DividerProps): JSX.Element {
  return (
    <View style={styles.dividerRow}>
      {label ? (
        <AppText variant="overline" style={styles.dividerLabel}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.dividerLine} />
      {trailing}
    </View>
  );
}

export const Divider = memo(DividerImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  action: {
    color: colors.text,
    textDecorationLine: 'underline',
  },
  metric: {
    flex: 1,
    gap: 4,
  },
  accentLabel: { color: colors.text },
  accentValue: { color: colors.text },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLabel: { color: colors.text },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSoft,
  },
});
