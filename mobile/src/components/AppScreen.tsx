import type { ReactNode } from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';

import { colors } from '@/lib/colors';

export function AppScreen({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }): JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 20, backgroundColor: colors.background },
  header: { gap: 8, marginBottom: 18 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.muted },
  body: { flex: 1, gap: 16 },
});
