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

type FinancialStructure = components['schemas']['FinancialStructure'];

type Props = {
  projectId: string;
  onBack: () => void;
  onSeeEscrowAccount: () => void;
};

function formatCrore(rupees: number): string {
  return `₹${(rupees / 1e7).toFixed(0)} Cr`;
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function Row({
  label,
  meta,
  amount,
  percent,
}: {
  label: string;
  meta: string;
  amount: number;
  percent: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTextBlock}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      <View style={styles.rowAmountBlock}>
        <Text style={styles.rowAmount}>{formatCrore(amount)}</Text>
        <Text style={styles.rowPct}>{percent}</Text>
      </View>
    </View>
  );
}

export function FinancialStructureScreen({
  projectId,
  onBack,
  onSeeEscrowAccount,
}: Props) {
  const [structure, setStructure] = useState<FinancialStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET(
      '/projects/{projectID}/financial-structure',
      { params: { path: { projectID: projectId } } },
    );
    if (apiError) {
      setError('No financial structure recorded for this project yet.');
    } else {
      setStructure(data ?? null);
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

  if (error || !structure) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {error ?? 'No financial structure recorded for this project yet.'}
        </Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const totalSources = structure.total_sources_rupees!;
  const totalUses = structure.total_uses_rupees!;
  const otherUses =
    structure.land_use_rupees! +
    structure.approvals_use_rupees! +
    structure.marketing_use_rupees! +
    structure.working_capital_use_rupees!;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Financial Structuring</Text>
      <Text style={styles.subtitle}>Sources &amp; Uses, {formatCrore(totalSources)}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Sources — where the money comes from</Text>
        <View style={styles.card}>
          <Row
            label="Buyer Collections"
            meta="tied to sales pace"
            amount={structure.buyer_collections_rupees!}
            percent={pct(structure.buyer_collections_rupees!, totalSources)}
          />
          <Row
            label="Promoter Equity"
            meta="already infused"
            amount={structure.promoter_equity_rupees!}
            percent={pct(structure.promoter_equity_rupees!, totalSources)}
          />
          <Row
            label="Construction Finance"
            meta="bank backup, undrawn"
            amount={structure.construction_finance_rupees!}
            percent={pct(structure.construction_finance_rupees!, totalSources)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Uses — where it actually goes</Text>
        <View style={styles.card}>
          <Row
            label="Construction"
            meta="escrow-gated by RERA"
            amount={structure.construction_use_rupees!}
            percent={pct(structure.construction_use_rupees!, totalUses)}
          />
          <Row
            label="Land, Approvals, Marketing & Working Capital"
            meta="promoter-funded, unrestricted"
            amount={otherUses}
            percent={pct(otherUses, totalUses)}
          />
        </View>
        <Text
          style={[
            styles.balanceText,
            { color: structure.balanced ? colors.primary : colors.error },
          ]}>
          Sources {formatCrore(totalSources)} {structure.balanced ? '=' : '≠'} Uses{' '}
          {formatCrore(totalUses)} {structure.balanced ? '— ✓ balanced' : '— not balanced'}
        </Text>
      </View>

      <Pressable onPress={onSeeEscrowAccount} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>Escrow — Bank-Verified →</Text>
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
  section: {
    gap: 6,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
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
  },
  rowTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
  },
  rowMeta: {
    fontSize: 9.5,
    color: colors.onSurfaceVariant,
  },
  rowAmountBlock: {
    alignItems: 'flex-end',
  },
  rowAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  rowPct: {
    fontSize: 9.5,
    color: colors.onSurfaceVariant,
  },
  balanceText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: 24,
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
