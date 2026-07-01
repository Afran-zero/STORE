import { View, Text, StyleSheet } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/lib/colors';

export function HomeScreen(): JSX.Element {
  return (
    <AppScreen title="Today" subtitle={new Date().toDateString()}>
      <OfflineBanner />
      <View style={styles.card}>
        <Text style={styles.label}>Today's target progress</Text>
        <Text style={styles.value}>0%</Text>
      </View>
      <View style={styles.row}>
        <PrimaryButton label="Today's Allocation" onPress={() => undefined} />
        <PrimaryButton label="Record Sale" onPress={() => undefined} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 },
  label: { fontSize: 13, color: colors.muted, fontWeight: '700' },
  value: { fontSize: 34, fontWeight: '900', color: colors.text },
  row: { gap: 12 },
});
