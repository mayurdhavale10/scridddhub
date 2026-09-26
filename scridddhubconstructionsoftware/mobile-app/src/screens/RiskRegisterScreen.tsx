import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

type RiskRegisterEntry = components['schemas']['RiskRegisterEntry'];
type Category = components['schemas']['RiskCategory'];
type Status = components['schemas']['RiskStatus'];

type Props = {
  projectId: string;
  onBack: () => void;
  onProceedToTendering: () => void;
};

// Fixed display order, matching the wireframe — the API returns rows alphabetically by
// category, so this is presentation ordering only, computed client-side rather than stored.
const CATEGORY_ORDER: Category[] = [
  'legal_title',
  'regulatory',
  'financial',
  'contractor_execution',
  'market',
];

const CATEGORY_LABEL: Record<Category, string> = {
  legal_title: 'Legal & Title',
  regulatory: 'Regulatory — RERA Exposure',
  financial: 'Financial — Cash Flow Divergence',
  contractor_execution: 'Contractor & Execution',
  market: 'Market',
};

const STATUS_STYLE: Record<Status, { bg: string; text: string }> = {
  clear: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer },
  on_track: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer },
  flagged: { bg: colors.primaryContainer, text: colors.onPrimaryContainer },
};

export function RiskRegisterScreen({ projectId, onBack, onProceedToTendering }: Props) {
  const [entries, setEntries] = useState<RiskRegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET('/projects/{projectID}/risk-register', {
      params: { path: { projectID: projectId } },
    });
    if (apiError) {
      setError('Could not load the risk register. Is the backend running?');
    } else {
      setEntries(data ?? []);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const ordered = useMemo(() => {
    const byCategory = new Map(entries.map(e => [e.category, e]));
    return CATEGORY_ORDER.map(cat => byCategory.get(cat)).filter(
      (e): e is RiskRegisterEntry => !!e,
    );
  }, [entries]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Risk Register</Text>
      <Text style={styles.subtitle}>reviewed at each gate</Text>

      <Text style={styles.hint}>
        5 categories, not a single score — matches how lenders actually track construction
        risk, not a generic checklist
      </Text>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        ordered.map(e => {
          const s = STATUS_STYLE[e.status!];
          return (
            <View key={e.category} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{CATEGORY_LABEL[e.category!]}</Text>
                <View style={[styles.pill, { backgroundColor: s.bg }]}>
                  <Text style={[styles.pillText, { color: s.text }]}>{e.headline}</Text>
                </View>
              </View>
              <Text style={styles.cardDetail}>{e.detail}</Text>
            </View>
          );
        })
      )}

      <Pressable onPress={onProceedToTendering} style={styles.ctaButton}>
        <Text style={styles.ctaButtonText}>Proceed to Tendering → 10</Text>
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
    gap: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
    flexShrink: 1,
  },
  cardDetail: {
    fontSize: 10.5,
    color: colors.onSurfaceVariant,
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
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
