import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

type Detail = components['schemas']['ReportDetail'];
type Sections = components['schemas']['ReportSections'];
type Edits = components['schemas']['ReportEdits'];

type Props = {
  reportId: string;
  onBack: () => void;
  onOpenLegalCheck: () => void;
  onOpenSevenTwelve: () => void;
};

// Screen 6.2: the Parcel Due-Diligence Report (services/duediligencereport/README.md). Sections
// A, B, C, F, G come from the parcel's existing data; D, E and the verdict (H) are filled here.
// The AI can draft the verdict; a person edits it; a Full report is signed by an advocate, a Quick
// Screen is issued. Once final, the report is frozen and nothing can be edited.

const AMBER = '#8a6a1a';
const AMBER_BG = '#f5efdc';
const RED_BG = '#fbe9e5';

const VERDICT_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  go: { label: 'Go', bg: colors.secondaryContainer, text: colors.onSecondaryContainer },
  fix_first: { label: 'Fix first, then buy', bg: AMBER_BG, text: AMBER },
  no_go: { label: 'Don’t buy', bg: RED_BG, text: colors.error },
};

const OCCUPANCY: Record<string, string> = { unknown: 'Not checked yet', class_1: 'Class I', class_2: 'Class II' };
const NA: Record<string, string> = {
  unknown: 'Not checked yet',
  na_granted: 'NA order granted',
  in_process: 'NA applied, in process',
  not_na: 'Agricultural, no NA',
  not_needed: 'Not needed (zone allows it)',
};
const RISK_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer, label: 'Low' },
  medium: { bg: AMBER_BG, text: AMBER, label: 'Medium' },
  high: { bg: RED_BG, text: colors.error, label: 'High' },
  not_checked: { bg: colors.surfaceContainer, text: colors.onSurfaceVariant, label: 'Not checked' },
};

// Planning authority types as UDCPR Table 6-G groups them (the FSI band depends on it).
const AUTHORITY: Record<string, string> = {
  municipal_corporation: 'Municipal corporation',
  other: 'Council, PMRDA / MMRDA area',
  regional_plan_no_pa: 'Regional Plan, no authority',
  mumbai: 'Mumbai (DCPR)',
  cidco_naina: 'CIDCO / NAINA',
};
const WHO: Record<string, string> = { team: 'Our team', advocate: 'Advocate', builder: 'You' };

// A gap in the report reads as work in progress, never as a blank.
const TO_COLLECT = 'To collect';

function crore(r?: number | null): string {
  if (r == null) return 'Not recorded';
  const cr = r / 1e7;
  return `₹${cr >= 10 ? cr.toFixed(1) : cr.toFixed(2)} Cr`;
}
function day(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function editsFrom(s: Sections): Edits {
  return {
    occupancy_class: (s.occupancy_class as Edits['occupancy_class']) || 'unknown',
    na_status: (s.na_status as Edits['na_status']) || 'unknown',
    tenancy_remarks: s.tenancy_remarks ?? '',
    crz_forest_esz: s.crz_forest_esz ?? '',
    dp_zone: s.dp_zone ?? '',
    dp_reservation: s.dp_reservation ?? '',
    base_fsi: s.base_fsi ?? null,
    max_fsi: s.max_fsi ?? null,
    planning_authority: (s.planning_authority as Edits['planning_authority']) || '',
    road_width_m: s.road_width_m ?? null,
    development_note: s.development_note ?? '',
    verdict: (s.verdict as Edits['verdict']) || '',
    verdict_summary: s.verdict_summary ?? '',
    fix_list: s.fix_list ?? [],
  };
}

// ---- Small pieces --------------------------------------------------------------------------

function Section({
  letter,
  title,
  onEdit,
  children,
}: {
  letter: string;
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionHeading}>
          {letter}. {title.toUpperCase()}
        </Text>
        {onEdit ? (
          <Pressable onPress={onEdit} hitSlop={10}>
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value, sub, last }: { label: string; value?: React.ReactNode; sub?: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {typeof value === 'string' ? (
        <Text style={[styles.rowValue, value === TO_COLLECT && styles.rowValuePending]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

function Pill({ bg, text, label }: { bg: string; text: string; label: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: text }]}>{label}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>{title}</Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {(Object.keys(options) as T[]).map(k => (
        <Pressable key={k} onPress={() => onChange(k)} style={[styles.chip, value === k && styles.chipActive]}>
          <Text style={[styles.chipText, value === k && styles.chipTextActive]}>{options[k]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        multiline={multiline}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
      />
    </View>
  );
}

function SheetButtons({ onCancel, onSave, saveLabel }: { onCancel: () => void; onSave: () => void; saveLabel?: string }) {
  return (
    <View style={styles.sheetActions}>
      <Pressable style={styles.secondaryBtn} onPress={onCancel}>
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </Pressable>
      <Pressable style={styles.primaryBtnSmall} onPress={onSave}>
        <Text style={styles.primaryBtnText}>{saveLabel ?? 'Save'}</Text>
      </Pressable>
    </View>
  );
}

// ---- Screen --------------------------------------------------------------------------------

export function ReportScreen({ reportId, onBack, onOpenLegalCheck, onOpenSevenTwelve }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'land' | 'dev' | 'verdict' | 'sign' | null>(null);
  const [draft, setDraft] = useState<Edits | null>(null);
  const [advocate, setAdvocate] = useState({ name: '', enrolment: '' });

  const load = useCallback(async () => {
    const { data } = await api.GET('/reports/{reportID}', { params: { path: { reportID: reportId } } });
    if (data) setDetail(data);
    return data;
  }, [reportId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const save = async (edits: Edits) => {
    setBusy('save');
    setError(null);
    const { error: e } = await api.PUT('/reports/{reportID}', {
      params: { path: { reportID: reportId } },
      body: edits,
    });
    if (e) setError('Could not save. Try again.');
    await load();
    setBusy(null);
    setSheet(null);
  };

  const draftVerdict = async () => {
    setBusy('ai');
    setError(null);
    const { error: e } = await api.POST('/reports/{reportID}/draft-verdict', {
      params: { path: { reportID: reportId } },
    });
    if (e) setError('The AI could not draft a verdict right now. Try again.');
    await load();
    setBusy(null);
  };

  const finalise = async () => {
    setBusy('sign');
    setError(null);
    const { error: e } = await api.POST('/reports/{reportID}/finalise', {
      params: { path: { reportID: reportId } },
      body: { advocate_name: advocate.name, advocate_enrolment: advocate.enrolment },
    });
    if (e) {
      const msg = (e as { error?: string }).error;
      setError(msg ? `Not signed: ${msg}.` : 'Could not finalise. Try again.');
    }
    await load();
    setBusy(null);
    setSheet(null);
  };

  if (loading || !detail) {
    return (
      <View style={styles.centered}>
        {loading ? <ActivityIndicator /> : <Text style={styles.empty}>Report not found.</Text>}
      </View>
    );
  }

  const s = detail.sections;
  const final = detail.status !== 'draft';
  const full = detail.tier === 'full';
  const reqs = s.requirements ?? [];
  // What blocks finishing: a Quick Screen waits for its own items, a Full Report for all of them
  // (the verdict is already counted in open_items).
  const blocking = reqs.filter(r => r.section !== 'H' && (full || r.in_quick));
  const open = [...detail.open_items, ...(blocking.length ? [`${blocking.length} item${blocking.length > 1 ? 's' : ''} to collect`] : [])];
  const vstyle = s.verdict ? VERDICT_STYLE[s.verdict] : undefined;
  const aiDrafted = s.verdict_source === 'ai_draft' || s.verdict_source === 'edited';
  const edit = (which: 'land' | 'dev' | 'verdict') =>
    final
      ? undefined
      : () => {
          setDraft(editsFrom(s));
          setSheet(which);
        };
  const statusLabel =
    detail.status === 'signed'
      ? `Signed ${day(detail.finalised_at)}`
      : detail.status === 'issued'
        ? `Issued ${day(detail.finalised_at)}`
        : 'Draft';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>Due-Diligence Report</Text>
        <View style={styles.subRow}>
          <Text style={styles.subtitle}>
            {s.parcel_name} · {full ? 'Full Report' : 'Quick Screen'}
          </Text>
          <Pill
            bg={final ? colors.secondaryContainer : colors.surfaceContainer}
            text={final ? colors.onSecondaryContainer : colors.onSurfaceVariant}
            label={statusLabel}
          />
        </View>
      </View>

      {final ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            {detail.status === 'signed'
              ? `Signed by ${s.advocate_name} (${s.advocate_enrolment}) on ${day(s.finalised_at)}. This report is frozen and won’t change.`
              : `Issued on ${day(s.finalised_at)} without a lawyer. This report is frozen and won’t change.`}
          </Text>
        </View>
      ) : null}

      {/* Verdict first: it's what a builder reads. */}
      {vstyle ? (
        <View style={[styles.verdictCard, { backgroundColor: vstyle.bg }]}>
          <Text style={[styles.verdictTitle, { color: vstyle.text }]}>{vstyle.label}</Text>
          {s.verdict_summary ? <Text style={[styles.verdictText, { color: vstyle.text }]}>{s.verdict_summary}</Text> : null}
          {aiDrafted && !final ? (
            <Text style={[styles.verdictMeta, { color: vstyle.text }]}>
              {s.verdict_source === 'edited' ? 'AI draft, edited' : 'Drafted by AI'} · check it before signing
            </Text>
          ) : null}
        </View>
      ) : null}

      {!final ? (
        <View style={styles.todoCard}>
          {open.length ? (
            <Text style={styles.todoText}>To finish: {open.join(' · ')}</Text>
          ) : (
            <Text style={styles.todoText}>Everything needed is filled in. Review, then {full ? 'sign' : 'issue'}.</Text>
          )}
          <Pressable
            style={[styles.secondaryWide, busy === 'ai' && styles.disabled]}
            disabled={busy === 'ai'}
            onPress={draftVerdict}>
            <Text style={styles.secondaryBtnText}>
              {busy === 'ai' ? 'Drafting…' : s.verdict ? 'Redraft verdict with AI' : 'Draft verdict with AI'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!final && reqs.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>STILL TO COLLECT</Text>
          <Text style={styles.sectionAbout}>
            {full
              ? 'Everything below is collected before the advocate signs, so the finished report has no gaps.'
              : 'Items marked Full Report come with the advocate’s search. The rest are collected before this Quick Screen is issued.'}
          </Text>
          <View style={styles.card}>
            {reqs.map((r, i) => {
              const later = !full && !r.in_quick;
              return (
                <Row
                  key={r.section + r.item}
                  label={`${r.section}. ${r.item}`}
                  sub={r.source}
                  last={i === reqs.length - 1}
                  value={
                    <Pill
                      bg={later ? colors.surfaceContainer : colors.infoContainer}
                      text={later ? colors.onSurfaceVariant : colors.onInfoContainer}
                      label={later ? 'Full Report' : WHO[r.who] ?? r.who}
                    />
                  }
                />
              );
            })}
          </View>
        </View>
      ) : null}

      <Section letter="A" title="Snapshot">
        <Row label="Location" value={s.latitude != null ? `Pinned · ${s.latitude.toFixed(4)}, ${s.longitude?.toFixed(4)}` : s.location} />
        <Row label="Survey / gat no." value={s.survey_number || TO_COLLECT} />
        <Row label="Village" value={s.village || TO_COLLECT} sub={[s.taluka, s.district].filter(Boolean).join(', ') || undefined} />
        <Row label="Area" value={s.area_acres != null ? `${s.area_acres} acres` : TO_COLLECT} />
        <Row label="Asking price" value={s.asking_rupees != null ? crore(s.asking_rupees) : 'No price'} />
        <Pressable onPress={final ? undefined : onOpenSevenTwelve}>
          <Row label="7/12 extract" last
            value={s.seven_twelve ? `Checked ${day(s.seven_twelve.confirmed_at)}` : TO_COLLECT}
            sub={final ? undefined : s.seven_twelve ? 'Tap to read a newer one' : 'Tap to add a photo; the AI reads it, you check it'} />
        </Pressable>
      </Section>

      {s.seven_twelve ? (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>FROM THE 7/12</Text>
          {s.seven_twelve.flags.map((f, i) => (
            <View key={i} style={[styles.flag, { backgroundColor: f.level === 'high' ? RED_BG : AMBER_BG }]}>
              <Text style={[styles.flagText, { color: f.level === 'high' ? colors.error : AMBER }]}>{f.text}</Text>
            </View>
          ))}
          <View style={styles.card}>
            <Row label="Tenure" value={s.seven_twelve.data.tenure === 'class_2' ? 'Class II' : s.seven_twelve.data.tenure === 'class_1' ? 'Class I' : s.seven_twelve.data.tenure === 'govt_lease' ? 'Govt. lease' : TO_COLLECT} />
            <Row label="Area on the 7/12" value={`${s.seven_twelve.data.total_area_hr} ha`}
              sub={s.seven_twelve.area_acres != null ? `${s.seven_twelve.area_acres.toFixed(2)} acres` : undefined} />
            {s.seven_twelve.data.owners.filter(o => !o.former).map((o, i) => (
              <Row key={i} label={o.name} sub={o.mutation_no ? `Holder · mutation ${o.mutation_no}` : 'Holder'} value={o.area_hr ? `${o.area_hr} ha` : undefined} />
            ))}
            <Row label="Last mutation" value={s.seven_twelve.data.last_mutation || TO_COLLECT} last />
          </View>
        </View>
      ) : null}

      <Section letter="B" title="Title chain (30 years)">
        {s.title_chain.length ? (
          s.title_chain.map((c, i) => (
            <Row key={i} label={c.title ?? ''} sub={c.description} last={i === s.title_chain.length - 1}
              value={c.is_final ? <Pill bg={colors.secondaryContainer} text={colors.onSecondaryContainer} label="End of chain" /> : undefined} />
          ))
        ) : (
          <Pressable onPress={onOpenLegalCheck}>
            <Empty text="To collect: owners over the last 30 years, from the mutation register and Index-II. Record them in the Legal & RERA check ›" />
          </Pressable>
        )}
      </Section>

      <Section letter="C" title="Encumbrance & litigation">
        {s.legal_check_started ? (
          <>
            {s.risks.map(r => {
              const st = RISK_STYLE[r.level] ?? RISK_STYLE.not_checked;
              return <Row key={r.area} label={r.area} sub={r.note} value={<Pill bg={st.bg} text={st.text} label={st.label} />} />;
            })}
            {s.searches.map(x => (
              <Row key={x.search_type} label={x.search_type ?? ''} value={x.completed ? 'Done' : 'Not done'} />
            ))}
            {s.documents.map((d, i) => (
              <Row key={d.document_type} label={d.document_type ?? ''} value={d.status === 'received' ? 'Received' : 'Pending'}
                last={i === s.documents.length - 1 && !s.search_summary} />
            ))}
            {s.search_summary ? <Text style={styles.cardNote}>{s.search_summary}</Text> : null}
          </>
        ) : (
          <Pressable onPress={onOpenLegalCheck}>
            <Empty text="The Legal & RERA check hasn’t been started. Start it ›" />
          </Pressable>
        )}
      </Section>

      <Section letter="D" title="Land status" onEdit={edit('land')}>
        <Row label="Occupancy class" value={s.occupancy_class && s.occupancy_class !== 'unknown' ? OCCUPANCY[s.occupancy_class] : TO_COLLECT} />
        <Row label="NA conversion" value={s.na_status && s.na_status !== 'unknown' ? NA[s.na_status] : TO_COLLECT} />
        <Row label="Tenancy and other rights" value={s.tenancy_remarks || TO_COLLECT} />
        <Row label="CRZ / forest / ESZ" value={s.crz_forest_esz || TO_COLLECT} />
        <Row label="Reservation on the plot" value={s.dp_reservation || TO_COLLECT} last />
      </Section>

      <Section letter="E" title="Development potential" onEdit={edit('dev')}>
        <Row label="DP zone" value={s.dp_zone || TO_COLLECT} />
        {s.planning_authority ? (
          <Row label="Planning authority" value={AUTHORITY[s.planning_authority] ?? s.planning_authority}
            sub={s.road_width_m != null ? `Access road ${s.road_width_m} m wide` : undefined} />
        ) : null}
        {s.max_fsi != null ? (
          <Row label="FSI (architect)" value={`${s.base_fsi ?? '?'} base · up to ${s.max_fsi}`} />
        ) : s.fsi_band ? (
          <Row label="FSI (UDCPR band)" value={`${s.fsi_band.basic} base · up to ${s.fsi_band.max}`}
            sub={`Up to ${s.fsi_band.max_with_ancillary} with ancillary FSI · ${s.fsi_band.source}. Architect confirms.`} />
        ) : (
          <Row label="FSI" value={TO_COLLECT} sub={s.fsi_note || undefined} />
        )}
        <Row label="Buildable area" value={s.buildable_sqft ? `${Math.round(s.buildable_sqft).toLocaleString('en-IN')} sq ft` : TO_COLLECT}
          sub={s.buildable_sqft ? 'Area × max FSI, before road and amenity deductions' : undefined} last={!s.development_note && !s.infrastructure.length} />
        {s.development_note ? <Text style={styles.cardNote}>{s.development_note}</Text> : null}
        {s.infrastructure.map((x, i) => (
          <Row key={x.name + i} label={x.name} last={i === s.infrastructure.length - 1}
            sub={x.planned ? `Planned · ${x.status ?? ''}` : 'Existing · watch out'}
            value={x.distance_km != null ? `${x.distance_km.toFixed(1)} km` : undefined} />
        ))}
      </Section>

      <Section letter="F" title="Seller & co-developer track record">
        {s.seller_projects.length ? (
          <>
            {s.seller_summary ? <Text style={styles.cardNote}>{s.seller_summary}</Text> : null}
            {s.seller_projects.slice(0, 5).map((p, i) => (
              <Row key={p.rera_registration_number ?? i} label={p.project_name ?? ''} sub={`MahaRERA ${p.rera_registration_number ?? ''}`}
                value={p.delivery_status} last={i === Math.min(4, s.seller_projects.length - 1) && s.seller_projects.length <= 5} />
            ))}
            {s.seller_projects.length > 5 ? <Text style={styles.cardNote}>+ {s.seller_projects.length - 5} more in the Legal & RERA check</Text> : null}
          </>
        ) : (
          <Pressable onPress={onOpenLegalCheck}>
            <Empty text="To collect: the seller’s MahaRERA projects and complaints. Search the seller in the Legal & RERA check ›" />
          </Pressable>
        )}
      </Section>

      <Section letter="G" title="Valuation">
        {s.valued && s.value_indicative ? (
          <Empty text="No registered sales or government rate on record for this area yet, so the report doesn’t put a value on it. Registered sale prices for the village and the ready-reckoner rate are on the list to collect." />
        ) : s.valued ? (
          <>
            <Row label="Value today" value={s.value_low_rupees != null && s.value_high_rupees != null ? `${crore(s.value_low_rupees)} to ${crore(s.value_high_rupees)}` : crore(s.value_likely_rupees)}
              sub={`Likely ${crore(s.value_likely_rupees)}`} />
            {s.future_likely_rupees ? <Row label={`Value in ${s.future_year}`} value={crore(s.future_likely_rupees)} /> : null}
            <Row label="Against asking" value={s.price_verdict || TO_COLLECT} sub={s.value_basis || undefined} last />
          </>
        ) : (
          <Empty text="To collect: run the valuation for this parcel on Feasibility & value." />
        )}
      </Section>

      <Section letter="H" title="Verdict" onEdit={edit('verdict')}>
        {s.verdict ? (
          <>
            <Row label="Verdict" value={<Pill bg={vstyle!.bg} text={vstyle!.text} label={vstyle!.label} />} last={!s.fix_list.length} />
            {s.fix_list.map((f, i) => (
              <Row key={i} label={f} last={i === s.fix_list.length - 1} />
            ))}
          </>
        ) : (
          <Empty text="No verdict yet. Tap “Draft verdict with AI”, or Edit to write it." />
        )}
      </Section>

      <Text style={styles.scope}>
        Scope: covers the documents and records listed above, as of {day(s.as_of)}. Government land records are
        presumptive, not a guarantee of title. {full ? 'The title opinion is the signing advocate’s.' : 'A Quick Screen is not a lawyer’s opinion.'}
      </Text>

      {!final ? (
        <Pressable
          style={[styles.primaryBtn, open.length > 0 && styles.disabled]}
          disabled={open.length > 0}
          onPress={() => (full ? setSheet('sign') : finalise())}>
          <Text style={styles.primaryBtnText}>{full ? 'Sign report' : 'Issue Quick Screen'}</Text>
        </Pressable>
      ) : null}

      {sheet === 'land' && draft ? (
        <Sheet title="Land status" onClose={() => setSheet(null)}>
          <Text style={styles.fieldLabel}>Occupancy class</Text>
          <Chips options={OCCUPANCY} value={(draft.occupancy_class ?? 'unknown') as keyof typeof OCCUPANCY}
            onChange={v => setDraft({ ...draft, occupancy_class: v as Edits['occupancy_class'] })} />
          <Text style={styles.fieldLabel}>NA conversion</Text>
          <Chips options={NA} value={(draft.na_status ?? 'unknown') as keyof typeof NA}
            onChange={v => setDraft({ ...draft, na_status: v as Edits['na_status'] })} />
          <Field label="Tenancy remarks (7/12 'other rights')" value={draft.tenancy_remarks ?? ''} onChange={v => setDraft({ ...draft, tenancy_remarks: v })} placeholder="e.g. None, or Sec. 43 restriction" />
          <Field label="CRZ / forest / ESZ" value={draft.crz_forest_esz ?? ''} onChange={v => setDraft({ ...draft, crz_forest_esz: v })} placeholder="e.g. Outside all three" />
          <Field label="DP reservation" value={draft.dp_reservation ?? ''} onChange={v => setDraft({ ...draft, dp_reservation: v })} placeholder="e.g. None, or 30% road widening" />
          <SheetButtons onCancel={() => setSheet(null)} onSave={() => save(draft)} saveLabel={busy === 'save' ? 'Saving…' : 'Save'} />
        </Sheet>
      ) : null}

      {sheet === 'dev' && draft ? (
        <Sheet title="Development potential" onClose={() => setSheet(null)}>
          <Field label="DP zone" value={draft.dp_zone ?? ''} onChange={v => setDraft({ ...draft, dp_zone: v })} placeholder="e.g. Residential" />
          <Text style={styles.fieldLabel}>Planning authority</Text>
          <Chips options={AUTHORITY} value={(draft.planning_authority || '') as keyof typeof AUTHORITY}
            onChange={v => setDraft({ ...draft, planning_authority: v as Edits['planning_authority'] })} />
          <Field label="Width of the access road (m)" numeric value={draft.road_width_m != null ? String(draft.road_width_m) : ''}
            onChange={v => setDraft({ ...draft, road_width_m: v ? parseFloat(v) || null : null })} placeholder="e.g. 12" />
          <Text style={styles.sheetNote}>With these two, the FSI band is worked out from UDCPR Table 6-G. Fill the FSI below only once the architect confirms it.</Text>
          <Field label="Base FSI (architect)" numeric value={draft.base_fsi != null ? String(draft.base_fsi) : ''}
            onChange={v => setDraft({ ...draft, base_fsi: v ? parseFloat(v) || null : null })} placeholder="e.g. 1.1" />
          <Field label="Max FSI (architect, with premium / TDR)" numeric value={draft.max_fsi != null ? String(draft.max_fsi) : ''}
            onChange={v => setDraft({ ...draft, max_fsi: v ? parseFloat(v) || null : null })} placeholder="e.g. 2.0" />
          <Field label="Note" multiline value={draft.development_note ?? ''} onChange={v => setDraft({ ...draft, development_note: v })} placeholder="e.g. Premium FSI and TDR available under UDCPR" />
          <SheetButtons onCancel={() => setSheet(null)} onSave={() => save(draft)} saveLabel={busy === 'save' ? 'Saving…' : 'Save'} />
        </Sheet>
      ) : null}

      {sheet === 'verdict' && draft ? (
        <Sheet title="Verdict" onClose={() => setSheet(null)}>
          <Chips options={{ go: 'Go', fix_first: 'Fix first', no_go: 'Don’t buy' }}
            value={(draft.verdict || 'fix_first') as 'go' | 'fix_first' | 'no_go'}
            onChange={v => setDraft({ ...draft, verdict: v })} />
          <Field label="Summary (what a builder reads first)" multiline value={draft.verdict_summary ?? ''} onChange={v => setDraft({ ...draft, verdict_summary: v })} />
          <Field label="What to fix (one per line, start with the section letter)" multiline
            value={(draft.fix_list ?? []).join('\n')}
            onChange={v => setDraft({ ...draft, fix_list: v.split('\n').filter(l => l.trim()) })}
            placeholder={'B: record the 2009 heirship mutation\nD: obtain the NA order'} />
          <SheetButtons onCancel={() => setSheet(null)} onSave={() => save({ ...draft, verdict: draft.verdict || 'fix_first' })} saveLabel={busy === 'save' ? 'Saving…' : 'Save'} />
        </Sheet>
      ) : null}

      {sheet === 'sign' ? (
        <Sheet title="Sign report" onClose={() => setSheet(null)}>
          <Text style={styles.sheetNote}>
            The advocate signs the title opinion. After signing, the report is frozen: nothing in it can change.
          </Text>
          <Field label="Advocate's name" value={advocate.name} onChange={v => setAdvocate({ ...advocate, name: v })} placeholder="Adv. full name" />
          <Field label="Bar Council enrolment number" value={advocate.enrolment} onChange={v => setAdvocate({ ...advocate, enrolment: v })} placeholder="e.g. MAH/1234/2015" />
          <SheetButtons onCancel={() => setSheet(null)} onSave={finalise} saveLabel={busy === 'sign' ? 'Signing…' : 'Sign and freeze'} />
        </Sheet>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { gap: 4 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 6 },
  backArrow: { fontSize: 22, color: colors.onSurface },
  title: { fontSize: 24, fontWeight: '700', color: colors.onSurface },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  subtitle: { fontSize: 13, color: colors.onSurfaceVariant },

  infoCard: { backgroundColor: colors.infoContainer, borderRadius: 12, padding: 14 },
  infoText: { fontSize: 13, lineHeight: 19, color: colors.onInfoContainer },

  verdictCard: { borderRadius: 14, padding: 16, gap: 6 },
  verdictTitle: { fontSize: 18, fontWeight: '700' },
  verdictText: { fontSize: 14, lineHeight: 20 },
  verdictMeta: { fontSize: 11, fontWeight: '600', opacity: 0.85 },

  todoCard: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  todoText: { fontSize: 13, lineHeight: 18, color: colors.onSurface },

  section: { gap: 6, marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeading: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: colors.onSurfaceVariant },
  editLink: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14, color: colors.onSurface },
  rowSub: { fontSize: 11, color: colors.onSurfaceVariant },
  rowValue: { fontSize: 13, fontWeight: '600', color: colors.onSurface, textAlign: 'right', flexShrink: 1 },
  rowValuePending: { color: AMBER },
  flag: { borderRadius: 10, padding: 10 },
  flagText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  sectionAbout: { fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant },
  cardNote: { fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant, paddingHorizontal: 14, paddingVertical: 10 },
  empty: { fontSize: 13, color: colors.onSurfaceVariant, padding: 14 },
  pill: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10 },
  pillText: { fontSize: 11, fontWeight: '700' },

  scope: { fontSize: 11, lineHeight: 16, color: colors.outline, marginTop: 6 },
  error: { fontSize: 12, color: colors.error },

  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  primaryBtnSmall: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  secondaryWide: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  disabled: { opacity: 0.4 },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetDismiss: { flex: 1 },
  sheetScroll: { flexGrow: 0, maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheet: { padding: 20, paddingBottom: 28, gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  sheetNote: { fontSize: 13, lineHeight: 18, color: colors.onSurfaceVariant },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.onSurface,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '600' },
  chipTextActive: { color: colors.onPrimary },
});
