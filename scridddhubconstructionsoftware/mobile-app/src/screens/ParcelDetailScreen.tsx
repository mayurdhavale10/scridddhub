import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type LandParcel = components['schemas']['LandParcel'];
type FeasibilityAssessment = components['schemas']['FeasibilityAssessment'];

type Props = {
  parcelId: string;
  onBack: () => void;
  onSeeLegalCheck: () => void;
};

function formatCrore(rupees: number): string {
  return `₹${(rupees / 1e7).toFixed(1)} Cr`;
}

function formatDelta(current: number, asking: number): string {
  const deltaLakh = (current - asking) / 1e5;
  const sign = deltaLakh >= 0 ? '+' : '-';
  return `(${sign}₹${Math.abs(deltaLakh).toFixed(0)}L ${
    deltaLakh >= 0 ? 'over' : 'under'
  } asking)`;
}

// A "just checking a location" parcel (Screen 4.2) may have no recorded area and/or price.
function formatSpecs(areaAcres: number | null | undefined, costRupees: number | null | undefined): string {
  const area = areaAcres != null ? `${areaAcres} acres` : 'area unknown';
  const cost = costRupees != null ? formatCrore(costRupees) : 'no price yet';
  return `${area} · ${cost}`;
}

function formatVerifiedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ParcelDetailScreen({
  parcelId,
  onBack,
  onSeeLegalCheck,
}: Props) {
  const [parcel, setParcel] = useState<LandParcel | null>(null);
  const [assessment, setAssessment] = useState<FeasibilityAssessment | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ reachable: boolean } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [{ data: parcelData, error: parcelError }, assessmentResult] =
      await Promise.all([
        api.GET('/land-parcels/{id}', { params: { path: { id: parcelId } } }),
        api.GET('/land-parcels/{parcelID}/feasibility-assessment', {
          params: { path: { parcelID: parcelId } },
        }),
      ]);

    if (parcelError) {
      setError('Could not load this parcel.');
      return;
    }
    setParcel(parcelData ?? null);
    // A parcel with no assessment yet is a valid, unremarkable state (not every parcel has
    // been through feasibility analysis) — only a real parcel-load failure is an error.
    setAssessment(assessmentResult.data ?? null);
  }, [parcelId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // On-demand only — a real HTTP reachability check against the parcel's own recorded
  // source_url, triggered only when someone taps "Verify". Never a content scrape, never run
  // automatically.
  const verifySource = useCallback(async () => {
    setVerifying(true);
    setVerifyResult(null);
    const { data } = await api.POST('/land-parcels/{id}/verify-source', {
      params: { path: { id: parcelId } },
    });
    setVerifying(false);
    if (data) {
      setVerifyResult({ reachable: data.reachable });
      if (data.parcel) {
        setParcel(data.parcel);
      }
    }
  }, [parcelId]);

  const moveToNegotiating = useCallback(async () => {
    setUpdatingStage(true);
    const { error: apiError } = await api.PATCH('/land-parcels/{id}/stage', {
      params: { path: { id: parcelId } },
      body: { stage: 'negotiating' },
    });
    setUpdatingStage(false);
    if (!apiError) {
      onBack();
    }
  }, [parcelId, onBack]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !parcel) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Parcel not found.'}</Text>
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

      <Text style={styles.title}>{parcel.name}</Text>
      <Text style={styles.specs}>
        {formatSpecs(parcel.area_acres, parcel.cost_rupees)}
        {parcel.fsi ? ` · FSI ${parcel.fsi}` : ''}
      </Text>

      {parcel.source ? (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Source</Text>
          <View style={styles.card}>
            <Text style={styles.cardLine}>{parcel.source}</Text>
            {parcel.source_url ? (
              <Pressable onPress={() => Linking.openURL(parcel.source_url!)}>
                <Text style={styles.sourceLinkText} numberOfLines={1}>
                  {parcel.source_url}
                </Text>
              </Pressable>
            ) : null}
            {parcel.source_url ? (
              <>
                <Text style={styles.cardLine}>
                  {parcel.source_verified_at
                    ? `✓ Verified ${formatVerifiedAt(parcel.source_verified_at)}`
                    : 'Not verified yet'}
                </Text>
                <Pressable
                  onPress={verifySource}
                  disabled={verifying}
                  style={[styles.verifyButton, verifying && styles.ctaButtonDisabled]}>
                  {verifying ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Text style={styles.verifyButtonText}>
                      {parcel.source_verified_at ? 'Verify again' : 'Verify'}
                    </Text>
                  )}
                </Pressable>
                {verifyResult && !verifyResult.reachable ? (
                  <Text style={styles.verifyFailedText}>
                    Could not reach this link just now — it may be down, or the URL may be wrong.
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      ) : null}

      {assessment ? (
        <>
          <View style={styles.verdictCard}>
            <Text style={styles.verdictText}>{assessment.verdict}</Text>
            {assessment.margin_pct != null ? (
              <Text style={styles.marginText}>
                est. margin {assessment.margin_pct}%
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Valuation</Text>
            <View style={styles.card}>
              <Text style={styles.cardLine}>
                AI current valuation: {formatCrore(assessment.current_valuation_rupees!)}
                {parcel.cost_rupees != null
                  ? ` ${formatDelta(assessment.current_valuation_rupees!, parcel.cost_rupees)}`
                  : ' (no asking price recorded to compare against)'}
              </Text>
              <Text style={styles.cardLine}>
                AI future valuation (~{assessment.future_valuation_year}):{' '}
                {formatCrore(assessment.future_valuation_rupees!)}
              </Text>
            </View>
          </View>

          {assessment.infrastructure_note ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Planned Infrastructure</Text>
              <View style={styles.card}>
                <Text style={styles.cardLine}>
                  {assessment.infrastructure_note}
                </Text>
              </View>
            </View>
          ) : null}

          {assessment.comparable_sales_note ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                Nearby Registered Transactions
              </Text>
              <View style={styles.card}>
                <Text style={styles.cardLine}>
                  {assessment.comparable_sales_note}
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.disclaimer}>
            Estimate only — not a guarantee, infra timelines can slip.
          </Text>
        </>
      ) : (
        <Text style={styles.emptyText}>
          No feasibility assessment recorded for this parcel yet.
        </Text>
      )}

      <Pressable onPress={onSeeLegalCheck} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>See Legal Check →</Text>
      </Pressable>

      <Pressable
        style={[styles.ctaButton, updatingStage && styles.ctaButtonDisabled]}
        disabled={updatingStage || parcel.stage === 'negotiating'}
        onPress={moveToNegotiating}>
        <Text style={styles.ctaButtonText}>
          {parcel.stage === 'negotiating'
            ? 'Already negotiating'
            : updatingStage
              ? 'Updating…'
              : 'Move to Negotiating'}
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
  secondaryLink: {
    alignSelf: 'center',
    marginTop: 4,
  },
  secondaryLinkText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.onSurface,
  },
  specs: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  verdictCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 8,
    padding: 13,
    gap: 4,
  },
  verdictText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  marginText: {
    fontSize: 12,
    color: colors.onPrimaryContainer,
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
    padding: 12,
    gap: 4,
  },
  cardLine: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  sourceLinkText: {
    fontSize: 11.5,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  verifyButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2,
  },
  verifyButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primary,
  },
  verifyFailedText: {
    fontSize: 11,
    color: colors.error,
  },
  disclaimer: {
    fontSize: 10,
    color: colors.outline,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
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
