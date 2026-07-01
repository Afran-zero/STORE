import { View, Text, StyleSheet } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { colors } from '@/lib/colors';

export function InventoryScreen(): JSX.Element {
  return (
    <AppScreen title="Inventory" subtitle="Cached ingredients for your assigned store.">
      <View style={styles.card}>
        <Text style={styles.title}>No cached items yet</Text>
        <Text style={styles.body}>Sync the app once connected to load inventory and recipes.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.muted, lineHeight: 20 },
});
