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

type CertificationPacket = components['schemas']['CertificationPacket'];

type Props = {
  projectId: string;
  onBack: () => void;
  onSeeLenderCovenant: () => void;
};

const PERIOD_YEAR = 2026;
const PERIOD_QUARTER = 2;

function formatCrore(rupees: number): string {
  return `₹${(rupees / 1e7).toFixed(1)} Cr`;
}

export function CertificationPacketScreen({
  projectId,
  onBack,
  onSeeLenderCovenant,
}: Props) {
  const [packet, setPacket] = useState<CertificationPacket | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [engineerName, setEngineerName] = useState('A. Mehta');
  const [caName, setCaName] = useState('R. Kulkarni');
  const [architectName, setArchitectName] = useState('P. Rao');
  const [completionPct, setCompletionPct] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: apiError } = await api.GET(
      '/projects/{projectID}/certification-packets/{year}/{quarter}',
      {
        params: {
          path: { projectID: projectId, year: PERIOD_YEAR, quarter: PERIOD_QUARTER },
        },
      },
    );
    if (apiError) {
      setError('No certification packet for this quarter yet.');
    } else {
      setPacket(data ?? null);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const createPacket = useCallback(async () => {
    setBusy(true);
    const { data, error: apiError } = await api.POST(
      '/projects/{projectID}/certification-packets',
      {
        params: { path: { projectID: projectId } },
        body: { period_year: PERIOD_YEAR, period_quarter: PERIOD_QUARTER },
      },
    );
    setBusy(false);
    if (!apiError && data) {
      setPacket(data);
      setError(null);
    }
  }, [projectId]);

  const signEngineer = useCallback(async () => {
    if (!packet) return;
    setBusy(true);
    const { data, error: apiError } = await api.POST(
      '/certification-packets/{packetID}/engineer-draft/sign',
      {
        params: { path: { packetID: packet.id! } },
        body: { signed_by: engineerName },
      },
    );
    setBusy(false);
    if (!apiError && data) setPacket(data);
  }, [packet, engineerName]);

  const signCA = useCallback(async () => {
    if (!packet) return;
    setBusy(true);
    const { data, error: apiError } = await api.POST(
      '/certification-packets/{packetID}/ca-draft/sign',
      {
        params: { path: { packetID: packet.id! } },
        body: { signed_by: caName },
      },
    );
    setBusy(false);
    if (!apiError && data) setPacket(data);
  }, [packet, caName]);

  const scheduleSiteVisit = useCallback(async () => {
    if (!packet) return;
    setBusy(true);
    const { data, error: apiError } = await api.POST(
      '/certification-packets/{packetID}/architect-certificate/schedule-site-visit',
      { params: { path: { packetID: packet.id! } } },
    );
    setBusy(false);
    if (!apiError && data) setPacket(data);
  }, [packet]);

  const completeSiteVisit = useCallback(async () => {
    if (!packet) return;
    setBusy(true);
    const { data, error: apiError } = await api.POST(
      '/certification-packets/{packetID}/architect-certificate/complete-site-visit',
      { params: { path: { packetID: packet.id! } } },
    );
    setBusy(false);
    if (!apiError && data) setPacket(data);
  }, [packet]);

  const certifyArchitect = useCallback(async () => {
    if (!packet) return;
    const pct = parseFloat(completionPct);
    if (Number.isNaN(pct)) return;
    setBusy(true);
    setError(null);
    const { data, error: apiError } = await api.POST(
      '/certification-packets/{packetID}/architect-certificate/certify',
      {
        params: { path: { packetID: packet.id! } },
        body: { completion_pct: pct, signed_by: architectName },
      },
    );
    setBusy(false);
    if (apiError) {
      setError('Cannot certify: no recorded site visit yet.');
    } else if (data) {
      setPacket(data);
    }
  }, [packet, completionPct, architectName]);

  const sendToProfessionals = useCallback(async () => {
    if (!packet) return;
    setBusy(true);
    const { data, error: apiError } = await api.POST(
      '/certification-packets/{packetID}/send-to-professionals',
      { params: { path: { packetID: packet.id! } } },
    );
    setBusy(false);
    if (!apiError && data) setPacket(data);
  }, [packet]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!packet) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {error ?? `No Q${PERIOD_QUARTER} ${PERIOD_YEAR} certification packet yet.`}
        </Text>
        <Pressable
          onPress={createPacket}
          disabled={busy}
          style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>
            {busy ? 'Creating…' : `Create Q${PERIOD_QUARTER} Packet`}
          </Text>
        </Pressable>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const eng = packet.engineer_draft!;
  const arch = packet.architect_certificate!;
  const ca = packet.ca_draft!;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Quarterly Certification Packet</Text>
      <Text style={styles.subtitle}>
        Q{packet.period_quarter} {packet.period_year} · escrow withdrawal package
      </Text>

      {/* Engineer draft */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeading}>Engineer — Cost Incurred</Text>
          <View
            style={[
              styles.statusPill,
              eng.status === 'signed' ? styles.signedPill : styles.draftPill,
            ]}>
            <Text style={styles.statusPillText}>
              {eng.status === 'signed' ? 'signed' : 'draft ready'}
            </Text>
          </View>
        </View>
        {eng.cost_by_tower!.map((t, i) => (
          <View key={i} style={styles.kv}>
            <Text style={styles.kvLabel}>{t.tower_name}</Text>
            <Text style={styles.kvValue}>{formatCrore(t.amount_rupees!)}</Text>
          </View>
        ))}
        <View style={styles.kv}>
          <Text style={styles.kvLabelBold}>Total incurred</Text>
          <Text style={styles.kvValueAccent}>
            {formatCrore(eng.total_incurred_rupees!)}
          </Text>
        </View>
        {eng.committed_not_reflected_rupees != null ? (
          <Text style={styles.flagText}>
            AI cross-check: {formatCrore(eng.committed_not_reflected_rupees)} in Committed
            spend not yet reflected. Not an error — flagged so you decide.
          </Text>
        ) : null}
        {eng.status !== 'signed' ? (
          <View style={styles.signRow}>
            <TextInput
              style={styles.nameInput}
              value={engineerName}
              onChangeText={setEngineerName}
              placeholder="Engineer name"
              placeholderTextColor={colors.outline}
            />
            <Pressable onPress={signEngineer} disabled={busy} style={styles.signButton}>
              <Text style={styles.signButtonText}>Approve &amp; Sign</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.signedNote}>
            Signed by {eng.signed_by} — legal certification
          </Text>
        )}
      </View>

      {/* Architect certificate */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeading}>Architect — % Completion</Text>
          <View style={[styles.statusPill, styles.draftPill]}>
            <Text style={styles.statusPillText}>
              {arch.status === 'certified' ? 'certified' : 'site visit needed'}
            </Text>
          </View>
        </View>
        <Text style={styles.rowNote}>
          Not AI-drafted — completion % requires a physical site inspection.
        </Text>
        {arch.status !== 'certified' ? (
          <>
            {!arch.site_visit_scheduled_at ? (
              <Pressable onPress={scheduleSiteVisit} disabled={busy} style={styles.outlineButton}>
                <Text style={styles.outlineButtonText}>Schedule Site Visit</Text>
              </Pressable>
            ) : !arch.site_visit_completed_at ? (
              <Pressable onPress={completeSiteVisit} disabled={busy} style={styles.outlineButton}>
                <Text style={styles.outlineButtonText}>Mark Site Visit Complete</Text>
              </Pressable>
            ) : (
              <View style={styles.signRow}>
                <TextInput
                  style={styles.nameInput}
                  keyboardType="numeric"
                  value={completionPct}
                  onChangeText={setCompletionPct}
                  placeholder="% complete"
                  placeholderTextColor={colors.outline}
                />
                <TextInput
                  style={styles.nameInput}
                  value={architectName}
                  onChangeText={setArchitectName}
                  placeholder="Architect name"
                  placeholderTextColor={colors.outline}
                />
                <Pressable onPress={certifyArchitect} disabled={busy} style={styles.signButton}>
                  <Text style={styles.signButtonText}>Certify</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.signedNote}>
            {arch.completion_pct}% certified by {arch.signed_by}
          </Text>
        )}
      </View>

      {/* CA draft */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeading}>CA — Escrow Reconciliation</Text>
          <View
            style={[
              styles.statusPill,
              ca.status === 'signed' ? styles.signedPill : styles.draftPill,
            ]}>
            <Text style={styles.statusPillText}>
              {ca.status === 'signed' ? 'signed' : 'draft ready'}
            </Text>
          </View>
        </View>
        <View style={styles.kv}>
          <Text style={styles.kvLabel}>Collected from buyers</Text>
          <Text style={styles.kvValue}>
            {formatCrore(ca.collected_from_buyers_rupees!)}
          </Text>
        </View>
        <View style={styles.kv}>
          <Text style={styles.kvLabel}>
            Required to escrow ({ca.required_escrow_pct}%)
          </Text>
          <Text style={styles.kvValue}>
            {formatCrore(ca.required_to_escrow_rupees!)}
          </Text>
        </View>
        <View style={styles.kv}>
          <Text style={styles.kvLabel}>Actually routed</Text>
          <Text style={styles.kvValue}>
            {formatCrore(ca.actually_routed_to_escrow_rupees!)}
          </Text>
        </View>
        <Text
          style={[
            styles.complianceText,
            { color: ca.routing_compliant ? colors.primary : colors.error },
          ]}>
          {ca.routing_compliant ? '✓ within tolerance' : '⚠ outside tolerance'}
        </Text>
        {ca.status !== 'signed' ? (
          <View style={styles.signRow}>
            <TextInput
              style={styles.nameInput}
              value={caName}
              onChangeText={setCaName}
              placeholder="CA name"
              placeholderTextColor={colors.outline}
            />
            <Pressable onPress={signCA} disabled={busy} style={styles.signButton}>
              <Text style={styles.signButtonText}>Approve &amp; Sign</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.signedNote}>Signed by {ca.signed_by}</Text>
        )}
      </View>

      <View style={styles.withdrawalBanner}>
        <Text style={styles.withdrawalText}>
          Withdrawal eligibility:{' '}
          {packet.withdrawal_eligible ? '✓ eligible' : 'not yet — architect certification pending'}
        </Text>
      </View>

      {!packet.sent_to_professionals_at ? (
        <Pressable onPress={sendToProfessionals} disabled={busy} style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>Send Drafts to Engineer &amp; CA</Text>
        </Pressable>
      ) : (
        <Text style={styles.sentNote}>Sent to professionals for review.</Text>
      )}
      <Text style={styles.disclaimer}>
        AI-drafted from project data — not a substitute for professional certification.
      </Text>

      <Pressable onPress={onSeeLenderCovenant} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>Lender Covenant Tracker →</Text>
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
    padding: 24,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeading: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.onSurface,
  },
  statusPill: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  draftPill: {
    backgroundColor: colors.secondaryContainer,
  },
  signedPill: {
    backgroundColor: colors.primaryContainer,
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.onSecondaryContainer,
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kvLabel: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  kvLabelBold: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
  },
  kvValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
  },
  kvValueAccent: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  rowNote: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  flagText: {
    fontSize: 10,
    color: colors.error,
  },
  complianceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  signRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  nameInput: {
    flex: 1,
    fontSize: 11,
    color: colors.onSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    paddingVertical: 4,
    minWidth: 90,
  },
  signButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  signButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  outlineButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
  },
  signedNote: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  withdrawalBanner: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    padding: 10,
  },
  withdrawalText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurface,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaButtonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sentNote: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 9.5,
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
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
