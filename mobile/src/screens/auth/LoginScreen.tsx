import { useState } from 'react';
import { Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/lib/colors';

export function LoginScreen(): JSX.Element {
  const { login } = useAuth();
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
      style={styles.kav}
    >
      <AppScreen title="Worker sign in" subtitle="Use your store credentials to continue." scrollable={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholder="you@store.com"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label={loading ? 'Signing in…' : 'Sign in'}
            onPress={() => {
              void submit();
            }}
            disabled={loading}
            style={styles.signinButton}
          />
        </View>
        <Text style={styles.hint}>
          You must be assigned to a store. If you don't know your credentials, ask your store admin.
        </Text>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.background },
  card: {
    gap: 10,
    padding: 22,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  label: { fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700', marginTop: 4 },
  signinButton: { marginTop: 10 },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 },
});