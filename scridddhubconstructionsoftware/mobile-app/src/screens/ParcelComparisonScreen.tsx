import React, { useEffect, useState } from 'react';
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
type PlannedInfrastructureList = components['schemas']['PlannedInfrastructureList'];

type Row = {
  parcel: LandParcel;
  assessment: FeasibilityAssessment | null;
};

// Loaded separately from the rows: a location's first infrastructure lookup geocodes it (1–3 s on
// the free public geocoder), and that must not hold up the rest of the screen.
// 'loading' = in flight; null = the lookup failed; empty items = nothing on the list is nearby.
type InfraState = PlannedInfrastructureList | null | 'loading';

// Why a project is listed when it isn't measured by distance — never shown as if it were measured.
const AREA_MATCH_LABEL: Record<string, string> = {
  taluka: 'serves this parcel’s taluka — no station locations on file yet',
  location_text: 'serves the taluka named in the location — no station locations on file yet',
  resolved_area: 'serves the taluka this location falls in — no station locations on file yet',
};

// The parcel text the geocoder tried first; when what matched differs, only part of it was found.
function usedFallback(parcelLocation: string, matchedQuery: string | undefined): boolean {
  if (!matchedQuery) return false;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/,\s*maharashtra$/, '').trim();
  return norm(parcelLocation) !== norm(matchedQuery);
}

const INFRA_STATUS_LABEL: Record<string, string> = {
  planned: 'Planned',
  under_construction: 'In progress',
  partially_operational: 'Partly open, rest in progress',
  operational: 'Already open',
  // The source page doesn't state a status; it isn't marked open, so it's upcoming in some form.
  unknown: 'Planned / in progress',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "26 Sep 2026" — formatted by hand because Hermes' Intl date support varies by build.
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

type Props = {
  parcelIds: string[];
  onBack: () => void;
};

const COLUMN_WIDTH = 160;
const LABEL_WIDTH = 108;

function formatCrore(rupees: number): string {
  return `₹${(rupees / 1e7).toFixed(1)} Cr`;
}

function formatDelta(current: number, asking: number): string {
  const deltaLakh = (current - asking) / 1e5;
  const sign = deltaLakh >= 0 ? '+' : '-';
  return `${sign}₹${Math.abs(deltaLakh).toFixed(0)}L ${
    deltaLakh >= 0 ? 'over' : 'under'
  }`;
}

export function ParcelComparisonScreen({ parcelIds, onBack }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infra, setInfra] = useState<Record<string, InfraState>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        parcelIds.map(async id => {
          const [{ data: parcel, error: parcelError }, assessmentResult] = await Promise.all([
            api.GET('/land-parcels/{id}', { params: { path: { id } } }),
            api.GET('/land-parcels/{parcelID}/feasibility-assessment', {
              params: { path: { parcelID: id } },
            }),
          ]);
          if (parcelError || !parcel) return null;
          return { parcel, assessment: assessmentResult.data ?? null };
        }),
      );
      if (cancelled) return;
      if (results.some(r => r === null)) {
        setError('Could not load one or more of the selected parcels.');
        return;
      }
      setRows(results as Row[]);
    })();

    // Each parcel's infrastructure fills in on its own as soon as it arrives.
    setInfra(Object.fromEntries(parcelIds.map(id => [id, 'loading' as InfraState])));
    parcelIds.forEach(async id => {
      const { data } = await api.GET('/land-parcels/{parcelID}/planned-infrastructure', {
        params: { path: { parcelID: id } },
      });
      if (!cancelled) {
        setInfra(prev => ({ ...prev, [id]: data ?? null }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [parcelIds]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!rows) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  // The one parcel (if any) worth headlining as "the pick" among whichever were selected — the
  // one with a recorded verdict and the highest margin_pct. Never invented if nothing qualifies.
  const recommended = rows
    .filter(r => r.assessment?.verdict)
    .sort(
      (a, b) => (b.assessment!.margin_pct ?? -Infinity) - (a.assessment!.margin_pct ?? -Infinity),
    )[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Compare Parcels</Text>

      {recommended ? (
        <View style={styles.verdictCard}>
          <View style={styles.verdictHeaderRow}>
            <Text style={styles.verdictHeadline}>
              {recommended.parcel.name} — {recommended.assessment!.verdict}
            </Text>
            {recommended.assessment!.margin_pct != null ? (
              <Text style={styles.verdictMargin}>
                est. margin {recommended.assessment!.margin_pct}%
              </Text>
            ) : null}
          </View>
          {recommended.assessment!.infrastructure_note ? (
            <Text style={styles.verdictReasoning}>
              {recommended.assessment!.infrastructure_note}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Planned Infrastructure</Text>
        {/* Approved projects from the shared list. Distances are straight-line km from where the
            parcel's location resolved to, so the resolved place is always shown alongside. */}
        <View style={styles.card}>
          {rows.map((r, i) => {
            const state = infra[r.parcel.id!] ?? 'loading';
            const loaded = state === 'loading' ? null : state;
            const items = loaded?.items ?? [];
            return (
              <View
                key={r.parcel.id}
                style={[styles.infraParcelBlock, i > 0 && styles.infraParcelBlockDivider]}>
                <Text style={styles.noteCellName}>{r.parcel.name}</Text>
                {state === 'loading' ? (
                  <View style={styles.infraLoading}>
                    <ActivityIndicator size="small" color={colors.onSurfaceVariant} />
                    <Text style={styles.noteText}>Finding nearby infrastructure…</Text>
                  </View>
                ) : loaded === null ? (
                  <Text style={styles.noteText}>Could not load infrastructure.</Text>
                ) : (
                  <>
                    <Text style={styles.infraSource}>
                      {loaded.location
                        ? `Location understood as: ${loaded.location.display_name}`
                        : 'Could not place this location on a map — only taluka matches below.'}
                    </Text>
                    {loaded.location &&
                    usedFallback(r.parcel.location ?? '', loaded.location.matched_query) ? (
                      <Text style={styles.infraSource}>
                        Exact place not found — measured from “
                        {loaded.location.matched_query?.replace(/,\s*Maharashtra$/i, '')}” instead.
                      </Text>
                    ) : null}
                    {items.length === 0 ? (
                      <Text style={styles.noteText}>
                        No approved projects on the list within {loaded.radius_km} km.
                      </Text>
                    ) : null}
                  </>
                )}
                {items.map(item => (
                  <View key={item.project_id} style={styles.infraItem}>
                    <Text style={styles.infraName}>{item.name}</Text>
                    {item.match_basis === 'distance' && item.nearest_point ? (
                      <Text style={styles.infraDistance}>
                        {item.distance_km} km to {item.nearest_point.label}{' '}
                        {item.nearest_point.kind === 'station' ? 'station' : ''}
                        {item.nearest_point.coord_source === 'approximate' ? ' (approx. location)' : ''}
                      </Text>
                    ) : (
                      <Text style={styles.noteText}>
                        {AREA_MATCH_LABEL[item.match_basis ?? ''] ?? ''}
                        {item.area_note ? ` · ${item.area_note}` : ''}
                      </Text>
                    )}
                    <Text style={styles.infraStatus}>
                      {INFRA_STATUS_LABEL[item.status ?? ''] ?? item.status}
                      {item.status === 'operational'
                        ? ''
                        : item.expected_completion
                          ? ` — est. ${item.expected_completion}`
                          : ' — no official date'}
                    </Text>
                    <Pressable onPress={() => item.source_url && Linking.openURL(item.source_url)}>
                      <Text style={styles.infraSource}>
                        {/* Who/what verified it (verified_by) is internal provenance, not shown. */}
                        source: {item.source_name} · updated {formatDate(item.verified_at!)}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })}
          <Text style={styles.infraAttribution}>
            Distances are straight-line, not by road. Map data © OpenStreetMap contributors.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Nearby Registered Transactions</Text>
        <View style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.noteRow}>
              {rows.map(r => (
                <View key={r.parcel.id} style={styles.noteCell}>
                  <Text style={styles.noteCellName} numberOfLines={1}>
                    {r.parcel.name}
                  </Text>
                  <Text style={styles.noteText}>
                    {r.assessment?.comparable_sales_note ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Valuation Summary</Text>
        <View style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.row}>
                <View style={styles.labelCell} />
                {rows.map(r => (
                  <View key={r.parcel.id} style={styles.headerCell}>
                    <Text style={styles.headerCellText} numberOfLines={2}>
                      {r.parcel.name}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.row}>
                <View style={styles.labelCell}>
                  <Text style={styles.labelText}>Asking price</Text>
                </View>
                {rows.map(r => (
                  <View key={r.parcel.id} style={styles.valueCell}>
                    <Text style={styles.valueText}>
                      {r.parcel.cost_rupees != null ? formatCrore(r.parcel.cost_rupees) : 'No price yet'}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.row}>
                <View style={styles.labelCell}>
                  <Text style={styles.labelText}>AI current valuation</Text>
                </View>
                {rows.map(r => (
                  <View key={r.parcel.id} style={styles.valueCell}>
                    <Text style={styles.valueText}>
                      {r.assessment
                        ? formatCrore(r.assessment.current_valuation_rupees!)
                        : 'Not assessed'}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.row}>
                <View style={styles.labelCell}>
                  <Text style={styles.labelText}>vs. asking</Text>
                </View>
                {rows.map(r => (
                  <View key={r.parcel.id} style={styles.valueCell}>
                    <Text style={styles.valueText}>
                      {r.assessment && r.parcel.cost_rupees != null
                        ? formatDelta(
                            r.assessment.current_valuation_rupees!,
                            r.parcel.cost_rupees,
                          )
                        : '—'}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={[styles.row, styles.lastRow]}>
                <View style={styles.labelCell}>
                  <Text style={styles.labelText}>AI future valuation</Text>
                </View>
                {rows.map(r => (
                  <View key={r.parcel.id} style={styles.valueCell}>
                    <Text style={styles.valueText}>
                      {r.assessment
                        ? `${formatCrore(r.assessment.future_valuation_rupees!)} (~${r.assessment.future_valuation_year})`
                        : 'Not assessed'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.summaryStrip}>
            {rows.map(r => (
              <Text key={r.parcel.id} style={styles.summaryStripText}>
                {r.parcel.name}
                {r.assessment?.verdict ? ` — ${r.assessment.verdict}` : ' — not assessed'}
                {r.assessment?.margin_pct != null
                  ? ` (est. margin ${r.assessment.margin_pct}%)`
                  : ''}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        Estimate only — not a guarantee, infra timelines can slip.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: 16,
    gap: 4,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.surface,
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: 8,
    marginBottom: 6,
  },
  section: {
    marginTop: 10,
    gap: 6,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLowest,
    padding: 12,
  },
  verdictCard: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLowest,
    padding: 14,
    marginTop: 4,
    gap: 6,
  },
  verdictHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  verdictHeadline: {
    flexShrink: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.onSurface,
  },
  verdictMargin: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  verdictReasoning: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
  noteRow: {
    flexDirection: 'row',
  },
  noteCell: {
    width: COLUMN_WIDTH,
    paddingRight: 14,
    gap: 3,
  },
  noteCellName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
  },
  noteText: {
    fontSize: 11.5,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
  infraParcelBlock: {
    gap: 6,
  },
  infraParcelBlockDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    marginTop: 10,
    paddingTop: 10,
  },
  infraLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  infraItem: {
    gap: 2,
    marginTop: 2,
  },
  infraName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.onSurface,
  },
  infraStatus: {
    fontSize: 12,
    color: colors.onSurface,
  },
  infraSource: {
    fontSize: 10.5,
    color: colors.outline,
  },
  infraDistance: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primary,
  },
  infraAttribution: {
    fontSize: 9.5,
    color: colors.outline,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  labelCell: {
    width: LABEL_WIDTH,
    paddingVertical: 10,
    paddingRight: 8,
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  headerCell: {
    width: COLUMN_WIDTH,
    paddingVertical: 10,
    paddingRight: 10,
    justifyContent: 'flex-end',
  },
  headerCellText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  valueCell: {
    width: COLUMN_WIDTH,
    paddingVertical: 10,
    paddingRight: 10,
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  summaryStrip: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    marginTop: 8,
    paddingTop: 8,
    gap: 4,
  },
  summaryStripText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  disclaimer: {
    fontSize: 10,
    color: colors.outline,
    fontStyle: 'italic',
    marginTop: 14,
  },
});
