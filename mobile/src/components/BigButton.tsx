import { Pressable, Text, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { colors } from '@/lib/colors';
import { scaleValue } from '@/lib/responsive';

interface BigButtonProps {
  label: string;
  caption?: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'soft';
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Big, full-width tappable surface used on the Home dashboard and screen roots
 * where the worker should see one obvious next action. Sizing scales with
 * screen width so the CTA looks intentional on phones and tablets alike.
 */
export function BigButton({
  label,
  caption,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  style,
}: BigButtonProps): JSX.Element {
  const { width } = useWindowDimensions();
  const padV = scaleValue(22, width);
  const padH = scaleValue(20, width);
  const radius = scaleValue(22, width);
  const minH = scaleValue(84, width);
  const gap = scaleValue(14, width);
  const iconW = scaleValue(28, width);
  const labelSize = scaleValue(18, width);
  const captionSize = scaleValue(12, width);

  const container =
    variant === 'primary' ? styles.primary : variant === 'soft' ? styles.soft : styles.outline;
  const labelColor = variant === 'primary' ? colors.accentText : colors.text;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          paddingVertical: padV,
          paddingHorizontal: padH,
          borderRadius: radius,
          minHeight: minH,
          gap,
        },
        styles.container,
        container,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      <View style={[styles.row, { gap }]}>
        {icon ? <View style={{ width: iconW, alignItems: 'center' }}>{icon}</View> : null}
        <View style={[styles.textWrap, { gap: 4 }]}>
          <Text
            style={[styles.label, { color: labelColor, fontSize: labelSize }]}
            numberOfLines={2}
          >
            {label}
          </Text>
          {caption ? (
            <Text
              style={[styles.caption, { color: labelColor, fontSize: captionSize }]}
              numberOfLines={3}
            >
              {caption}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  soft: { backgroundColor: colors.accentSoft, borderColor: colors.borderStrong },
  outline: { backgroundColor: colors.background, borderColor: colors.borderStrong },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center' },
  textWrap: { flex: 1 },
  label: { fontWeight: '900' },
  caption: { fontWeight: '500', opacity: 0.85 },
});