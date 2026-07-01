import { useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/lib/colors';

export function LoginScreen(): JSX.Element {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <AppScreen title="Worker sign in" subtitle="Use your store credentials to continue.">
      <View style={styles.card}>
        <TextInput placeholder="Email" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <TextInput placeholder="Password" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="Sign in"
          onPress={async () => {
            try {
              setError(null);
              await login(email, password);
            } catch {
              setError('Unable to sign in. Check your connection and credentials.');
            }
          }}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: colors.background, color: colors.text },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
