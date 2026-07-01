import { View, Text, StyleSheet } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/lib/colors';

export function ProfileScreen(): JSX.Element {
  const { user } = useAuth();

  return (
    <AppScreen title="Profile" subtitle="Your account and assigned store details.">
      <View style={styles.card}>
        <Text style={styles.title}>{user?.name ?? 'Worker'}</Text>
        <Text style={styles.body}>{user?.email ?? 'No email loaded yet'}</Text>
        <Text style={styles.body}>Role: {user?.role ?? 'WORKER'}</Text>
        <Text style={styles.body}>Assigned store: {user?.assignedStore ?? 'Not set'}</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.muted, lineHeight: 20 },
});
