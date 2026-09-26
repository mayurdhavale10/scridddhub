import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type MasterSchedule = components['schemas']['MasterSchedule'];
type Milestone = components['schemas']['MasterScheduleMilestone'];
type MilestoneType = components['schemas']['MasterScheduleMilestoneType'];

type Props = {
  projectId: string;
  onBack: () => void;
};

// Fixed display order, matching the wireframe timeline — the API returns milestones ordered by
// target_date, which already matches this sequence in the common case, but the label lookup is
// keyed by type regardless of array order.
const MILESTONE_LABEL: Record<MilestoneType, string> = {
  land_acquisition: 'Land Acquisition',
  approvals: 'Approvals',
  construction_start: 'Construction Start',
  structure_complete: 'Structure Complete',
  committed_possession_date: 'Committed Possession Date',
};

const DOT_COLOR: Record<Milestone['status'] & string, string> = {
  complete: colors.primary,
  in_progress: colors.secondary,
  pending: colors.outlineVariant,
};

function formatMonthYear(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function subtitleFor(m: Milestone): string {
  const date = formatMonthYear(m.target_date!);
  if (m.status === 'complete') return `complete — ${date}`;
  if (m.status === 'in_progress') return `in progress — est. complete ${date}`;
  return `est. ${date}`;
}

export function MasterScheduleScreen({ projectId, onBack }: Props) {
  const [schedule, setSchedule] = useState<MasterSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET('/projects/{projectID}/master-schedule', {
      params: { path: { projectID: projectId } },
    });
    if (apiError) {
      setError('No master schedule created for this project yet.');
    } else {
      setSchedule(data ?? null);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const confirmSchedule = useCallback(async () => {
    if (!schedule) return;
    setConfirming(true);
    const { data, error: apiError } = await api.POST(
      '/master-schedules/{scheduleID}/confirm',
      { params: { path: { scheduleID: schedule.id! } } },
    );
    if (!apiError) {
      setSchedule(data ?? null);
    }
    setConfirming(false);
  }, [schedule]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !schedule) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {error ?? 'No master schedule created for this project yet.'}
        </Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const isConfirmed = !!schedule.confirmed_at;
  const milestones = schedule.milestones ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Master Schedule</Text>
      <Text style={styles.subtitle}>land to possession</Text>

      <View style={styles.reraCard}>
        <Text style={styles.reraText}>
          <Text style={styles.reraBold}>RERA Section 18: </Text>
          a missed committed possession date owes buyers interest at SBI MCLR + 2%/month on
          amount paid. Set this date carefully.
        </Text>
      </View>

      <View style={styles.timeline}>
        {milestones.map((m, i) => (
          <View key={m.id} style={styles.timelineRow}>
            <View style={styles.timelineDotColumn}>
              <View
                style={[
                  styles.timelineDot,
                  { backgroundColor: DOT_COLOR[m.status!] },
                  m.status === 'pending' && styles.timelineDotPending,
                ]}
              />
              {i < milestones.length - 1 ? (
                <View
                  style={[
                    styles.timelineLine,
                    {
                      backgroundColor:
                        m.status === 'complete' ? colors.primary : colors.outlineVariant,
                    },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.timelineText}>
              <Text
                style={[
                  styles.timelineLabel,
                  m.status === 'pending' && styles.timelineLabelPending,
                ]}>
                {MILESTONE_LABEL[m.milestone_type!]}
              </Text>
              <Text
                style={[
                  styles.timelineDate,
                  m.status === 'in_progress' && { color: colors.secondary },
                ]}>
                {subtitleFor(m)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footnote}>
        estimate only, wide margin until real execution data exists across projects — not a
        guaranteed date
      </Text>

      <Pressable
        onPress={confirmSchedule}
        disabled={isConfirmed || confirming}
        style={[styles.confirmButton, isConfirmed && styles.confirmButtonDone]}>
        <Text style={styles.confirmButtonText}>
          {isConfirmed ? 'Schedule Confirmed ✓' : confirming ? 'Confirming…' : 'Confirm Schedule'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  backLink: {
    alignSelf: 'flex-start',
  },
  backLinkText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  reraCard: {
    backgroundColor: colors.errorContainer,
    borderRadius: 8,
    padding: 11,
  },
  reraText: {
    fontSize: 11,
    color: colors.onError,
  },
  reraBold: {
    fontWeight: '700',
  },
  timeline: {
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timelineDotColumn: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timelineDotPending: {
    borderWidth: 1.5,
    borderColor: colors.outline,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
  },
  timelineText: {
    paddingBottom: 14,
  },
  timelineLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
  },
  timelineLabelPending: {
    color: colors.onSurfaceVariant,
    fontWeight: '400',
  },
  timelineDate: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  footnote: {
    fontSize: 9.5,
    color: colors.outline,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmButtonDone: {
    backgroundColor: colors.secondaryContainer,
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
