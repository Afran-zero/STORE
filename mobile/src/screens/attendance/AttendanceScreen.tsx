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
import { scaleValue, useSizeClass } from '@/lib/responsive';

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
  const { width, isCompact } = useSizeClass();
  const s = (n: number) => scaleValue(n, width);

  const todayQuery = useQuery({
    queryKey: ['attendance', 'today', user?.userId ?? ''],
    queryFn: getAttendanceToday,
    refetchInterval: 60_000,
  });

  const record: AttendanceRecord | null =
    todayQuery.data && (todayQuery.data as AttendanceRecord).status
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

  // Stack clock-in / clock-out tiles on the smallest phones so neither value
  // gets clipped; render side-by-side once we have the room.
  const timeDirection: 'row' | 'column' = isCompact ? 'column' : 'row';

  return (
    <AppScreen
      title="Attendance"
      subtitle={new Date().toDateString()}
      onRefresh={onRefresh}
      refreshing={todayQuery.isFetching}
    >
      <Card>
        <View style={[styles.row, { gap: 8 }]}>
          <Text style={[styles.label, { fontSize: s(13) }]} numberOfLines={1}>
            Status
          </Text>
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
        <View
          style={[
            styles.timeGrid,
            { flexDirection: timeDirection, gap: s(10), marginTop: s(10) },
          ]}
        >
          <View
            style={[
              styles.timeCell,
              {
                padding: s(14),
                borderRadius: s(16),
                flex: timeDirection === 'row' ? 1 : undefined,
              },
            ]}
          >
            <Text style={[styles.timeLabel, { fontSize: s(11) }]} numberOfLines={1}>
              Clock in
            </Text>
            <Text style={[styles.timeValue, { fontSize: s(22) }]} numberOfLines={1}>
              {fmtClock(record?.clockIn)}
            </Text>
          </View>
          <View
            style={[
              styles.timeCell,
              {
                padding: s(14),
                borderRadius: s(16),
                flex: timeDirection === 'row' ? 1 : undefined,
              },
            ]}
          >
            <Text style={[styles.timeLabel, { fontSize: s(11) }]} numberOfLines={1}>
              Clock out
            </Text>
            <Text style={[styles.timeValue, { fontSize: s(22) }]} numberOfLines={1}>
              {fmtClock(record?.clockOut)}
            </Text>
          </View>
        </View>
        {errorMessage ? <Text style={[styles.error, { fontSize: s(13) }]}>{errorMessage}</Text> : null}
        <View style={[styles.actions, { gap: s(10), marginTop: s(6) }]}>
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
      <Text style={[styles.help, { fontSize: s(12) }]} numberOfLines={3}>
        Your manager uses these times to track attendance. Pull down to refresh.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  label: { fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  timeGrid: { flexDirection: 'row', gap: 12 },
  timeCell: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeLabel: { fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  timeValue: { fontWeight: '900', color: colors.text, marginTop: 4 },
  actions: { gap: 10, marginTop: 4 },
  error: { color: colors.danger, fontWeight: '700' },
  help: { color: colors.muted, textAlign: 'center' },
});