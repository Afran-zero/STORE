import { Pressable, Text, StyleSheet, useWindowDimensions, type ViewStyle, type TextStyle } from 'react-native';

import { colors } from '@/lib/colors';
import { scaleValue } from '@/lib/responsive';

interface PrimaryButtonProps {
  label: string;
  caption?: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'soft';
  disabled?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

/**
 * Standard button. Padding, radius and font size scale with screen width so
 * the same component looks right on a small Android, a large iPhone, and a
 * tablet — without the label awkwardly overflowing the bounds.
 */
export function PrimaryButton({
  label,
  caption,
  onPress,
  variant = 'primary',
  disabled,
  style,
  labelStyle,
}: PrimaryButtonProps): JSX.Element {
  const { width } = useWindowDimensions();
  const padV = scaleValue(14, width);
  const padH = scaleValue(18, width);
  const radius = scaleValue(18, width);
  const primarySize = scaleValue(16, width);
  const standardSize = scaleValue(15, width);
  const ghostSize = scaleValue(14, width);
  const captionSize = scaleValue(12, width);

  const base =
    variant === 'primary'
      ? styles.primary
      : variant === 'outline'
        ? styles.outline
        : variant === 'soft'
          ? styles.soft
          : styles.ghost;
  const baseLabel =
    variant === 'primary'
      ? styles.primaryLabel
      : variant === 'outline'
        ? styles.outlineLabel
        : variant === 'soft'
          ? styles.softLabel
          : styles.ghostLabel;

  const variantFontSize =
    variant === 'primary'
      ? primarySize
      : variant === 'ghost'
        ? ghostSize
        : standardSize;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          paddingVertical: padV,
          paddingHorizontal: padH,
          borderRadius: radius,
        },
        styles.button,
        base,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      <Text
        style={[{ fontSize: variantFontSize }, baseLabel, labelStyle]}
        numberOfLines={2}
      >
        {label}
      </Text>
      {caption ? (
        <Text
          style={[{ fontSize: captionSize }, baseLabel, styles.caption]}
          numberOfLines={2}
        >
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    gap: 4,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  outline: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
  },
  soft: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  primaryLabel: { color: colors.accentText, fontWeight: '900' },
  outlineLabel: { color: colors.text, fontWeight: '800' },
  softLabel: { color: colors.accentText, fontWeight: '900' },
  ghostLabel: { color: colors.text, fontWeight: '700' },
  caption: { fontWeight: '500', opacity: 0.85 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
});