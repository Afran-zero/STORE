import { ActivityIndicator, SafeAreaView, Text, View, StyleSheet } from 'react-native';
import { colors } from '@/lib/colors';
import { scaleValue, useSizeClass } from '@/lib/responsive';

export function SplashScreen(): JSX.Element {
  const { width } = useSizeClass();
  const s = (n: number) => scaleValue(n, width);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { gap: s(16) }]}>
        <Text
          style={[styles.brand, { fontSize: s(30), letterSpacing: s(4) }]}
          numberOfLines={1}
        >
          STORE
        </Text>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { fontWeight: '900', color: colors.text },
});
