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

type LenderCovenant = components['schemas']['LenderCovenant'];

type Props = {
  projectId: string;
  onBack: () => void;
  onSeeAccountingSync: () => void;
};

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function Row({
  label,
  value,
  breached,
}: {
  label: string;
  value: string;
  breached: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: breached ? colors.error : colors.primary },
        ]}>
        {value}
      </Text>
    </View>
  );
}

export function LenderCovenantScreen({
  projectId,
  onBack,
  onSeeAccountingSync,
}: Props) {
  const [covenant, setCovenant] = useState<LenderCovenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET(
      '/projects/{projectID}/lender-covenant',
      { params: { path: { projectID: projectId } } },
    );
    if (apiError) {
      setError('No lender covenant tracked for this project yet.');
    } else {
      setCovenant(data ?? null);
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

  if (error || !covenant) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {error ?? 'No lender covenant tracked for this project yet.'}
        </Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const days = daysUntil(covenant.next_tpa_report_due_at!);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Lender Covenant Tracker</Text>
      <Text style={styles.subtitle}>construction finance</Text>

      {covenant.any_breach ? (
        <View style={styles.breachBanner}>
          <Text style={styles.breachBannerText}>
            ⚠ A covenant is breached — flagged here, not discovered when the next
            drawdown is unexpectedly frozen.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Row
          label="DSCR (Debt Service Coverage)"
          value={`${covenant.dscr}x · covenant ≥${covenant.dscr_covenant_min}x`}
          breached={covenant.dscr_breached!}
        />
        <Row
          label="Security cover ratio"
          value={`${covenant.security_cover_ratio}x · covenant ≥${covenant.security_cover_covenant_min}x`}
          breached={covenant.security_cover_breached!}
        />
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>Next TPA / QPR report due</Text>
          <Text
            style={[
              styles.rowValue,
              { color: days <= 7 ? colors.error : colors.onSurface },
            ]}>
            {days >= 0 ? `${days} days` : `${-days} days overdue`}
          </Text>
        </View>
      </View>

      <Text style={styles.footnote}>
        Each drawdown request pulls from the certification packet's Committed-vs-Actual
        figures, so the TPA-equivalent report is generated from the same numbers the CA
        already certified — not a second, separately-maintained set.
      </Text>

      <Pressable onPress={onSeeAccountingSync} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>Accounting Sync →</Text>
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
  breachBanner: {
    backgroundColor: colors.errorContainer,
    borderRadius: 8,
    padding: 10,
  },
  breachBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onError,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
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
  footnote: {
    fontSize: 9.5,
    color: colors.outline,
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
