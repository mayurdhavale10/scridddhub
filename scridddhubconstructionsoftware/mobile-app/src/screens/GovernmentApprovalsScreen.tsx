import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type Approval = components['schemas']['LandParcelApproval'];
type ApprovalStatus = components['schemas']['ApprovalStatus'];

type Props = {
  parcelId: string;
  onBack: () => void;
  onSeeLandTenure: () => void;
};

const STATUS_STYLE: Record<ApprovalStatus, { bg: string; text: string; label: string }> = {
  approved: { bg: colors.primaryContainer, text: colors.onPrimaryContainer, label: 'Approved' },
  submitted: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer, label: 'Submitted' },
  not_started: { bg: colors.surfaceContainer, text: colors.onSurfaceVariant, label: 'Not Started' },
  not_applicable: { bg: colors.surfaceContainer, text: colors.outline, label: 'N/A' },
  not_yet_due: { bg: colors.surfaceContainer, text: colors.outline, label: 'Not Yet Due' },
};

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function GovernmentApprovalsScreen({
  parcelId,
  onBack,
  onSeeLandTenure,
}: Props) {
  const [freeText, setFreeText] = useState('');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [summaryResult, approvalsResult] = await Promise.all([
      api.GET('/land-parcels/{parcelID}/site-summary', {
        params: { path: { parcelID: parcelId } },
      }),
      api.GET('/land-parcels/{parcelID}/approvals', {
        params: { path: { parcelID: parcelId } },
      }),
    ]);
    if (summaryResult.data) {
      setFreeText(summaryResult.data.free_text ?? '');
    }
    if (approvalsResult.error) {
      setError('Could not load approvals.');
    } else {
      setApprovals(approvalsResult.data ?? []);
    }
  }, [parcelId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const analyze = useCallback(async () => {
    if (!freeText.trim()) return;
    setAnalyzing(true);
    setError(null);
    const { data, error: apiError } = await api.POST(
      '/land-parcels/{parcelID}/approvals/analyze',
      {
        params: { path: { parcelID: parcelId } },
        body: { free_text: freeText },
      },
    );
    setAnalyzing(false);
    if (apiError) {
      setError('Could not analyze this description.');
    } else {
      setApprovals(data ?? []);
    }
  }, [freeText, parcelId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const applicable = approvals.filter(a => a.status !== 'not_applicable');
  const approvedCount = applicable.filter(a => a.status === 'approved').length;
  const pct = applicable.length > 0 ? Math.round((approvedCount / applicable.length) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Government Approvals</Text>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Tell Us About Your Project</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.textInput}
            multiline
            value={freeText}
            onChangeText={setFreeText}
            placeholder="Describe the plot, site conditions, and unit count..."
            placeholderTextColor={colors.outline}
          />
          <Pressable
            onPress={analyze}
            disabled={analyzing || !freeText.trim()}
            style={styles.analyzeButton}>
            <Text style={styles.analyzeButtonText}>
              {analyzing ? 'Analyzing…' : 'Re-analyze ↻'}
            </Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {applicable.length > 0 ? (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              {approvedCount} of {applicable.length} approved
            </Text>
            <Text style={styles.progressPct}>{pct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Required Sequence</Text>
        <View style={styles.card}>
          {approvals.map(a => {
            const style = STATUS_STYLE[a.status!];
            return (
              <View key={a.id} style={styles.row}>
                <View style={styles.rowTextBlock}>
                  <Text style={styles.rowLabel}>{a.approval_name}</Text>
                  {a.description ? (
                    <Text style={styles.rowNote}>{a.description}</Text>
                  ) : a.applicability_condition ? (
                    <Text style={styles.rowNote}>
                      {a.status === 'not_applicable' ? 'excluded' : 'included'} — based on your
                      project summary
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.pill, { backgroundColor: style.bg }]}>
                  <Text style={[styles.pillText, { color: style.text }]}>
                    {style.label}
                    {a.status === 'submitted' && a.submitted_at
                      ? ` · ${daysAgo(a.submitted_at)}d`
                      : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        <Text style={styles.disclaimer}>
          Sequence from the maintained playbook — not a speed guarantee, department timelines
          vary.
        </Text>
      </View>

      <Pressable onPress={onSeeLandTenure} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>Land Tenure &amp; JDA Structure →</Text>
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
    fontSize: 19,
    fontWeight: '700',
    color: colors.onSurface,
  },
  section: {
    gap: 6,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 4,
  },
  textInput: {
    fontSize: 12,
    color: colors.onSurface,
    padding: 8,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  analyzeButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  analyzeButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  progressCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceContainer,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  rowTextBlock: {
    flex: 1,
    gap: 2,
    paddingRight: 8,
  },
  rowLabel: {
    fontSize: 12,
    color: colors.onSurface,
  },
  rowNote: {
    fontSize: 9,
    color: colors.primary,
  },
  pill: {
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 10,
    color: colors.outline,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
  },
  secondaryLink: {
    alignSelf: 'center',
    marginTop: 4,
  },
  secondaryLinkText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
});
