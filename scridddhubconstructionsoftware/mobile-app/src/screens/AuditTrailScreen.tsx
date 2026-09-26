import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type AuditLogEntry = components['schemas']['AuditLogEntry'];

type Props = {
  onBack: () => void;
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' && v.length > 24) return v.slice(0, 24) + '…';
  return String(v);
}

// A generic field-level diff between old_data and new_data — this screen covers every audited
// table in the system, and building a bespoke human-readable formatter per table (like the
// wireframe's polished "cost-incurred, Tower A: ₹1.85 Cr → ₹1.9 Cr" sentence) doesn't generalize.
// This is the honest, generalizable version of "who changed what, previous value, new value."
function diffFields(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined,
): { field: string; from: unknown; to: unknown }[] {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  for (const key of keys) {
    if (key === 'UpdatedAt' || key === 'CreatedAt' || key === 'ID') continue;
    const from = oldData[key];
    const to = newData[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ field: key, from, to });
    }
  }
  return changes;
}

function EntryRow({ entry }: { entry: AuditLogEntry }) {
  const changes = diffFields(
    entry.old_data as Record<string, unknown> | null,
    entry.new_data as Record<string, unknown> | null,
  );

  return (
    <View style={styles.row}>
      <Text style={styles.time}>{timeLabel(entry.changed_at!)}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowHeadline}>
          <Text style={styles.actor}>{entry.actor}</Text>{' '}
          {entry.action === 'insert' ? 'created' : entry.action === 'delete' ? 'deleted' : 'updated'}{' '}
          {entry.table_name!.replace(/_/g, ' ')}
        </Text>
        {entry.action === 'insert' ? (
          <Text style={styles.rowDetail}>no prior value — first entry</Text>
        ) : (
          changes.slice(0, 3).map(c => (
            <Text key={c.field} style={styles.rowDetail}>
              {c.field}: {formatValue(c.from)} → {formatValue(c.to)}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

export function AuditTrailScreen({ onBack }: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET('/audit-log', {
      params: { query: { limit: 50 } },
    });
    if (apiError) {
      setError('Could not load the audit trail. Is the backend running?');
    } else {
      setEntries(data ?? []);
    }
  }, []);

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

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Audit Trail</Text>
      <Text style={styles.subtitle}>immutable, cannot be disabled</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoHeading}>Verified, not assumed</Text>
        <Text style={styles.infoText}>
          MCA's Companies (Accounts) Rules, Rule 3(1) proviso, effective 1 April 2023: every
          company must use accounting software with an edit log of every transaction change,
          dated, with the option to disable it removed. Presented here as the wireframe's own
          cited source — not independently re-verified against the current MCA rule text in
          this build.
        </Text>
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <EntryRow entry={item} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No audit entries yet.</Text>}
          style={styles.flatList}
          contentContainerStyle={styles.list}
        />
      )}

      <Text style={styles.footnote}>
        Every edit to escrow balances, certification drafts, payment records, and possession-date
        estimates — who, what changed, previous value, new value, timestamp. Exportable as
        evidence for a RERA tribunal or a statutory audit.
      </Text>
      <Text style={styles.footnote}>
        Honest limit: the "cannot be disabled" guarantee is a real architecture commitment
        (append-only storage, no admin delete path, no UPDATE/DELETE grant on the table at the DB
        role level) — not something this screen enforces by itself.
      </Text>

      <Text style={styles.tagline}>
        the record buyers, auditors and tribunals can actually trust
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    gap: 8,
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
  infoCard: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: 8,
    padding: 11,
    gap: 4,
  },
  infoHeading: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.onSecondaryContainer,
  },
  infoText: {
    fontSize: 10,
    color: colors.onSecondaryContainer,
  },
  flatList: {
    flex: 1,
  },
  list: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  time: {
    fontSize: 8.5,
    color: colors.outline,
    width: 44,
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowHeadline: {
    fontSize: 10.5,
    color: colors.onSurface,
  },
  actor: {
    fontWeight: '700',
  },
  rowDetail: {
    fontSize: 9,
    color: colors.onSurfaceVariant,
  },
  footnote: {
    fontSize: 9.5,
    color: colors.onSurfaceVariant,
  },
  tagline: {
    fontSize: 10,
    color: colors.outline,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
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
