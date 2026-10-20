import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type LegalCheck = components['schemas']['LegalCheck'];
type ReportSummary = components['schemas']['ReportSummary'];

type Props = {
  parcelId: string;
  onBack: () => void;
  onOpenLegalCheck: () => void;
  onOpenReport: (reportId: string) => void;
};

// Screen 6.1: Order a Report. The product builders pay for (council review, 2026-10-02): the
// Parcel Due-Diligence Report, as a Quick Screen (automated, for shortlisting) or a Full Report
// (signed by a partner advocate). No prices or turnaround times are shown: the owner sets them
// after showing the report to clients. Payment isn't connected: ordering creates a draft.

type Tier = 'quick' | 'full';

const TIERS: Record<Tier, { name: string; bestFor: string; who: string; body: string }> = {
  quick: {
    name: 'Quick Screen',
    bestFor: 'For shortlisting: compare several parcels before you pick one',
    who: 'From public records · no lawyer',
    body: 'A first look at each parcel: warning signs, the seller’s track record, what it’s worth and what’s being built nearby. It doesn’t include a title search.',
  },
  full: {
    name: 'Full Report',
    bestFor: 'For the one parcel you plan to buy',
    who: 'Checked and signed by a partner advocate',
    body: 'Everything in the Quick Screen, plus an advocate traces who owned the land over the last 30 years and signs a title opinion, so title problems surface before you pay a token.',
  },
};

const SECTIONS: { name: string; tier: 'both' | 'full'; note?: string }[] = [
  { name: 'A. Snapshot', tier: 'both' },
  { name: 'B. 30-year title chain', tier: 'full' },
  { name: 'C. Encumbrance & litigation', tier: 'both', note: 'Quick: public records · Full: advocate search' },
  { name: 'D. Land status (class, NA, tenancy, CRZ)', tier: 'both' },
  { name: 'E. Development potential', tier: 'both' },
  { name: 'F. Seller & co-developer track record', tier: 'both' },
  { name: 'G. Valuation, today and in 5 years', tier: 'both' },
  { name: 'H. Verdict + signed title opinion', tier: 'full' },
];

// Papers the report needs, matched against the Legal Check's document list by name.
const NEEDED: { label: string; match: RegExp }[] = [
  { label: '7/12 extract', match: /7\/12/ },
  { label: 'Mutation entries (Ferfar)', match: /mutation|ferfar/i },
  { label: 'Title / last sale deed', match: /title|sale deed/i },
];

type LandRecord = { survey_number: string; village: string; taluka: string; district: string };
type VillageMatch = { district: string; taluka: string; village: string };

// The survey/gat number and village identify the land on its 7/12. Every land record lookup
// needs them, so the report can't be ordered without them.
function LandRecordCard({
  parcelId,
  initial,
  onSaved,
}: {
  parcelId: string;
  initial: LandRecord | null;
  onSaved: (r: LandRecord) => void;
}) {
  const [editing, setEditing] = useState(!initial);
  const [survey, setSurvey] = useState(initial?.survey_number ?? '');
  const [query, setQuery] = useState(initial?.village ?? '');
  const [picked, setPicked] = useState<VillageMatch | null>(
    initial ? { district: initial.district, taluka: initial.taluka, village: initial.village } : null,
  );
  const [matches, setMatches] = useState<VillageMatch[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!editing || query.trim().length < 3 || (picked && picked.village === query)) {
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await api.GET('/reference/geography/villages/search', { params: { query: { q: query.trim() } } });
      setMatches(
        (data?.results ?? [])
          .filter((m): m is VillageMatch => !!m.district && !!m.taluka && !!m.village)
          .slice(0, 6),
      );
    }, 300);
    return () => clearTimeout(t);
  }, [query, editing, picked]);

  if (!editing && initial) {
    return (
      <View style={styles.card}>
        <View style={[styles.row, styles.divider]}>
          <Text style={styles.rowLabel}>Survey / gat no.</Text>
          <Text style={styles.rowValue}>{initial.survey_number}</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Village</Text>
            <Text style={styles.rowNote}>{initial.taluka}, {initial.district}</Text>
          </View>
          <Text style={styles.rowValue}>{initial.village}</Text>
        </View>
        <Pressable onPress={() => setEditing(true)}>
          <Text style={styles.editLink}>Change</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.formCard]}>
      <Text style={styles.formHint}>
        As written on the 7/12. We use these to pull the land records, so the report can’t start without them.
      </Text>
      <Text style={styles.fieldLabel}>Survey / gat number(s), with hissa</Text>
      <TextInput style={styles.input} value={survey} onChangeText={setSurvey} placeholder="e.g. 45/2A, or 42/3, 42/4/2 if the land spans several" placeholderTextColor={colors.outline} />
      <Text style={styles.fieldLabel}>Village</Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={(v: string) => {
          setQuery(v);
          setPicked(null);
        }}
        placeholder="Type 3 letters, e.g. Nilaje"
        placeholderTextColor={colors.outline}
      />
      {picked ? <Text style={styles.rowNote}>{picked.taluka} taluka, {picked.district} district</Text> : null}
      {matches.map(m => (
        <Pressable
          key={`${m.district}/${m.taluka}/${m.village}`}
          style={styles.match}
          onPress={() => {
            setPicked(m);
            setQuery(m.village);
            setMatches([]);
          }}>
          <Text style={styles.rowLabel}>{m.village}</Text>
          <Text style={styles.rowNote}>{m.taluka}, {m.district}</Text>
        </Pressable>
      ))}
      {err ? <Text style={styles.errorText}>{err}</Text> : null}
      <Pressable
        style={[styles.saveButton, (!picked || !survey.trim() || saving) && styles.disabled]}
        disabled={!picked || !survey.trim() || saving}
        onPress={async () => {
          if (!picked) return;
          setSaving(true);
          setErr(null);
          const body = { ...picked, survey_number: survey.trim() };
          const { error: e } = await api.PUT('/land-parcels/{id}/land-record', { params: { path: { id: parcelId } }, body });
          setSaving(false);
          if (e) {
            setErr((e as { error?: string }).error ?? 'Could not save. Try again.');
            return;
          }
          setEditing(false);
          onSaved(body);
        }}>
        <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save land details'}</Text>
      </Pressable>
    </View>
  );
}

export function OrderReportScreen({ parcelId, onBack, onOpenLegalCheck, onOpenReport }: Props) {
  const [tier, setTier] = useState<Tier>('full');
  const [parcelName, setParcelName] = useState('');
  const [facts, setFacts] = useState('');
  const [legal, setLegal] = useState<LegalCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landRecord, setLandRecord] = useState<LandRecord | null>(null);

  useEffect(() => {
    Promise.all([
      api.GET('/land-parcels/{id}', { params: { path: { id: parcelId } } }),
      api.GET('/land-parcels/{parcelID}/legal-check', { params: { path: { parcelID: parcelId } } }),
      api.GET('/land-parcels/{parcelID}/reports', { params: { path: { parcelID: parcelId } } }),
    ])
      .then(([p, l, r]) => {
        setReports(r.data ?? []);
        const parcel = p.data;
        setParcelName(parcel?.name ?? '');
        setFacts(
          [parcel?.village || parcel?.location, parcel?.area_acres ? `${parcel.area_acres} acres` : '']
            .filter(Boolean)
            .join(' · '),
        );
        setLegal(l.data ?? null);
        if (parcel?.survey_number && parcel.village && parcel.taluka && parcel.district) {
          setLandRecord({ survey_number: parcel.survey_number, village: parcel.village, taluka: parcel.taluka, district: parcel.district });
        }
      })
      .finally(() => setLoading(false));
  }, [parcelId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const docs = legal?.documents ?? [];
  const docStatus = NEEDED.map(n => {
    const d = docs.find(x => n.match.test(x.document_type ?? ''));
    return { label: n.label, received: d?.status === 'received' };
  });
  const missing = docStatus.filter(d => !d.received).length;
  const chosen = TIERS[tier];
  // The open (unsigned) draft of the chosen type, if any: ordering again just opens it.
  const openDraft = reports.find(r => r.tier === tier && r.status === 'draft');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>Order a Report</Text>
        <Text style={styles.subtitle}>{[parcelName, facts].filter(Boolean).join(' · ')}</Text>
      </View>

      {reports.length ? (
        <>
          <Text style={styles.sectionHeading}>YOUR REPORTS</Text>
          <View style={styles.card}>
            {reports.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => onOpenReport(r.id)}
                style={[styles.row, i < reports.length - 1 && styles.divider]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>
                    {r.tier === 'full' ? 'Full Report' : 'Quick Screen'}
                  </Text>
                  <Text style={styles.rowNote}>
                    {r.status === 'draft'
                      ? r.open_items.length
                        ? `Draft · to fill: ${r.open_items.join(', ')}`
                        : 'Draft · ready to sign'
                      : `${r.status === 'signed' ? 'Signed' : 'Issued'} ${new Date(r.finalised_at ?? r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionHeading}>{reports.length ? 'ORDER ANOTHER' : 'CHOOSE A REPORT'}</Text>
      {(Object.keys(TIERS) as Tier[]).map(key => {
        const t = TIERS[key];
        const active = key === tier;
        return (
          <Pressable
            key={key}
            onPress={() => setTier(key)}
            style={[styles.tierCard, active && styles.tierActive]}>
            <View style={styles.tierTop}>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={styles.tierName}>{t.name}</Text>
            </View>
            <Text style={styles.tierBestFor}>{t.bestFor}</Text>
            <Text style={styles.tierBody}>{t.body}</Text>
            <Text style={styles.tierTime}>{t.who}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.sectionHeading}>LAND RECORD DETAILS</Text>
      <LandRecordCard parcelId={parcelId} initial={landRecord} onSaved={setLandRecord} />

      <Text style={styles.sectionHeading}>WHAT'S INCLUDED</Text>
      <View style={styles.card}>
        {SECTIONS.map((s, i) => {
          const included = s.tier === 'both' || tier === 'full';
          return (
            <View key={s.name} style={[styles.row, i < SECTIONS.length - 1 && styles.divider]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, !included && styles.muted]}>{s.name}</Text>
                {s.note ? <Text style={styles.rowNote}>{s.note}</Text> : null}
              </View>
              <View style={[styles.pill, included ? styles.pillOk : styles.pillMuted]}>
                <Text style={[styles.pillText, included ? styles.pillTextOk : styles.pillTextMuted]}>
                  {included ? 'Included' : 'Full only'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionHeading}>PAPERS WE NEED</Text>
      <View style={styles.card}>
        {docStatus.map((d, i) => (
          <View key={d.label} style={[styles.row, i < docStatus.length - 1 && styles.divider]}>
            <Text style={styles.rowLabel}>{d.label}</Text>
            <View style={[styles.pill, d.received ? styles.pillOk : styles.pillWarn]}>
              <Text style={[styles.pillText, d.received ? styles.pillTextOk : styles.pillTextWarn]}>
                {d.received ? 'Received' : 'Needed'}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable onPress={onOpenLegalCheck}>
        <Text style={styles.note}>
          {missing
            ? `${missing} paper${missing > 1 ? 's' : ''} still needed. The report starts once the 7/12 and Ferfar are in. Mark papers received in the Legal & RERA check ›`
            : 'All papers in. The report can start right away.'}
        </Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!landRecord ? <Text style={styles.note}>Save the survey number and village above to order.</Text> : null}
      <Pressable
        style={[styles.primaryButton, (ordering || (!landRecord && !openDraft)) && styles.disabled]}
        disabled={ordering || (!landRecord && !openDraft)}
        onPress={() => {
          // A draft of this type is already open: carry on with it rather than start another.
          if (openDraft) {
            onOpenReport(openDraft.id);
            return;
          }
          Alert.alert(`Order a ${chosen.name}?`, `This starts a new ${chosen.name} for ${parcelName || 'this parcel'}.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Order',
              onPress: async () => {
                setOrdering(true);
                setError(null);
                const { data, error: e } = await api.POST('/land-parcels/{parcelID}/reports', {
                  params: { path: { parcelID: parcelId } },
                  body: { tier },
                });
                setOrdering(false);
                if (e || !data) {
                  setError('Could not create the report. Try again.');
                  return;
                }
                onOpenReport(data.id);
              },
            },
          ]);
        }}>
        <Text style={styles.primaryButtonText}>
          {ordering ? 'Creating…' : openDraft ? `Open your ${chosen.name} draft` : `Order ${chosen.name}`}
        </Text>
      </Pressable>
      <Text style={styles.footnote}>
        Every line of the report names its source and date.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  chevron: { fontSize: 22, color: colors.outline },
  errorText: { fontSize: 12, color: colors.error },
  disabled: { opacity: 0.5 },
  content: { padding: 20, paddingBottom: 40, gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { gap: 2, marginBottom: 4 },
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

  tierCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  tierActive: { borderColor: colors.primary, borderWidth: 2 },
  tierTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tierName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.onSurface },
  tierBestFor: { fontSize: 13, fontWeight: '600', color: colors.onSurface, marginLeft: 30 },
  tierTime: { fontSize: 12, color: colors.onSurfaceVariant, marginLeft: 30 },
  tierBody: { fontSize: 13, lineHeight: 19, color: colors.onSurface, marginLeft: 30 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14, color: colors.onSurface, flexShrink: 1 },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  editLink: { fontSize: 13, fontWeight: '700', color: colors.onSurface, paddingHorizontal: 16, paddingBottom: 12 },
  formCard: { padding: 16, gap: 8 },
  formHint: { fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.onSurface,
  },
  match: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer },
  saveButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  muted: { color: colors.outline },
  rowNote: { fontSize: 11, color: colors.onSurfaceVariant },
  pill: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10 },
  pillOk: { backgroundColor: colors.secondaryContainer },
  pillWarn: { backgroundColor: '#f5efdc' },
  pillMuted: { backgroundColor: colors.surfaceContainer },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillTextOk: { color: colors.onSecondaryContainer },
  pillTextWarn: { color: '#8a6a1a' },
  pillTextMuted: { color: colors.outline },

  note: { fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant, paddingHorizontal: 4 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  footnote: { fontSize: 11, color: colors.outline, textAlign: 'center', paddingHorizontal: 8 },
});
