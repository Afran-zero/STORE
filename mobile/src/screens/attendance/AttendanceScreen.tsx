import { useCallback } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { useAuth } from '@/context/AuthContext';
import {
  clockIn,
  clockOut,
  getAttendanceToday,
  type AttendanceRecord,
} from '@/api/endpoints/attendance';
import { ApiException } from '@/types/api';
import { colors } from '@/lib/colors';

function fmtClock(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function AttendanceScreen(): JSX.Element {
  const { user } = useAuth();
  const qc = useQueryClient();

  const todayQuery = useQuery({
    queryKey: ['attendance', 'today', user?.userId ?? ''],
    queryFn: getAttendanceToday,
    refetchInterval: 60_000,
  });

  const record: AttendanceRecord | null = todayQuery.data && (todayQuery.data as AttendanceRecord).status
    ? (todayQuery.data as AttendanceRecord)
    : null;

  const clockInMut = useMutation({
    mutationFn: () => clockIn({ storeId: user?.assignedStore ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
  const clockOutMut = useMutation({
    mutationFn: () => clockOut(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const onRefresh = useCallback(() => {
    void todayQuery.refetch();
  }, [todayQuery]);

  const clockedIn = Boolean(record?.clockIn);
  const clockedOut = Boolean(record?.clockOut);
  const errorMessage =
    clockInMut.error instanceof ApiException
      ? clockInMut.error.message
      : clockOutMut.error instanceof ApiException
        ? clockOutMut.error.message
        : null;

  return (
    <AppScreen
      title="Attendance"
      subtitle={new Date().toDateString()}
      onRefresh={onRefresh}
      refreshing={todayQuery.isFetching}
    >
      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <StatusChip
            label={
              !record
                ? 'NOT STARTED'
                : clockedOut
                  ? 'DONE'
                  : clockedIn
                    ? 'ON SHIFT'
                    : (record.status ?? 'PRESENT')
            }
            tone={
              !record ? 'gray' : clockedOut ? 'green' : clockedIn ? 'amber' : 'gray'
            }
          />
        </View>
        <View style={styles.timeGrid}>
          <View style={styles.timeCell}>
            <Text style={styles.timeLabel}>Clock in</Text>
            <Text style={styles.timeValue}>{fmtClock(record?.clockIn)}</Text>
          </View>
          <View style={styles.timeCell}>
            <Text style={styles.timeLabel}>Clock out</Text>
            <Text style={styles.timeValue}>{fmtClock(record?.clockOut)}</Text>
          </View>
        </View>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <View style={styles.actions}>
          <PrimaryButton
            label={clockedIn ? 'Already clocked in' : 'Clock in'}
            onPress={() => clockInMut.mutate()}
            disabled={clockedIn || clockInMut.isPending}
          />
          <PrimaryButton
            label={clockedOut ? 'Already clocked out' : 'Clock out'}
            variant="outline"
            onPress={() => clockOutMut.mutate()}
            disabled={!clockedIn || clockedOut || clockOutMut.isPending}
          />
        </View>
      </Card>
      <Text style={styles.help}>
        Your manager uses these times to track attendance. Pull down to refresh.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  timeGrid: { flexDirection: 'row', gap: 12, marginTop: 8 },
  timeCell: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  timeValue: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 4 },
  actions: { gap: 10, marginTop: 4 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  help: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});