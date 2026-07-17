import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { colors } from '@/lib/colors';
import { AppText } from '@/lib/typography';

interface SyncBannerProps {
  message: string | null;
  onHide: () => void;
}

const VISIBLE_MS = 2500;

export function SyncBanner({ message, onHide }: SyncBannerProps): JSX.Element | null {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return undefined;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(onHide);
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, onHide, opacity]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      <AppText style={styles.text}>{message}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: colors.text,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    zIndex: 1000,
  },
  text: {
    color: colors.inverse,
    fontSize: 13,
  },
});
