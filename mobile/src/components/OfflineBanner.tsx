import { Text, View, StyleSheet } from 'react-native';

import { colors } from '@/lib/colors';

// Worker app is always-online; this banner is here for the rare case the
// NetInfo listener flags a disconnect. We don't block any UI — instead we
// surface a small reminder so the worker knows writes will fail until back.
export function OfflineBanner({ visible = false }: { visible?: boolean }): JSX.Element | null {
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No connection — actions will fail until back online.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  text: { fontSize: 12, fontWeight: '700', color: colors.accentText, textAlign: 'center' },
});