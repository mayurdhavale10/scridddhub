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

type GSTFiling = components['schemas']['GSTFiling'];
type FilingStatus = components['schemas']['FilingStatus'];

type Props = {
  projectId: string;
  onBack: () => void;
  onSeeTDSFiling: () => void;
};

const PERIOD_YEAR = 2026;
const PERIOD_QUARTER = 2;

function formatLakh(rupees: number): string {
  return `₹${(rupees / 1e5).toFixed(1)}L`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const STATUS_STYLE: Record<FilingStatus, { bg: string; text: string; label: string }> = {
  filed: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer, label: 'filed' },
  draft: { bg: colors.primaryContainer, text: colors.onPrimaryContainer, label: 'draft ready' },
  not_started: { bg: colors.surfaceContainer, text: colors.onSurfaceVariant, label: 'not started' },
};

export function GSTFilingScreen({
  projectId,
  onBack,
  onSeeTDSFiling,
}: Props) {
  const [filing, setFiling] = useState<GSTFiling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET(
      '/projects/{projectID}/gst-filings/{year}/{quarter}',
      {
        params: {
          path: { projectID: projectId, year: PERIOD_YEAR, quarter: PERIOD_QUARTER },
        },
      },
    );
    if (apiError) {
      setError('No GST filing recorded for this quarter yet.');
    } else {
      setFiling(data ?? null);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !filing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {error ?? 'No GST filing recorded for this quarter yet.'}
        </Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const gstr1Style = STATUS_STYLE[filing.gstr1_status!];
  const gstr3bStyle = STATUS_STYLE[filing.gstr3b_status!];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>GST Filing &amp; ITC Reversal</Text>
      <Text style={styles.subtitle}>GSTR-1 / GSTR-3B · Rule 42/43</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>GSTR-1, this period</Text>
          <View style={[styles.pill, { backgroundColor: gstr1Style.bg }]}>
            <Text style={[styles.pillText, { color: gstr1Style.text }]}>
              {gstr1Style.label}
              {filing.gstr1_filed_late === false ? ', on time' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>GSTR-3B, this period</Text>
          <View style={[styles.pill, { backgroundColor: gstr3bStyle.bg }]}>
            <Text style={[styles.pillText, { color: gstr3bStyle.text }]}>
              {gstr3bStyle.label}
              {filing.gstr3b_due_at ? ` · due in ${daysUntil(filing.gstr3b_due_at)}d` : ''}
            </Text>
          </View>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>ITC claimed this period</Text>
          <Text style={styles.rowValue}>{formatLakh(filing.itc_claimed_rupees!)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeading}>Rule 42/43 reversal check</Text>
        <Text style={styles.cardNote}>
          Common ITC apportioned by exempt-vs-taxable turnover this period.
        </Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Exempt-turnover ratio</Text>
          <Text style={styles.rowValue}>{filing.exempt_turnover_ratio_pct}%</Text>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>Common ITC subject to reversal</Text>
          <Text style={[styles.rowValue, { color: colors.error }]}>
            {filing.common_itc_reversal_rupees != null
              ? formatLakh(filing.common_itc_reversal_rupees)
              : '—'}
          </Text>
        </View>
      </View>

      <Text style={styles.footnote}>
        Honest limit: this prepares and reconciles the return data and the reversal
        calculation for review — the actual filing on the GSTN portal is the CA/GST
        practitioner's, same "AI drafts, licensed professional files" discipline as the
        certification packet.
      </Text>

      <Pressable onPress={onSeeTDSFiling} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>TDS Return Filing →</Text>
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
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  cardNote: {
    fontSize: 9.5,
    color: colors.onSurfaceVariant,
    paddingHorizontal: 8,
    paddingBottom: 4,
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
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  footnote: {
    fontSize: 9.5,
    color: colors.outline,
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
