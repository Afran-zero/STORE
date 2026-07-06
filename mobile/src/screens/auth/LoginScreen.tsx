import { useState } from 'react';
import { Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/lib/colors';
import { scaleValue, useSizeClass } from '@/lib/responsive';

export function LoginScreen(): JSX.Element {
  const { login } = useAuth();
  const { width, isCompact } = useSizeClass();
  const s = (n: number) => scaleValue(n, width);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(): Promise<void> {
    if (!email.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Check your connection and credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.kav, { padding: isCompact ? s(12) : s(20) }]}
    >
      <AppScreen
        title="Worker sign in"
        subtitle="Use your store credentials to continue."
        scrollable={false}
      >
        <View
          style={[
            styles.card,
            { gap: s(10), padding: s(22), borderRadius: s(24), borderWidth: 2 },
          ]}
        >
          <Text style={[styles.label, { fontSize: s(12) }]} numberOfLines={1}>
            Email
          </Text>
          <TextInput
            placeholder="you@store.com"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[
              styles.input,
              {
                borderRadius: s(16),
                paddingHorizontal: s(14),
                paddingVertical: s(14),
                fontSize: s(15),
              },
            ]}
          />
          <Text style={[styles.label, { fontSize: s(12) }]} numberOfLines={1}>
            Password
          </Text>
          <TextInput
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={[
              styles.input,
              {
                borderRadius: s(16),
                paddingHorizontal: s(14),
                paddingVertical: s(14),
                fontSize: s(15),
              },
            ]}
          />
          {error ? (
            <Text style={[styles.error, { fontSize: s(13) }]} numberOfLines={3}>
              {error}
            </Text>
          ) : null}
          <PrimaryButton
            label={loading ? 'Signing in…' : 'Sign in'}
            onPress={() => {
              void submit();
            }}
            disabled={loading}
            style={{ marginTop: s(10) }}
          />
        </View>
        <Text style={[styles.hint, { fontSize: s(12), lineHeight: s(18), marginTop: s(14) }]} numberOfLines={4}>
          You must be assigned to a store. If you don't know your credentials, ask your store admin.
        </Text>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.background },
  card: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  label: {
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontWeight: '600',
  },
  error: { color: colors.danger, fontWeight: '700', marginTop: 4 },
  hint: { color: colors.muted, textAlign: 'center' },
});