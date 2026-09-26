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
import { DEV_ORG_ID } from '../config/devProject';
import type { components } from '@scridddhub/api-client';

type LitigationCase = components['schemas']['LitigationCase'];
type Status = components['schemas']['LitigationCaseStatus'];

type Props = {
  onBack: () => void;
  onSeeRiskRegister: () => void;
};

function formatLakh(rupees: number): string {
  return `₹${(rupees / 1e5).toFixed(1)}L`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const STATUS_STYLE: Record<Status, { bg: string; text: string; label: string }> = {
  open: { bg: colors.errorContainer, text: colors.onError, label: 'open' },
  in_progress: { bg: colors.primaryContainer, text: colors.onPrimaryContainer, label: 'in progress' },
  closed: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer, label: 'closed' },
};

const CASE_TYPE_LABEL: Record<string, string> = {
  rera_tribunal: 'RERA tribunal',
  consumer_court: 'Consumer commission',
  arbitration: 'Arbitration',
};

function caseTitle(c: LitigationCase): string {
  const label = CASE_TYPE_LABEL[c.case_type!] ?? c.case_type!;
  return c.counterparty_name ? `${label}, ${c.counterparty_name}` : `${label}, ${c.forum}`;
}

function caseSubtitle(c: LitigationCase): string {
  const parts = [c.counterparty_type, c.subject];
  if (c.status === 'closed' && c.resolution_note) {
    parts.push(c.resolution_note);
  } else if (c.next_hearing_at) {
    parts.push(`next hearing in ${daysUntil(c.next_hearing_at)} days`);
  }
  return parts.filter(Boolean).join(' · ');
}

export function LitigationCaseScreen({ onBack, onSeeRiskRegister }: Props) {
  const [cases, setCases] = useState<LitigationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET('/orgs/{orgID}/litigation-cases', {
      params: { path: { orgID: DEV_ORG_ID } },
    });
    if (apiError) {
      setError('Could not load litigation cases. Is the backend running?');
    } else {
      setCases(data ?? []);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Derived at render time, never stored — "not yet a confirmed liability" per the wireframe's
  // own framing, so a closed matter never contributes even if it once had a claimed amount.
  const totalExposureRupees = useMemo(
    () =>
      cases
        .filter(c => c.status !== 'closed')
        .reduce((sum, c) => sum + (c.claimed_amount_rupees ?? 0), 0),
    [cases],
  );

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

      <Text style={styles.title}>Litigation &amp; Disputes</Text>
      <Text style={styles.subtitle}>RERA tribunal · consumer court · arbitration</Text>

      <View style={styles.gapCard}>
        <Text style={styles.gapHeading}>The gap</Text>
        <Text style={styles.gapText}>
          A curated, buyer-facing trust signal is not the same thing as this developer's own
          internal record of every open matter — a RERA tribunal complaint, a consumer-court
          case, or a contractor arbitration. This is that working list, with hearing dates and
          exposure.
        </Text>
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <View style={styles.card}>
          {cases.length === 0 ? (
            <Text style={styles.emptyText}>No litigation matters recorded yet.</Text>
          ) : (
            cases.map(c => {
              const s = STATUS_STYLE[c.status!];
              return (
                <View key={c.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{caseTitle(c)}</Text>
                    <Text style={styles.rowSubtitle}>{caseSubtitle(c)}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: s.bg }]}>
                    <Text style={[styles.pillText, { color: s.text }]}>{s.label}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      <View style={styles.exposureCard}>
        <Text style={styles.cardHeading}>Financial exposure, open matters</Text>
        <View style={styles.exposureRow}>
          <Text style={styles.exposureValue}>{formatLakh(totalExposureRupees)}</Text>
          <Text style={styles.exposureNote}>claimed, not yet a confirmed liability</Text>
        </View>
        <Text style={styles.cardNote}>
          Rolls into the Financial Health view (8.5) as a contingent-liability line, not counted
          against cash until an order is actually passed.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoHeading}>How this differs from Screen 37</Text>
        <Text style={styles.infoText}>
          This is the developer's complete internal record — every matter, open or closed, good
          outcome or bad. Screen 37 is a curated, opt-in subset shown to buyers and stays that
          way; a bad outcome logged here doesn't automatically become buyer-visible there, which
          is the developer's own disclosure choice, not this screen's.
        </Text>
      </View>

      <Text style={styles.footnote}>
        Honest limit: case status is entered by the developer's legal team or external counsel,
        not auto-scraped from tribunal/court systems — scraping case records at scale across
        RERA tribunals, consumer commissions and arbitration bodies is a separate, much harder
        data-access problem, not solved by this screen.
      </Text>

      <Text style={styles.logNote}>every case update → the audit trail, 8.11</Text>

      <Pressable onPress={onSeeRiskRegister} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>Risk Register →</Text>
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
  gapCard: {
    backgroundColor: colors.errorContainer,
    borderRadius: 8,
    padding: 11,
    gap: 4,
  },
  gapHeading: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.onError,
  },
  gapText: {
    fontSize: 10,
    color: colors.onError,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    gap: 8,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
  },
  rowSubtitle: {
    fontSize: 9.5,
    color: colors.onSurfaceVariant,
  },
  pill: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  exposureCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  cardHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  cardNote: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  exposureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  exposureValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onError,
  },
  exposureNote: {
    fontSize: 9,
    color: colors.onSurfaceVariant,
  },
  infoCard: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: 8,
    padding: 11,
    gap: 4,
  },
  infoHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSecondaryContainer,
  },
  infoText: {
    fontSize: 10,
    color: colors.onSecondaryContainer,
  },
  footnote: {
    fontSize: 9.5,
    color: colors.outline,
  },
  logNote: {
    fontSize: 10,
    color: colors.outline,
    textAlign: 'center',
    fontStyle: 'italic',
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
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    padding: 20,
  },
});
