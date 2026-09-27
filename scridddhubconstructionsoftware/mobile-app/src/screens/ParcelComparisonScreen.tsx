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
type PlannedInfrastructureList =
  components['schemas']['PlannedInfrastructureList'];

type Row = {
  parcel: LandParcel;
  assessment: FeasibilityAssessment | null;
};

// Loaded separately from the rows: a location's first infrastructure lookup geocodes it (1–3 s on
// the free public geocoder), and that must not hold up the rest of the screen.
// 'loading' = in flight; null = the lookup failed; empty items = nothing on the list is nearby.
type InfraState = PlannedInfrastructureList | null | 'loading';

type InfraItem = NonNullable<PlannedInfrastructureList['items']>[number];

// Where the project is relative to the parcel, in plain words. Approximate station positions read
// as "About X km"; projects matched by area rather than a measured distance never show a number.
function whereText(item: InfraItem): string {
  const p = item.nearest_point;
  if (item.match_basis === 'distance' && p && item.distance_km != null) {
    const place = p.kind === 'station' ? `${p.label} station` : p.label;
    const approx = p.coord_source === 'approximate';
    return `${approx ? 'About ' : ''}${item.distance_km} km from ${place}`;
  }
  return 'Serves this area';
}

function statusText(item: InfraItem): string {
  const status = INFRA_STATUS_LABEL[item.status ?? ''] ?? item.status ?? '';
  if (item.status === 'operational') return status;
  return item.expected_completion
    ? `${status} · Expected ${item.expected_completion}`
    : `${status} · Completion date not announced`;
}

// "MMRDA — official project page" -> "MMRDA"
function sourceAgency(name: string | undefined): string {
  return (name ?? '').split(' — ')[0].trim() || 'Official source';
}

const INFRA_STATUS_LABEL: Record<string, string> = {
  planned: 'Planned',
  under_construction: 'In progress',
  partially_operational: 'Partly open, rest in progress',
  operational: 'Already open',
  // The source page doesn't state a status; it isn't marked open, so it's upcoming in some form.
  unknown: 'Planned / in progress',
};

// Display order and labels for the infrastructure groups (backend domain/infrastructure_kinds.go).
const INFRA_GROUPS: { category: string; label: string }[] = [
  { category: 'connectivity', label: 'Connectivity' },
  { category: 'jobs', label: 'Jobs & growth' },
  { category: 'social', label: 'Schools & hospitals' },
  { category: 'utilities', label: 'Utilities' },
  { category: 'planning', label: 'Planning & zoning' },
  { category: 'negative', label: 'Watch out' },
];

// Nearest few per group; the rest sit behind "See all".
const INFRA_PER_GROUP = 3;

type ExistingPlace = NonNullable<PlannedInfrastructureList['existing']>[number];

// A group's rows: planned projects first (they're what moves value), then places already there.
type InfraRow = { planned: InfraItem } | { existing: ExistingPlace };

// Nearest of each kind first, then the rest by distance — so a dozen nearby hospitals don't
// push the one school out of the first three.
function orderExisting(places: ExistingPlace[]): ExistingPlace[] {
  const seen = new Set<string>();
  const firsts: ExistingPlace[] = [];
  const rest: ExistingPlace[] = [];
  for (const p of places) {
    const kind = p.kind ?? '';
    if (seen.has(kind)) rest.push(p);
    else {
      seen.add(kind);
      firsts.push(p);
    }
  }
  return [...firsts, ...rest];
}

function groupInfra(
  items: InfraItem[],
  existing: ExistingPlace[],
): { category: string; label: string; rows: InfraRow[] }[] {
  return INFRA_GROUPS.map(g => ({
    ...g,
    rows: [
      ...items
        .filter(it => (it.category ?? 'connectivity') === g.category)
        .map(planned => ({ planned })),
      ...orderExisting(existing.filter(p => p.category === g.category)).map(
        p => ({ existing: p }),
      ),
    ],
  })).filter(g => g.rows.length > 0);
}

const EXISTING_KIND_LABEL: Record<string, string> = {
  school: 'School',
  college: 'College',
  hospital: 'Hospital',
  industrial_estate: 'Industrial area',
  power_substation: 'Power substation',
  water_supply: 'Water works',
  landfill: 'Landfill',
  sewage_treatment: 'Sewage plant',
  high_tension_line: 'Power line',
};

// "School · 0.6 km away". The kind is dropped when the name already says it (unnamed plants and
// lines are labelled by kind on the server), and distances round to 0 read "Under 100 m".
function existingWhereText(p: ExistingPlace): string {
  const km = p.distance_km ?? 0;
  const distance = km < 0.1 ? 'Under 100 m away' : `${km} km away`;
  const kind = EXISTING_KIND_LABEL[p.kind ?? ''];
  const nameSaysKind =
    !kind || (p.name ?? '').toLowerCase().includes(kind.toLowerCase().split(' ')[0]);
  return nameSaysKind ? distance : `${kind} · ${distance}`;
}

type Coverage = NonNullable<PlannedInfrastructureList['coverage']>;

// Step C: when nothing is measured nearby, say what's being done about it rather than a bare "none".
function coverageText(c: Coverage, radiusKm: number | undefined): string {
  const within = radiusKm ? ` within ${radiusKm} km` : '';
  switch (c.status) {
    case 'queued':
    case 'searching':
      return `Searching official sources for projects around here — check back later.`;
    case 'searched':
      // projects_found counts every project the search turned up, not only nearby ones — so it
      // must not be described as "nearby" (they appear here once reviewed, if within range).
      if ((c.projects_found ?? 0) > 0) {
        const n = c.projects_found ?? 0;
        const when = c.last_searched_at
          ? ` on ${formatDate(c.last_searched_at)}`
          : '';
        return `Searched official sources${when}: ${n} new project${
          n === 1 ? '' : 's'
        } found, awaiting review. Nothing approved${within} yet.`;
      }
      return c.last_searched_at
        ? `Checked official sources on ${formatDate(
            c.last_searched_at,
          )}: nothing planned${within}.`
        : `Checked official sources: nothing planned${within}.`;
    default:
      return `Couldn't search this area yet — it will be retried.`;
  }
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

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
  // "<parcelId>:<category>" groups the user has expanded past the nearest few.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        parcelIds.map(async id => {
          const [{ data: parcel, error: parcelError }, assessmentResult] =
            await Promise.all([
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
    setInfra(
      Object.fromEntries(parcelIds.map(id => [id, 'loading' as InfraState])),
    );
    parcelIds.forEach(async id => {
      const { data } = await api.GET(
        '/land-parcels/{parcelID}/planned-infrastructure',
        {
          params: { path: { parcelID: id } },
        },
      );
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
      (a, b) =>
        (b.assessment!.margin_pct ?? -Infinity) -
        (a.assessment!.margin_pct ?? -Infinity),
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
            const existing = loaded?.existing ?? [];
            return (
              <View
                key={r.parcel.id}
                style={[
                  styles.infraParcelBlock,
                  i > 0 && styles.infraParcelBlockDivider,
                ]}
              >
                <Text style={styles.noteCellName}>{r.parcel.name}</Text>
                {state === 'loading' ? (
                  <View style={styles.infraLoading}>
                    <ActivityIndicator
                      size="small"
                      color={colors.onSurfaceVariant}
                    />
                    <Text style={styles.noteText}>
                      Finding nearby infrastructure…
                    </Text>
                  </View>
                ) : loaded === null ? (
                  <Text style={styles.noteText}>
                    Could not load infrastructure.
                  </Text>
                ) : (
                  <>
                    {/* How the location was geocoded (resolved place, partial matches) is internal —
                        it stays in the API response for debugging but is never shown to users. */}
                    {items.length === 0 &&
                    existing.length === 0 &&
                    !loaded.coverage ? (
                      <Text style={styles.infraEmpty}>
                        No projects on file within {loaded.radius_km} km yet.
                      </Text>
                    ) : null}
                    {loaded.coverage ? (
                      <Text style={styles.infraEmpty}>
                        {coverageText(loaded.coverage, loaded.radius_km)}
                      </Text>
                    ) : null}
                  </>
                )}
                {groupInfra(items, existing).map(group => {
                  const key = `${r.parcel.id}:${group.category}`;
                  const open = expanded.has(key);
                  const shown = open
                    ? group.rows
                    : group.rows.slice(0, INFRA_PER_GROUP);
                  const hidden = group.rows.length - INFRA_PER_GROUP;
                  const negative = group.category === 'negative';
                  return (
                    <View key={group.category} style={styles.infraGroup}>
                      <Text
                        style={[
                          styles.infraGroupLabel,
                          negative && styles.infraGroupLabelWarn,
                        ]}
                      >
                        {group.label}
                      </Text>
                      {shown.map(row => {
                        if ('existing' in row) {
                          const p = row.existing;
                          return (
                            <View key={p.source_url} style={styles.infraItem}>
                              <Text style={styles.infraName}>{p.name}</Text>
                              <Text style={styles.infraDistance}>
                                {existingWhereText(p)}
                              </Text>
                              <Pressable
                                onPress={() =>
                                  p.source_url && Linking.openURL(p.source_url)
                                }
                              >
                                <Text style={styles.infraSource}>
                                  Source: OpenStreetMap
                                </Text>
                              </Pressable>
                            </View>
                          );
                        }
                        const item = row.planned;
                        return (
                          <View key={item.project_id} style={styles.infraItem}>
                            <Text style={styles.infraName}>{item.name}</Text>
                            <Text style={styles.infraDistance}>
                              {whereText(item)}
                            </Text>
                            <Text style={styles.infraStatus}>
                              {statusText(item)}
                            </Text>
                            <Pressable
                              onPress={() =>
                                item.source_url &&
                                Linking.openURL(item.source_url)
                              }
                            >
                              {/* Who/what verified it (verified_by) is internal provenance, not shown. */}
                              <Text style={styles.infraSource}>
                                Source: {sourceAgency(item.source_name)} ·
                                Updated {formatDate(item.verified_at!)}
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                      {hidden > 0 ? (
                        <Pressable onPress={() => toggleGroup(key)} hitSlop={8}>
                          <Text style={styles.infraSeeAll}>
                            {open
                              ? 'Show less'
                              : `See all ${group.rows.length}`}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })}
          <Text style={styles.infraAttribution}>
            Straight-line distances. Map data © OpenStreetMap contributors.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>
          Nearby Registered Transactions
        </Text>
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
                      {r.parcel.cost_rupees != null
                        ? formatCrore(r.parcel.cost_rupees)
                        : 'No price yet'}
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
                        ? `${formatCrore(
                            r.assessment.future_valuation_rupees!,
                          )} (~${r.assessment.future_valuation_year})`
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
                {r.assessment?.verdict
                  ? ` — ${r.assessment.verdict}`
                  : ' — not assessed'}
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
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  noteText: {
    fontSize: 12.5,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
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
  infraGroup: {
    gap: 6,
    marginTop: 6,
  },
  infraGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.secondary,
  },
  infraGroupLabelWarn: {
    color: colors.error,
  },
  infraSeeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
    textDecorationLine: 'underline',
  },
  // Readability (2026-09-27): nothing below 12px, and no #a3a3a3 ("outline") text — it measured
  // ~2.5:1 contrast on white, under the 4.5:1 minimum. Secondary text uses onSurfaceVariant (~4.8:1).
  infraName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  infraStatus: {
    fontSize: 13,
    color: colors.onSurface,
  },
  infraSource: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textDecorationLine: 'underline',
  },
  infraDistance: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.onSurface,
  },
  infraEmpty: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  infraAttribution: {
    fontSize: 11.5,
    color: colors.onSurfaceVariant,
    marginTop: 12,
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
