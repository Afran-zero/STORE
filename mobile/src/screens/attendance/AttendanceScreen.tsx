import { View, Text, StyleSheet } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/lib/colors';

export function AttendanceScreen(): JSX.Element {
  return (
    <AppScreen title="Attendance" subtitle="Clock in and clock out for your shift.">
      <View style={styles.card}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.body}>No attendance record started yet.</Text>
      </View>
      <PrimaryButton label="Clock in" onPress={() => undefined} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.muted, lineHeight: 20 },
});
