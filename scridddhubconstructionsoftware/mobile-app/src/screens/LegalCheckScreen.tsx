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

type LegalCheck = components['schemas']['LegalCheck'];
type RiskLevel = components['schemas']['RiskLevel'];

type Props = {
  parcelId: string;
  onBack: () => void;
  onDealClosed: () => void;
};

const RISK_STYLE: Record<RiskLevel, { bg: string; text: string }> = {
  low: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer },
  medium: { bg: colors.primaryContainer, text: colors.onPrimaryContainer },
  high: { bg: colors.errorContainer, text: colors.onError },
};

function RiskRow({
  label,
  risk,
  note,
}: {
  label: string;
  risk: RiskLevel;
  note?: string;
}) {
  const style = RISK_STYLE[risk];
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.pill, { backgroundColor: style.bg }]}>
        <Text style={[styles.pillText, { color: style.text }]}>
          {risk}
          {note ? ` — ${note}` : ''}
        </Text>
      </View>
    </View>
  );
}

export function LegalCheckScreen({ parcelId, onBack, onDealClosed }: Props) {
  const [check, setCheck] = useState<LegalCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET(
      '/land-parcels/{parcelID}/legal-check',
      { params: { path: { parcelID: parcelId } } },
    );
    if (apiError) {
      setError('No legal check recorded for this parcel yet.');
    } else {
      setCheck(data ?? null);
    }
  }, [parcelId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const markCleared = useCallback(async () => {
    if (!check) return;
    setClearing(true);
    const { data, error: apiError } = await api.PUT(
      '/land-parcels/{parcelID}/legal-check',
      {
        params: { path: { parcelID: parcelId } },
        body: {
          ownership_risk: check.ownership_risk!,
          ownership_risk_note: check.ownership_risk_note,
          litigation_risk: check.litigation_risk!,
          litigation_risk_note: check.litigation_risk_note,
          encumbrance_risk: check.encumbrance_risk!,
          encumbrance_risk_note: check.encumbrance_risk_note,
          regulatory_risk: check.regulatory_risk!,
          regulatory_risk_note: check.regulatory_risk_note,
          ownership_chain: check.ownership_chain,
          encumbrance_searches: check.encumbrance_searches,
          search_summary_note: check.search_summary_note,
          rera_history: check.rera_history,
          rera_history_summary_note: check.rera_history_summary_note,
          documents: check.documents,
          status: 'cleared',
        },
      },
    );
    setClearing(false);
    if (!apiError && data) {
      setCheck(data);
      onDealClosed();
    }
  }, [check, parcelId, onDealClosed]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !check) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {error ?? 'No legal check recorded for this parcel yet.'}
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

      <Text style={styles.title}>Legal &amp; RERA Check</Text>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Risk Breakdown</Text>
        <View style={styles.card}>
          <RiskRow
            label="Ownership"
            risk={check.ownership_risk!}
            note={check.ownership_risk_note || undefined}
          />
          <RiskRow
            label="Litigation"
            risk={check.litigation_risk!}
            note={check.litigation_risk_note || undefined}
          />
          <RiskRow
            label="Encumbrance"
            risk={check.encumbrance_risk!}
            note={check.encumbrance_risk_note || undefined}
          />
          <RiskRow
            label="Regulatory"
            risk={check.regulatory_risk!}
            note={check.regulatory_risk_note || undefined}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Ownership Chain</Text>
        <View style={styles.card}>
          {(check.ownership_chain ?? []).map((entry, i) => (
            <View key={i} style={styles.chainRow}>
              <View
                style={[
                  styles.chainDot,
                  {
                    backgroundColor: entry.is_final
                      ? colors.primary
                      : colors.outlineVariant,
                  },
                ]}
              />
              <View style={styles.chainTextBlock}>
                <Text style={styles.chainTitle}>{entry.title}</Text>
                <Text style={styles.chainDescription}>{entry.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>
          Encumbrance &amp; Litigation Search
        </Text>
        <View style={styles.card}>
          {(check.encumbrance_searches ?? []).map((item, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{item.search_type}</Text>
              <Text style={item.completed ? styles.checkMark : styles.pendingMark}>
                {item.completed ? '✓' : '…'}
              </Text>
            </View>
          ))}
        </View>
        {check.search_summary_note ? (
          <Text style={styles.summaryNote}>{check.search_summary_note}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>
          Seller / Co-developer RERA History
        </Text>
        <View style={styles.card}>
          {(check.rera_history ?? []).map((entry, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.chainTextBlock}>
                <Text style={styles.chainTitle}>{entry.project_name}</Text>
                <Text style={styles.chainDescription}>
                  {entry.rera_registration_number}
                </Text>
              </View>
              <Text style={styles.deliveryStatus}>{entry.delivery_status}</Text>
            </View>
          ))}
        </View>
        {check.rera_history_summary_note ? (
          <Text style={styles.summaryNote}>
            {check.rera_history_summary_note}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Documents</Text>
        <View style={styles.card}>
          {(check.documents ?? []).map((doc, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{doc.document_type}</Text>
              <Text
                style={
                  doc.status === 'received' ? styles.checkMark : styles.pendingMark
                }>
                {doc.status === 'received' ? '✓' : '…'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.ctaButton, clearing && styles.ctaButtonDisabled]}
        disabled={clearing}
        onPress={check.status === 'cleared' ? onDealClosed : markCleared}>
        <Text style={styles.ctaButtonText}>
          {clearing
            ? 'Updating…'
            : check.status === 'cleared'
              ? 'Deal Closed → Approvals'
              : 'Deal Closed → Start Approvals'}
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
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  rowLabel: {
    fontSize: 12,
    color: colors.onSurface,
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
  checkMark: {
    color: colors.primary,
    fontWeight: '700',
  },
  pendingMark: {
    color: colors.onSurfaceVariant,
    fontWeight: '700',
  },
  chainRow: {
    flexDirection: 'row',
    gap: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  chainDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  chainTextBlock: {
    flex: 1,
    gap: 2,
  },
  chainTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
  },
  chainDescription: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  deliveryStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    textAlign: 'right',
  },
  summaryNote: {
    fontSize: 10,
    color: colors.outline,
    paddingHorizontal: 2,
  },
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
