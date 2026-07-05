import { Pressable, Text, StyleSheet, View, type ViewStyle, type TextStyle } from 'react-native';

import { colors } from '@/lib/colors';

interface PrimaryButtonProps {
  label: string;
  caption?: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'soft';
  disabled?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

export function PrimaryButton({
  label,
  caption,
  onPress,
  variant = 'primary',
  disabled,
  style,
  labelStyle,
}: PrimaryButtonProps): JSX.Element {
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

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        base,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      <Text style={[baseLabel, labelStyle]}>{label}</Text>
      {caption ? <Text style={[styles.caption, baseLabel]}>{caption}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
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
  primaryLabel: { color: colors.accentText, fontWeight: '900', fontSize: 16 },
  outlineLabel: { color: colors.text, fontWeight: '800', fontSize: 15 },
  softLabel: { color: colors.accentText, fontWeight: '900', fontSize: 15 },
  ghostLabel: { color: colors.text, fontWeight: '700', fontSize: 14 },
  caption: { fontWeight: '500', fontSize: 12, opacity: 0.85 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
});