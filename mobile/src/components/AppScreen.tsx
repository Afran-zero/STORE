import type { ReactNode } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';

import { colors } from '@/lib/colors';

interface AppScreenProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  scrollable?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function AppScreen({
  title,
  subtitle,
  children,
  scrollable = true,
  onRefresh,
  refreshing,
}: AppScreenProps): JSX.Element {
  const body = (
    <View style={styles.body}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {scrollable ? (
          <ScrollView
            contentContainerStyle={styles.scrollBody}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} />
              ) : undefined
            }
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  header: { gap: 6, marginBottom: 14, paddingTop: 6 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.muted },
  body: { gap: 14 },
  scrollBody: { gap: 14, paddingBottom: 32 },
});