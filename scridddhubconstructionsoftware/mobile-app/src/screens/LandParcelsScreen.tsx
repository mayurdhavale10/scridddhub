import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { DEV_PROJECT_ID } from '../config/devProject';
import { HomeIcon } from '../components/HomeIcon';
import type { components } from '@scridddhub/api-client';

type LandParcel = components['schemas']['LandParcel'];
type Stage = components['schemas']['LandParcelStage'];

const STAGE_BADGE_STYLE: Record<Stage, { bg: string; text: string }> = {
  sourced: { bg: colors.surfaceContainer, text: colors.onSurfaceVariant },
  screened: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer },
  dd: { bg: colors.primaryContainer, text: colors.onPrimaryContainer },
  negotiating: { bg: colors.primary, text: colors.onPrimary },
};

const STAGE_FILTERS: { label: string; value: Stage | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Sourced', value: 'sourced' },
  { label: 'Screened', value: 'screened' },
  { label: 'DD', value: 'dd' },
  { label: 'Negotiating', value: 'negotiating' },
];

function formatCost(rupees: number): string {
  const crore = rupees / 1e7;
  return `₹${crore.toFixed(1)} Cr`;
}

// A "just checking a location" parcel (Screen 4.2) may have no recorded area and/or price yet —
// show that honestly rather than a fabricated "0 acres"/"₹0.0 Cr".
function formatSpecs(areaAcres: number | null | undefined, costRupees: number | null | undefined): string {
  const area = areaAcres != null ? `${areaAcres} acres` : 'area unknown';
  const cost = costRupees != null ? formatCost(costRupees) : 'no price yet';
  return `${area} · ${cost}`;
}

type Props = {
  onSelectParcel: (parcelId: string) => void;
  onSeeAuditTrail: () => void;
  onAddParcel: () => void;
  onCompareParcels: (parcelIds: string[]) => void;
};

export function LandParcelsScreen({
  onSelectParcel,
  onSeeAuditTrail,
  onAddParcel,
  onCompareParcels,
}: Props) {
  const [parcels, setParcels] = useState<LandParcel[]>([]);
  // Verdict text per parcel id, from each parcel's own FeasibilityAssessment (Screen 5) — not a
  // fake "good buy" flag. A parcel only gets the emphasized border/pill when a real assessment
  // with a non-empty verdict exists for it; parcels never assessed show neither.
  const [verdicts, setVerdicts] = useState<Record<string, string>>({});
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Long-press a card to enter select mode; tapping normally still opens the parcel while not
  // in select mode. A dedicated "Compare" bar appears once 2+ parcels are selected. "Select" in
  // the header is a second, more reliable entry point — long-press-and-hold is finicky to
  // reproduce with a mouse on an emulator (any jitter while held gets stolen by the list's own
  // scroll gesture), so this guarantees a way in regardless of input device.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const enterSelectMode = useCallback((firstId?: string) => {
    setSelectMode(true);
    if (firstId) {
      setSelectedIds(new Set([firstId]));
    }
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const cancelSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET(
      '/projects/{projectID}/land-parcels',
      { params: { path: { projectID: DEV_PROJECT_ID } } },
    );
    if (apiError) {
      setError('Could not load land parcels. Is the backend running?');
      return;
    }
    const list = data ?? [];
    setParcels(list);

    const entries = await Promise.all(
      list.map(async p => {
        const { data: fa } = await api.GET(
          '/land-parcels/{parcelID}/feasibility-assessment',
          { params: { path: { parcelID: p.id! } } },
        );
        return [p.id!, fa?.verdict ?? ''] as const;
      }),
    );
    setVerdicts(Object.fromEntries(entries.filter(([, v]) => v)));
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  const filtered = useMemo(() => {
    const byStage =
      stageFilter === 'all' ? parcels : parcels.filter(p => p.stage === stageFilter);
    const query = search.trim().toLowerCase();
    if (!query) return byStage;
    return byStage.filter(
      p =>
        p.name?.toLowerCase().includes(query) ||
        p.location?.toLowerCase().includes(query),
    );
  }, [parcels, stageFilter, search]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Land Parcels</Text>
        <View style={styles.headerActions}>
          {selectMode ? null : (
            <Pressable onPress={() => enterSelectMode()}>
              <Text style={styles.auditLink}>Select</Text>
            </Pressable>
          )}
          <Pressable onPress={onSeeAuditTrail}>
            <Text style={styles.auditLink}>Audit Trail</Text>
          </Pressable>
          <Pressable onPress={onAddParcel} style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="search parcels..."
          placeholderTextColor={colors.onSurfaceVariant}
        />
      </View>

      <View style={styles.filterRow}>
        {STAGE_FILTERS.map(f => (
          <Pressable
            key={f.value}
            onPress={() => setStageFilter(f.value)}
            style={[
              styles.chip,
              stageFilter === f.value && styles.chipActive,
            ]}>
            <Text
              style={[
                styles.chipLabel,
                stageFilter === f.value && styles.chipLabelActive,
              ]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id!}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No land parcels yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge =
              STAGE_BADGE_STYLE[item.stage ?? 'sourced'] ??
              STAGE_BADGE_STYLE.sourced;
            const verdict = verdicts[item.id!];
            const isSelected = selectedIds.has(item.id!);
            return (
            <Pressable
              style={[
                styles.card,
                verdict && styles.cardRecommended,
                isSelected && styles.cardSelected,
              ]}
              onPress={() =>
                selectMode ? toggleSelected(item.id!) : onSelectParcel(item.id!)
              }
              onLongPress={() =>
                selectMode ? toggleSelected(item.id!) : enterSelectMode(item.id!)
              }
              delayLongPress={350}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  {selectMode ? (
                    // House instead of a tick (owner, 2026-09-29): solid black when selected,
                    // light grey when not.
                    <HomeIcon
                      size={20}
                      color={isSelected ? colors.primary : colors.outlineVariant}
                      backgroundColor={
                        isSelected
                          ? colors.surfaceContainer
                          : colors.surfaceContainerLowest
                      }
                    />
                  ) : null}
                  <Text style={styles.cardTitle}>{item.name}</Text>
                </View>
                <View
                  style={[
                    styles.stageBadge,
                    { backgroundColor: badge.bg },
                  ]}>
                  <Text
                    style={[
                      styles.stageBadgeText,
                      { color: badge.text },
                    ]}>
                    {item.stage}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>
                {formatSpecs(item.area_acres, item.cost_rupees)}
              </Text>
              {item.location ? (
                <Text style={styles.cardMeta}>{item.location}</Text>
              ) : null}
              {verdict ? <Text style={styles.verdictText}>{verdict}</Text> : null}
            </Pressable>
            );
          }}
        />
      )}

      {selectMode ? (
        <View style={styles.selectBar}>
          <Pressable onPress={cancelSelectMode}>
            <Text style={styles.selectBarCancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.selectBarCount}>{selectedIds.size} selected</Text>
          <Pressable
            disabled={selectedIds.size < 2}
            onPress={() => onCompareParcels(Array.from(selectedIds))}
            style={[
              styles.compareButton,
              selectedIds.size < 2 && styles.compareButtonDisabled,
            ]}>
            <Text style={styles.compareButtonText}>Compare</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onPrimary,
    marginTop: -2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.onSurface,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  chipLabelActive: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  auditLink: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 13,
    gap: 6,
  },
  cardRecommended: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cardSelected: {
    backgroundColor: colors.surfaceContainer,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  cardSubtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  cardMeta: {
    fontSize: 11,
    color: colors.outline,
  },
  verdictText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.primary,
  },
  stageBadge: {
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  stageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: -16,
    marginBottom: -16,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  selectBarCancel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  selectBarCount: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  compareButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  compareButtonDisabled: {
    opacity: 0.4,
  },
  compareButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
