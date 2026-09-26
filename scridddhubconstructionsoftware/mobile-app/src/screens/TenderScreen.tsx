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

type Tender = components['schemas']['Tender'];
type TenderBid = components['schemas']['TenderBid'];

type Props = {
  projectId: string;
  onBack: () => void;
  onConfirmSetSchedule: () => void;
};

function formatCr(rupees: number): string {
  return `₹${(rupees / 1e7).toFixed(1)} Cr`;
}

export function TenderScreen({ projectId, onBack, onConfirmSetSchedule }: Props) {
  const [tender, setTender] = useState<Tender | null>(null);
  const [bids, setBids] = useState<TenderBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data: tenders, error: tendersError } = await api.GET(
      '/projects/{projectID}/tenders',
      { params: { path: { projectID: projectId } } },
    );
    if (tendersError || !tenders || tenders.length === 0) {
      setError('No tender in progress for this project yet.');
      return;
    }
    const current = tenders[0];
    setTender(current);
    const { data: bidsData, error: bidsError } = await api.GET(
      '/tenders/{tenderID}/bids',
      { params: { path: { tenderID: current.id! } } },
    );
    if (bidsError) {
      setError('Could not load bids for this tender.');
    } else {
      setBids(bidsData ?? []);
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

  if (error || !tender) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {error ?? 'No tender in progress for this project yet.'}
        </Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Contractor Tendering</Text>
      <Text style={styles.subtitle}>{tender.trade_package}</Text>

      <Text style={styles.hint}>
        selective tendering — 3 shortlisted contractors, technical bid then financial bid, not
        an open public tender
      </Text>

      {bids.map(b => (
        <View
          key={b.id}
          style={[styles.card, b.recommended && styles.cardRecommended]}>
          <View style={styles.cardHeader}>
            <Text style={styles.contractorName}>{b.contractor_name}</Text>
            <Text
              style={[
                styles.bidAmount,
                b.recommended && styles.bidAmountRecommended,
              ]}>
              {formatCr(b.financial_bid_rupees!)}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                technical bid: {b.technical_bid_status}
              </Text>
            </View>
            <Text style={styles.financialLabel}>financial bid</Text>
          </View>
          <Text style={styles.performanceNote}>{b.past_performance_note}</Text>
          {b.recommended ? <Text style={styles.recommendedLabel}>recommended</Text> : null}
        </View>
      ))}

      <Pressable onPress={onConfirmSetSchedule} style={styles.ctaButton}>
        <Text style={styles.ctaButtonText}>Confirm &amp; Set Master Schedule → 11</Text>
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
  hint: {
    fontSize: 9.5,
    color: colors.outline,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderStyle: 'dashed',
    borderRadius: 4,
    padding: 6,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  cardRecommended: {
    borderColor: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  contractorName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  bidAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  bidAmountRecommended: {
    color: colors.primary,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.onSecondaryContainer,
  },
  financialLabel: {
    fontSize: 9,
    color: colors.outline,
  },
  performanceNote: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  recommendedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaButtonText: {
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
