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

type TDSFiling = components['schemas']['TDSFiling'];

type Props = {
  projectId: string;
  onBack: () => void;
  onSeeTPAReport: () => void;
};

const PERIOD_YEAR = 2026;
const PERIOD_QUARTER = 2;
const URGENT_DAYS_THRESHOLD = 7;

function formatLakh(rupees: number): string {
  return `₹${(rupees / 1e5).toFixed(2)}L`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function TDSFilingScreen({ projectId, onBack, onSeeTPAReport }: Props) {
  const [filing, setFiling] = useState<TDSFiling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET(
      '/projects/{projectID}/tds-filings/{year}/{quarter}',
      {
        params: {
          path: { projectID: projectId, year: PERIOD_YEAR, quarter: PERIOD_QUARTER },
        },
      },
    );
    if (apiError) {
      setError('No TDS filing recorded for this quarter yet.');
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
          {error ?? 'No TDS filing recorded for this quarter yet.'}
        </Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const urgentDeductions = (filing.section194j_by_professional ?? []).filter(
    d => d.deposit_status === 'pending_deposit' && d.deposit_due_at && daysUntil(d.deposit_due_at) <= URGENT_DAYS_THRESHOLD,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>TDS Return Filing</Text>
      <Text style={styles.subtitle}>Form 26Q · Sections 194C &amp; 194J</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Q{filing.period_quarter} 26Q, this quarter</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {filing.form26q_status}
              {filing.form26q_due_at ? ` · due in ${daysUntil(filing.form26q_due_at)}d` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>194C deducted, this quarter</Text>
          <Text style={styles.rowValue}>
            {formatLakh(filing.section194c_deducted_rupees!)}
          </Text>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>194J deducted, this quarter</Text>
          <Text style={styles.rowValue}>
            {formatLakh(filing.section194j_deducted_rupees!)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeading}>194J — by professional</Text>
        {(filing.section194j_by_professional ?? []).map((d, i) => {
          const urgent =
            d.deposit_status === 'pending_deposit' &&
            d.deposit_due_at &&
            daysUntil(d.deposit_due_at) <= URGENT_DAYS_THRESHOLD;
          return (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{d.payee_name}</Text>
              <Text
                style={[
                  styles.rowValue,
                  { color: urgent ? colors.error : colors.onSurface },
                ]}>
                {formatLakh(d.amount_rupees!)} ·{' '}
                {d.deposit_status === 'deposited' ? 'deposited' : 'pending deposit'}
              </Text>
            </View>
          );
        })}
      </View>

      {urgentDeductions.length > 0 ? (
        <View style={styles.flagBanner}>
          <Text style={styles.flagBannerText}>
            ⚠ {urgentDeductions[0].payee_name}'s deduction is{' '}
            {daysUntil(urgentDeductions[0].deposit_due_at!)} days from the deposit
            deadline — miss it and Section 201 interest starts accruing at 1.5%/month from
            the deduction date, not the deadline.
          </Text>
        </View>
      ) : null}

      <Text style={styles.footnote}>
        Honest limit: the 26Q filing itself happens on the TRACES/income-tax portal, done
        by the CA or a TDS return preparer — this screen prepares and tracks the data, it
        doesn't file on its own.
      </Text>

      <Pressable onPress={onSeeTPAReport} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>TPA / QPR Report →</Text>
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
    gap: 8,
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
  },
  pill: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  flagBanner: {
    backgroundColor: colors.errorContainer,
    borderRadius: 8,
    padding: 10,
  },
  flagBannerText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.onError,
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
