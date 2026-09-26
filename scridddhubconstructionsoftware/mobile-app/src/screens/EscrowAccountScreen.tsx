import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type EscrowAccount = components['schemas']['EscrowAccount'];

type Props = {
  projectId: string;
  onBack: () => void;
  onSeeCertificationPacket: () => void;
};

function formatCrore(rupees: number): string {
  return `₹${(rupees / 1e7).toFixed(1)} Cr`;
}

function hoursAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
}

export function EscrowAccountScreen({
  projectId,
  onBack,
  onSeeCertificationPacket,
}: Props) {
  const [account, setAccount] = useState<EscrowAccount | null>(null);
  const [ledgerInput, setLedgerInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET(
      '/projects/{projectID}/escrow-account',
      { params: { path: { projectID: projectId } } },
    );
    if (apiError) {
      setError('No escrow account recorded for this project yet.');
    } else {
      setAccount(data ?? null);
      if (data?.developer_ledger_balance_rupees != null) {
        setLedgerInput(String(data.developer_ledger_balance_rupees / 1e7));
      }
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const saveDeveloperLedger = useCallback(async () => {
    const crore = parseFloat(ledgerInput);
    if (Number.isNaN(crore)) return;
    setSaving(true);
    const { data, error: apiError } = await api.PUT(
      '/projects/{projectID}/escrow-account/developer-ledger',
      {
        params: { path: { projectID: projectId } },
        body: { balance_rupees: Math.round(crore * 1e7) },
      },
    );
    setSaving(false);
    if (!apiError && data) {
      setAccount(data);
      setError(null);
    }
  }, [ledgerInput, projectId]);

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

      <Text style={styles.title}>Escrow — Bank-Verified</Text>
      <Text style={styles.subtitle}>not developer-typed</Text>

      {error && !account ? <Text style={styles.errorText}>{error}</Text> : null}

      {account ? (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeading}>Escrow balance</Text>
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedPillText}>bank-fed, verified</Text>
              </View>
            </View>
            {account.bank_balance_rupees != null ? (
              <>
                <Text style={styles.bigAmount}>
                  {formatCrore(account.bank_balance_rupees)}
                </Text>
                <Text style={styles.sourceNote}>
                  source: {account.bank_source_name || 'unknown'}
                  {account.bank_synced_at
                    ? `, synced ${hoursAgo(account.bank_synced_at)} hrs ago`
                    : ''}
                </Text>
              </>
            ) : (
              <Text style={styles.sourceNote}>
                No bank feed connected yet — a real bank statement integration is required
                (see backend/README.md).
              </Text>
            )}
          </View>

          <View
            style={[
              styles.card,
              account.mismatch && styles.mismatchCard,
            ]}>
            <Text style={styles.cardHeading}>Developer's own ledger shows</Text>
            <View style={styles.ledgerRow}>
              <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                ₹
              </Text>
              <TextInput
                style={styles.ledgerInput}
                keyboardType="numeric"
                value={ledgerInput}
                onChangeText={setLedgerInput}
                placeholder="0.0"
                placeholderTextColor={colors.outline}
              />
              <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>
                Cr
              </Text>
              <Pressable
                onPress={saveDeveloperLedger}
                disabled={saving}
                style={styles.saveButton}>
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
            <Text
              style={[
                styles.matchText,
                { color: account.mismatch ? colors.error : colors.primary },
              ]}>
              {account.mismatch
                ? '⚠ does not match the bank-verified figure — flagged, not reconciled'
                : '✓ matches'}
            </Text>
          </View>
        </>
      ) : null}

      <Pressable onPress={onSeeCertificationPacket} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>Quarterly Certification Packet →</Text>
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
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  mismatchCard: {
    borderColor: colors.error,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  verifiedPill: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  verifiedPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.onSecondaryContainer,
  },
  bigAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.onSurface,
  },
  sourceNote: {
    fontSize: 9.5,
    color: colors.onSurfaceVariant,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ledgerInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    paddingVertical: 4,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 6,
  },
  saveButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  matchText: {
    fontSize: 10.5,
    fontWeight: '600',
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
