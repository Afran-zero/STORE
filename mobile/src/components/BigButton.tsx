import { Pressable, Text, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '@/lib/colors';

interface BigButtonProps {
  label: string;
  caption?: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'soft';
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

// Big, full-width tappable surface used on the Home dashboard and screen roots
// where the worker should see one obvious next action.
export function BigButton({
  label,
  caption,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  style,
}: BigButtonProps): JSX.Element {
  const container =
    variant === 'primary' ? styles.primary : variant === 'soft' ? styles.soft : styles.outline;
  const labelColor = variant === 'primary' ? colors.accentText : colors.text;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.container,
        container,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      <View style={styles.row}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <View style={styles.textWrap}>
          <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
          {caption ? (
            <Text style={[styles.caption, { color: labelColor }]} numberOfLines={2}>
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
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 2,
    minHeight: 84,
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  soft: { backgroundColor: colors.accentSoft, borderColor: colors.borderStrong },
  outline: { backgroundColor: colors.background, borderColor: colors.borderStrong },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 28, alignItems: 'center' },
  textWrap: { flex: 1, gap: 4 },
  label: { fontSize: 18, fontWeight: '900' },
  caption: { fontSize: 12, fontWeight: '500', opacity: 0.85 },
});