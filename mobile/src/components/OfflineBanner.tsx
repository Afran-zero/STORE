import { Text, View, StyleSheet } from 'react-native';

import { useSyncStatus } from '@/context/SyncStatusContext';
import { colors } from '@/lib/colors';

export function OfflineBanner(): JSX.Element | null {
  const { isOnline } = useSyncStatus();
  if (isOnline) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Offline - showing cached data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: colors.border },
  text: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
});
