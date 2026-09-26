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

type LandTenure = components['schemas']['LandTenure'];
type TenureType = components['schemas']['TenureType'];

type Props = {
  projectId: string;
  onBack: () => void;
  onSeeFinancialStructure: () => void;
};

function formatCrore(rupees: number): string {
  return `₹${(rupees / 1e7).toFixed(1)} Cr`;
}

export function LandTenureScreen({
  projectId,
  onBack,
  onSeeFinancialStructure,
}: Props) {
  const [tenure, setTenure] = useState<LandTenure | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET('/projects/{projectID}/land-tenure', {
      params: { path: { projectID: projectId } },
    });
    if (apiError) {
      setError('No land tenure recorded for this project yet.');
    } else {
      setTenure(data ?? null);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const setTenureType = useCallback(
    async (tenureType: TenureType) => {
      setSaving(true);
      const { data, error: apiError } = await api.PUT('/projects/{projectID}/land-tenure', {
        params: { path: { projectID: projectId } },
        body:
          tenureType === 'outright'
            ? { tenure_type: 'outright' }
            : {
                tenure_type: 'jda',
                jda_model: tenure?.jda_model || 'area_sharing',
                developer_area_share_pct: tenure?.developer_area_share_pct ?? 62,
                cash_on_top_of_share: tenure?.cash_on_top_of_share ?? false,
                refundable_security_deposit_rupees:
                  tenure?.refundable_security_deposit_rupees ?? undefined,
                jda_stamp_duty_rupees: tenure?.jda_stamp_duty_rupees ?? undefined,
                gst_reverse_charge_applicable: tenure?.gst_reverse_charge_applicable ?? true,
                landowner_is_co_promoter: tenure?.landowner_is_co_promoter ?? true,
              },
      });
      setSaving(false);
      if (!apiError && data) {
        setTenure(data);
        setError(null);
      }
    },
    [projectId, tenure],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const isJDA = tenure?.tenure_type === 'jda';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Land Tenure &amp; JDA Structure</Text>
      <Text style={styles.subtitle}>resolving the parked gap</Text>

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleOption, !isJDA && styles.toggleOptionSelected]}
          disabled={saving}
          onPress={() => setTenureType('outright')}>
          <Text
            style={[styles.toggleText, !isJDA && styles.toggleTextSelected]}>
            Outright purchase
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleOption, isJDA && styles.toggleOptionSelected]}
          disabled={saving}
          onPress={() => setTenureType('jda')}>
          <Text style={[styles.toggleText, isJDA && styles.toggleTextSelected]}>
            JDA
          </Text>
        </Pressable>
      </View>

      {error && !tenure ? <Text style={styles.errorText}>{error}</Text> : null}

      {isJDA && tenure ? (
        <>
          <View style={styles.card}>
            <View style={styles.kv}>
              <Text style={styles.kvLabel}>JDA model</Text>
              <Text style={styles.kvValue}>{tenure.jda_model}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvLabel}>Area share — developer : landowner</Text>
              <Text style={styles.kvValue}>
                {tenure.developer_area_share_pct} : {tenure.landowner_area_share_pct}
              </Text>
            </View>
            <View style={[styles.kv, styles.kvLast]}>
              <Text style={styles.kvLabel}>Cash on top of share?</Text>
              <Text style={styles.kvValue}>
                {tenure.cash_on_top_of_share ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            {tenure.refundable_security_deposit_rupees != null ? (
              <View style={styles.kv}>
                <Text style={styles.kvLabel}>
                  Refundable security deposit to landowner
                </Text>
                <Text style={styles.kvValue}>
                  {formatCrore(tenure.refundable_security_deposit_rupees)}
                </Text>
              </View>
            ) : null}
            {tenure.jda_stamp_duty_rupees != null ? (
              <View style={[styles.kv, styles.kvLast]}>
                <Text style={styles.kvLabel}>Stamp duty + registration on the JDA</Text>
                <Text style={styles.kvValue}>
                  {formatCrore(tenure.jda_stamp_duty_rupees)}
                </Text>
              </View>
            ) : null}
          </View>

          {tenure.landowner_is_co_promoter ? (
            <Text style={styles.note}>
              Landowner is disclosed as a co-promoter under RERA — feeds the Legal Check and
              RERA registration steps.
            </Text>
          ) : null}
        </>
      ) : null}

      <Pressable onPress={onSeeFinancialStructure} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>Financial Structuring →</Text>
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
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
  },
  toggleOptionSelected: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  toggleTextSelected: {
    color: colors.onPrimary,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    gap: 8,
  },
  kvLast: {
    borderBottomWidth: 0,
  },
  kvLabel: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    flexShrink: 1,
  },
  kvValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
  },
  note: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
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
