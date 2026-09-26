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

type AccountingSync = components['schemas']['AccountingSync'];

type Props = {
  projectId: string;
  onBack: () => void;
  onSeeGSTFiling: () => void;
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AccountingSyncScreen({
  projectId,
  onBack,
  onSeeGSTFiling,
}: Props) {
  const [sync, setSync] = useState<AccountingSync | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET(
      '/projects/{projectID}/accounting-sync',
      { params: { path: { projectID: projectId } } },
    );
    if (apiError) {
      setError('No accounting sync recorded for this project yet.');
    } else {
      setSync(data ?? null);
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

  if (error || !sync) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {error ?? 'No accounting sync recorded for this project yet.'}
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

      <Text style={styles.title}>Accounting Sync</Text>
      <Text style={styles.subtitle}>Tally / GST bridge</Text>

      <View style={styles.card}>
        {(sync.connections ?? []).map((c, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowLabel}>{c.system_name}</Text>
            <View
              style={[
                styles.pill,
                {
                  backgroundColor:
                    c.status === 'connected'
                      ? colors.secondaryContainer
                      : colors.surfaceContainer,
                },
              ]}>
              <Text
                style={[
                  styles.pillText,
                  {
                    color:
                      c.status === 'connected'
                        ? colors.onSecondaryContainer
                        : colors.onSurfaceVariant,
                  },
                ]}>
                {c.status === 'connected' ? 'connected' : 'not connected'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {sync.last_sync_at ? (
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Last sync</Text>
          <Text style={styles.syncNote}>
            {timeAgo(sync.last_sync_at)} · {sync.last_sync_vouchers_posted ?? 0} vouchers
            posted, {sync.last_sync_vouchers_rejected ?? 0} rejected
          </Text>
          <Text style={styles.syncDetail}>
            Two-way: RA bills and receipts push to Tally as vouchers; Tally's ledger
            balance feeds back as the developer's own ledger figure shown on the Escrow
            screen.
          </Text>
        </View>
      ) : null}

      <Text style={styles.footnote}>
        Every voucher pushed or pulled here is itself a row in the audit trail — sync is
        not exempt from the same edit-log requirement.
      </Text>
      <Text style={styles.footnote}>
        Honest limit: Tally's own API is limited (XML import/export, not a modern REST
        API) — real integration work, per installation, not solved by this screen alone.
      </Text>

      <Pressable onPress={onSeeGSTFiling} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>GST Filing &amp; ITC Reversal →</Text>
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
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 4,
  },
  cardHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  rowLabel: {
    fontSize: 11,
    color: colors.onSurface,
  },
  pill: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  syncNote: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  syncDetail: {
    fontSize: 9.5,
    color: colors.outline,
    padding: 8,
  },
  footnote: {
    fontSize: 9.5,
    color: colors.outline,
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
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
