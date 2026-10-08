import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
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

type Approval = components['schemas']['LandParcelApproval'];
type ApprovalStatus = components['schemas']['ApprovalStatus'];
type SiteSummary = components['schemas']['SiteSummary'];

type Props = {
  parcelId: string;
  onBack: () => void;
  onSeeLandTenure: () => void;
};

// Screen 7: Government Approvals (Level 1), opened from "Deal Closed — Start Approvals" on the
// Legal & RERA Check. The team describes the project in plain words; the backend's AI reads it
// (near an airport? coastal? trees? borewells? units?) and works out which steps of the
// Maharashtra approval sequence apply. Each step's status is then tracked here by tapping it.
// Re-analyze never resets a step that already has progress (usecase.AnalyzeProject).

const STATUS_STYLE: Record<ApprovalStatus, { bg: string; text: string; label: string }> = {
  approved: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer, label: 'Approved' },
  submitted: { bg: '#f5efdc', text: '#8a6a1a', label: 'Submitted' },
  not_started: { bg: colors.surfaceContainer, text: colors.onSurfaceVariant, label: 'Not started' },
  not_applicable: { bg: colors.surfaceContainer, text: colors.outline, label: 'N/A' },
  not_yet_due: { bg: colors.surfaceContainer, text: colors.outline, label: 'Not yet due' },
};

const STATUS_CHOICES: ApprovalStatus[] = [
  'not_started',
  'submitted',
  'approved',
  'not_yet_due',
  'not_applicable',
];

const STATUS_CHOICE_LABEL: Record<ApprovalStatus, string> = {
  not_started: 'Not started',
  submitted: 'Submitted',
  approved: 'Approved',
  not_yet_due: 'Not yet due',
  not_applicable: 'Not needed for this project',
};

// Why a conditional step is needed or not, stated as a plain fact about the site (owner, 2026-10-03).
const CONDITION_REASON: Record<string, { included: string; excluded: string }> = {
  near_airport: {
    included: 'Needed: site is near an airport',
    excluded: 'Not needed: site is not near an airport',
  },
  coastal_site: {
    included: 'Needed: site is coastal',
    excluded: 'Not needed: site is inland, not coastal',
  },
  significant_tree_cover: {
    included: 'Needed: site has big trees',
    excluded: 'Not needed: no big trees on site',
  },
  uses_groundwater: {
    included: 'Needed: site uses borewells',
    excluded: 'Not needed: site does not use borewells',
  },
};

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function chipsFor(s: SiteSummary): string[] {
  const chips = [
    s.coastal_site ? 'Coastal' : 'Inland',
    s.significant_tree_cover ? 'Trees on site' : 'No trees',
    s.uses_groundwater ? 'Uses borewells' : 'No borewells',
    s.near_airport ? 'Near airport' : 'Not near airport',
  ];
  if (s.unit_count) chips.push(`${s.unit_count} units`);
  return chips;
}

export function GovernmentApprovalsScreen({ parcelId, onBack, onSeeLandTenure }: Props) {
  const [freeText, setFreeText] = useState('');
  const [summary, setSummary] = useState<SiteSummary | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [parcelName, setParcelName] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Approval | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.GET('/land-parcels/{parcelID}/site-summary', {
        params: { path: { parcelID: parcelId } },
      }),
      api.GET('/land-parcels/{parcelID}/approvals', {
        params: { path: { parcelID: parcelId } },
      }),
      api.GET('/land-parcels/{id}', { params: { path: { id: parcelId } } }),
    ])
      .then(([summaryResult, approvalsResult, parcelResult]) => {
        const parcel = parcelResult.data;
        setParcelName(parcel?.name ?? '');
        if (summaryResult.data) {
          setSummary(summaryResult.data);
          setFreeText(summaryResult.data.free_text ?? '');
        } else if (parcel) {
          // First visit: start the description from what we already know about the parcel.
          const place = parcel.village || parcel.location || parcel.name;
          const area = parcel.area_acres ? `${parcel.area_acres} acre ` : '';
          setFreeText(`${area}residential plot in ${place}. `);
        }
        if (approvalsResult.error) {
          setError('Could not load approvals.');
        } else {
          setApprovals(approvalsResult.data ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [parcelId]);

  const analyze = useCallback(async () => {
    if (!freeText.trim()) return;
    Keyboard.dismiss();
    setAnalyzing(true);
    setError(null);
    const { data, error: apiError } = await api.POST(
      '/land-parcels/{parcelID}/approvals/analyze',
      { params: { path: { parcelID: parcelId } }, body: { free_text: freeText } },
    );
    if (apiError) {
      setAnalyzing(false);
      setError('Could not read this description. Try again.');
      return;
    }
    setApprovals(data ?? []);
    const { data: s } = await api.GET('/land-parcels/{parcelID}/site-summary', {
      params: { path: { parcelID: parcelId } },
    });
    if (s) setSummary(s);
    setAnalyzing(false);
  }, [freeText, parcelId]);

  const setStatus = useCallback(async (approval: Approval, status: ApprovalStatus) => {
    setError(null);
    const previous = approvals;
    // Submitting records today's date so the day counter ("Submitted · 18d") starts now.
    const submittedAt =
      status === 'submitted'
        ? approval.status === 'submitted' && approval.submitted_at
          ? approval.submitted_at
          : new Date().toISOString()
        : null;
    setApprovals(list =>
      list.map(a => (a.id === approval.id ? { ...a, status, submitted_at: submittedAt } : a)),
    );
    const { data, error: apiError } = await api.PATCH('/approvals/{approvalID}/status', {
      params: { path: { approvalID: approval.id! } },
      body: { status, submitted_at: submittedAt },
    });
    if (apiError || !data) {
      setApprovals(previous);
      setError('Could not save that status. Try again.');
      return;
    }
    setApprovals(list => list.map(a => (a.id === data.id ? data : a)));
  }, [approvals]);

  const header = (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
        <Text style={styles.backArrow}>←</Text>
      </Pressable>
      <Text style={styles.title}>Government Approvals</Text>
      {parcelName ? <Text style={styles.subtitle}>{parcelName}</Text> : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const applicable = approvals.filter(a => a.status !== 'not_applicable');
  const filteredOut = approvals.length - applicable.length;
  const approvedCount = applicable.filter(a => a.status === 'approved').length;
  const pct = applicable.length > 0 ? Math.round((approvedCount / applicable.length) * 100) : 0;
  const analyzed = approvals.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {header}

      <Text style={styles.sectionHeading}>TELL US ABOUT YOUR PROJECT</Text>
      <View style={styles.card}>
        <TextInput
          style={styles.textInput}
          multiline
          value={freeText}
          onChangeText={setFreeText}
          placeholder="e.g. 3.5 acre residential plot in Nilaje. Inland site, no big trees, 2 borewells for construction water, not near an airport. About 140 units."
          placeholderTextColor={colors.outline}
        />
        <View style={styles.cardFooter}>
          <Text style={styles.hint}>
            {summary ? 'AI understood this · edit anytime' : 'Mention site, trees, water, airport, units'}
          </Text>
          <Pressable
            onPress={analyze}
            disabled={analyzing || !freeText.trim()}
            style={[styles.analyzeButton, (analyzing || !freeText.trim()) && styles.disabled]}>
            <Text style={styles.analyzeButtonText}>
              {analyzing ? 'Reading…' : analyzed ? 'Re-analyze ↻' : 'Work out approvals'}
            </Text>
          </Pressable>
        </View>
        {summary ? (
          <View style={styles.chips}>
            {chipsFor(summary).map(c => (
              <View key={c} style={styles.chip}>
                <Text style={styles.chipText}>{c}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {analyzed ? (
        <>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>
                {approvedCount} of {applicable.length} approved
              </Text>
              <Text style={styles.progressPct}>{pct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            {filteredOut > 0 ? (
              <Text style={styles.filteredNote}>
                {filteredOut} filtered out based on your project summary · tap one if that's wrong
              </Text>
            ) : null}
          </View>

          <Text style={styles.sectionHeading}>MAHARASHTRA APPROVAL SEQUENCE</Text>
          <View style={styles.card}>
            {approvals.map((a, i) => {
              const style = STATUS_STYLE[a.status!];
              const reason = a.applicability_condition
                ? CONDITION_REASON[a.applicability_condition]
                : undefined;
              const na = a.status === 'not_applicable';
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setEditing(a)}
                  style={[styles.row, i < approvals.length - 1 && styles.divider]}>
                  <View style={styles.rowTextBlock}>
                    <Text style={[styles.rowLabel, na && styles.rowLabelMuted]}>
                      {a.approval_name}
                    </Text>
                    {reason ? (
                      <Text style={styles.rowReason}>
                        {na ? reason.excluded : reason.included} ·{' '}
                        <Text style={styles.notRight}>not right?</Text>
                      </Text>
                    ) : a.description ? (
                      <Text style={styles.rowNote}>{a.description}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.pill, { backgroundColor: style.bg }]}>
                    <Text style={[styles.pillText, { color: style.text }]}>
                      {style.label}
                      {a.status === 'submitted' && a.submitted_at
                        ? ` · ${daysAgo(a.submitted_at)}d`
                        : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.disclaimer}>
            Sequence from the maintained Maharashtra playbook · not a speed guarantee, department
            timelines vary.
          </Text>

          <Pressable onPress={onSeeLandTenure} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Land Tenure &amp; JDA Structure →</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No approval list yet</Text>
          <Text style={styles.emptyText}>
            Describe the project above and tap "Work out approvals". You'll get the Maharashtra
            sequence with the steps that don't apply already filtered out.
          </Text>
        </View>
      )}

      {editing ? (
        <StatusSheet
          approval={editing}
          onClose={() => setEditing(null)}
          onPick={status => {
            setStatus(editing, status);
            setEditing(null);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function StatusSheet({
  approval,
  onPick,
  onClose,
}: {
  approval: Approval;
  onPick: (status: ApprovalStatus) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{approval.approval_name}</Text>
          {approval.applicability_condition ? (
            <Text style={styles.sheetNote}>
              Changing whether this applies here sticks until the description changes it on the
              next Re-analyze.
            </Text>
          ) : null}
          {STATUS_CHOICES.map(s => {
            const active = s === approval.status;
            return (
              <Pressable
                key={s}
                onPress={() => onPick(s)}
                style={[styles.choice, active && styles.choiceActive]}>
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                  {STATUS_CHOICE_LABEL[s]}
                </Text>
                {active ? <Text style={styles.choiceTextActive}>✓</Text> : null}
              </Pressable>
            );
          })}
          <Pressable style={styles.sheetCancel} onPress={onClose}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { gap: 2, marginBottom: 6 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backArrow: { fontSize: 22, color: colors.onSurface },
  title: { fontSize: 24, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: 13, color: colors.onSurfaceVariant },

  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: colors.onSurfaceVariant,
    marginTop: 10,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    overflow: 'hidden',
  },
  textInput: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
    paddingHorizontal: 16,
    paddingTop: 14,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  hint: { flex: 1, fontSize: 11, color: colors.onSurfaceVariant },
  analyzeButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  analyzeButtonText: { fontSize: 12, fontWeight: '700', color: colors.onPrimary },
  disabled: { opacity: 0.4 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
    paddingTop: 12,
  },
  chip: {
    backgroundColor: colors.infoContainer,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.onInfoContainer },

  progressCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 4,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  progressPct: { fontSize: 15, fontWeight: '700', color: colors.secondary },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceContainer,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.secondary },
  filteredNote: { fontSize: 11, color: colors.onSurfaceVariant },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer },
  rowTextBlock: { flex: 1, gap: 3 },
  rowLabel: { fontSize: 14, color: colors.onSurface },
  rowLabelMuted: { color: colors.outline },
  rowReason: { fontSize: 11, color: colors.onSurfaceVariant },
  notRight: { color: colors.onSurface, fontWeight: '600', textDecorationLine: 'underline' },
  rowNote: { fontSize: 11, color: colors.onSurfaceVariant },
  pill: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10 },
  pillText: { fontSize: 11, fontWeight: '700' },

  disclaimer: { fontSize: 11, color: colors.outline, textAlign: 'center', paddingHorizontal: 8 },
  errorText: { fontSize: 12, color: colors.error },

  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },

  emptyCard: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    marginTop: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  emptyText: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
    gap: 8,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface, marginBottom: 4 },
  sheetNote: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 4 },
  choice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  choiceActive: { borderColor: colors.primary, backgroundColor: colors.surfaceContainer },
  choiceText: { fontSize: 14, color: colors.onSurface },
  choiceTextActive: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  sheetCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  sheetCancelText: { fontSize: 14, fontWeight: '600', color: colors.onSurfaceVariant },
});
