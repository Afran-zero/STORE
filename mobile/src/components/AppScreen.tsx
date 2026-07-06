import type { ReactNode } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';

import { colors } from '@/lib/colors';
import { scaleValue } from '@/lib/responsive';

interface AppScreenProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  scrollable?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * Standard screen wrapper. Handles safe area, padding, scroll behavior, and
 * (optional) pull-to-refresh. All paddings and font sizes are derived from
 * the current screen width so the layout adapts smoothly between small
 * phones, large phones, and tablets.
 */
export function AppScreen({
  title,
  subtitle,
  children,
  scrollable = true,
  onRefresh,
  refreshing,
}: AppScreenProps): JSX.Element {
  const { width } = useWindowDimensions();
  const pad = scaleValue(16, width);
  const titleSize = scaleValue(26, width);
  const subtitleSize = scaleValue(14, width);
  const headerGap = scaleValue(6, width);
  const headerBottomGap = scaleValue(14, width);
  const bodyGap = scaleValue(14, width);
  const scrollBottomGap = scaleValue(32, width);
  const scrollBottomExtra = 120; // Room for the commit bar on Home

  const body = <View style={[styles.body, { gap: bodyGap }]}>{children}</View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { padding: pad }]}>
        <View style={{ gap: headerGap, marginBottom: headerBottomGap, paddingTop: 6 }}>
          <Text
            style={{
              fontSize: titleSize,
              lineHeight: titleSize * 1.25,
              fontWeight: '900',
              color: colors.text,
            }}
            numberOfLines={2}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontSize: subtitleSize,
                lineHeight: subtitleSize * 1.4,
                color: colors.muted,
              }}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {scrollable ? (
          <ScrollView
            contentContainerStyle={{ gap: bodyGap, paddingBottom: scrollBottomExtra + scrollBottomGap }}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} />
              ) : undefined
            }
            showsVerticalScrollIndicator={false}
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
  container: { flex: 1, backgroundColor: colors.background },
  body: {},
});