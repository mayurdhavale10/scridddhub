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

type TPAReport = components['schemas']['TPAReport'];

type Props = {
  projectId: string;
  onBack: () => void;
  onSeeLitigation: () => void;
};

const LENDER_NAME = 'LIC HFL';
const PERIOD_YEAR = 2026;
const PERIOD_QUARTER = 2;

function formatCr(rupees: number): string {
  return `₹${(rupees / 1e7).toFixed(1)} Cr`;
}

export function TPAReportScreen({
  projectId,
  onBack,
  onSeeLitigation,
}: Props) {
  const [report, setReport] = useState<TPAReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET(
      '/projects/{projectID}/tpa-reports/{lenderName}/{year}/{quarter}',
      {
        params: {
          path: {
            projectID: projectId,
            lenderName: LENDER_NAME,
            year: PERIOD_YEAR,
            quarter: PERIOD_QUARTER,
          },
        },
      },
    );
    if (apiError) {
      setError('No TPA/QPR report generated for this lender and period yet.');
    } else {
      setReport(data ?? null);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const markSubmitted = useCallback(async () => {
    if (!report) return;
    setSubmitting(true);
    const { data, error: apiError } = await api.POST(
      '/tpa-reports/{reportID}/submit',
      { params: { path: { reportID: report.id! } } },
    );
    if (!apiError) {
      setReport(data ?? null);
    }
    setSubmitting(false);
  }, [report]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {error ?? 'No TPA/QPR report generated for this lender and period yet.'}
        </Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const isSubmitted = report.status === 'submitted';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>TPA / QPR Report</Text>
      <Text style={styles.subtitle}>generate, per-lender format</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardHeading}>Lender</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {report.lender_name} · template {report.template_version}
            </Text>
          </View>
        </View>
        <Text style={styles.cardNote}>
          Each lender relationship stores its own report template once, configured at
          onboarding — not auto-detected.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Physical progress (8.4.1 architect cert.)</Text>
          <Text style={styles.rowValue}>{report.physical_progress_pct}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Cost incurred to date</Text>
          <Text style={styles.rowValue}>{formatCr(report.cost_incurred_rupees!)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>DSCR / security cover (8.13)</Text>
          <Text style={[styles.rowValue, { color: colors.primary }]}>
            {report.dscr}x / {report.security_cover_ratio}x
          </Text>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>
            Sales velocity ({report.units_sold}/{report.units_total})
          </Text>
          <Text style={styles.rowValue}>{report.sales_velocity_pct}% sold</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoHeading}>Drafted, not filed automatically</Text>
        <Text style={styles.infoText}>
          The document is assembled from live numbers already certified elsewhere on the
          platform — nothing here is a new number invented for the bank. A finance team
          member reviews and submits it; same "drafts, human sends" discipline as
          everywhere else in this build.
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <View style={styles.previewButton}>
          <Text style={styles.previewButtonText}>Preview PDF</Text>
        </View>
        <Pressable
          onPress={markSubmitted}
          disabled={isSubmitted || submitting}
          style={[
            styles.submitButton,
            isSubmitted && styles.submitButtonDone,
          ]}>
          <Text style={styles.submitButtonText}>
            {isSubmitted ? 'Submitted ✓' : submitting ? 'Submitting…' : 'Mark Submitted'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>
        Honest limit: exact lender templates vary and change — this doesn't guess a
        bank's format, it fills one configured in advance. A brand-new lender
        relationship still needs that template set up once before this screen can
        generate anything for them.
      </Text>

      <Text style={styles.logNote}>submission log kept here → the audit trail, 8.11</Text>

      <Pressable onPress={onSeeLitigation} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>Litigation &amp; Disputes →</Text>
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
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 4,
  },
  cardHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  cardNote: {
    fontSize: 9.5,
    color: colors.onSurfaceVariant,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    flexShrink: 1,
  },
  rowValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
  },
  pill: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  infoCard: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: 8,
    padding: 11,
    gap: 4,
  },
  infoHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSecondaryContainer,
  },
  infoText: {
    fontSize: 10,
    color: colors.onSecondaryContainer,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  previewButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 6,
    paddingVertical: 11,
  },
  previewButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 11,
  },
  submitButtonDone: {
    backgroundColor: colors.secondaryContainer,
  },
  submitButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  footnote: {
    fontSize: 9.5,
    color: colors.outline,
  },
  logNote: {
    fontSize: 10,
    color: colors.outline,
    textAlign: 'center',
    fontStyle: 'italic',
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
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
