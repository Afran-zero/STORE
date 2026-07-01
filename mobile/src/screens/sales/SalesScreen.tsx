import { View, Text, StyleSheet } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/lib/colors';

export function SalesScreen(): JSX.Element {
  return (
    <AppScreen title="Sales" subtitle="Offline sale queue is ready for v1.">
      <View style={styles.card}>
        <Text style={styles.title}>No sales yet</Text>
        <Text style={styles.body}>Sales submitted offline will be queued locally and synced when connectivity returns.</Text>
      </View>
      <PrimaryButton label="+ New Sale" onPress={() => undefined} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.muted, lineHeight: 20 },
});
