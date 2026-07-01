import { ActivityIndicator, SafeAreaView, Text, View, StyleSheet } from 'react-native';

import { colors } from '@/lib/colors';

export function SplashScreen(): JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.brand}>STORE</Text>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  brand: { fontSize: 30, fontWeight: '900', letterSpacing: 4, color: colors.text },
});
