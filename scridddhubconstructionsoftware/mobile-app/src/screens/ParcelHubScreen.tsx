import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Banknote,
  CalendarRange,
  ClipboardList,
  FileChartColumn,
  FileSearch,
  Gavel,
  Handshake,
  Landmark,
  type LucideIcon,
  Receipt,
  ReceiptIndianRupee,
  RefreshCw,
  Scale,
  ShieldAlert,
  Stamp,
  TrendingUp,
  Vault,
  Wallet,
} from 'lucide-react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type LandParcel = components['schemas']['LandParcel'];
type Feasibility = components['schemas']['FeasibilityAssessment'];
type LegalCheck = components['schemas']['LegalCheck'];
type Approval = components['schemas']['LandParcelApproval'];
type Tenure = components['schemas']['ParcelTenure'];
type ReportSummary = components['schemas']['ReportSummary'];

// Screen names a card can open. App.tsx maps each to its route.
export type HubTarget =
  | 'feasibility'
  | 'legalCheck'
  | 'orderReport'
  | 'approvals'
  | 'landTenure'
  | 'financialStructure'
  | 'riskRegister'
  | 'tender'
  | 'masterSchedule'
  | 'litigationCase'
  | 'escrowAccount'
  | 'certificationPacket'
  | 'lenderCovenant'
  | 'accountingSync'
  | 'gstFiling'
  | 'tdsFiling'
  | 'tpaReport';

type Props = {
  parcelId: string;
  onBack: () => void;
  onOpen: (target: HubTarget) => void;
};

type Card = { target: HubTarget; title: string; status: string; tone?: 'ok' | 'warn' | 'paid' };

// One line icon per screen (Lucide, open source).
const ICONS: Record<HubTarget, LucideIcon> = {
  feasibility: TrendingUp,
  legalCheck: Scale,
  orderReport: FileSearch,
  approvals: Landmark,
  landTenure: Handshake,
  financialStructure: Wallet,
  riskRegister: ShieldAlert,
  tender: ClipboardList,
  masterSchedule: CalendarRange,
  litigationCase: Gavel,
  escrowAccount: Vault,
  certificationPacket: Stamp,
  lenderCovenant: Banknote,
  accountingSync: RefreshCw,
  gstFiling: Receipt,
  tdsFiling: ReceiptIndianRupee,
  tpaReport: FileChartColumn,
};

// The parcel's home (owner, 2026-10-03): a summary on top, then one card per screen, grouped in
// the order a deal moves. Tapping a card opens that screen; Back from it returns here. Cards for
// parcel-level screens show a live status; project-level ones (finance, compliance) say what
// they hold, because they still run on the shared dev project.

function crore(rupees?: number | null): string {
  if (rupees == null) return '';
  const cr = rupees / 1e7;
  return `₹${cr >= 10 ? cr.toFixed(1) : cr.toFixed(2)} Cr`;
}

function legalStatus(c: LegalCheck | null): { status: string; tone?: Card['tone'] } {
  if (!c) return { status: 'Not started' };
  if (c.status === 'cleared') return { status: 'Cleared · deal closed', tone: 'ok' };
  const risks = [c.ownership_risk, c.litigation_risk, c.encumbrance_risk, c.regulatory_risk];
  const unjudged = risks.filter(r => !r || r === 'not_checked').length;
  const searches = (c.encumbrance_searches ?? []).filter(s => !s.completed).length;
  const parts: string[] = [];
  if (unjudged) parts.push(`${unjudged} risk${unjudged > 1 ? 's' : ''} not checked`);
  if (searches) parts.push(`${searches} search${searches > 1 ? 'es' : ''} not done`);
  return parts.length
    ? { status: parts.join(' · '), tone: 'warn' }
    : { status: 'All checks done · ready to close', tone: 'ok' };
}

function approvalsStatus(list: Approval[]): { status: string; tone?: Card['tone'] } {
  if (!list.length) return { status: 'Not worked out yet' };
  const applicable = list.filter(a => a.status !== 'not_applicable');
  const approved = applicable.filter(a => a.status === 'approved').length;
  const submitted = applicable.filter(a => a.status === 'submitted').length;
  return {
    status: `${approved} of ${applicable.length} approved${submitted ? ` · ${submitted} submitted` : ''}`,
    tone: approved === applicable.length ? 'ok' : undefined,
  };
}

function reportStatus(r: ReportSummary | null): string {
  if (!r) return 'Shortlist or check before you buy';
  const kind = r.tier === 'full' ? 'Full Report' : 'Quick Screen';
  if (r.status === 'draft') {
    return r.open_items.length ? `${kind} draft · ${r.open_items.length} to fill` : `${kind} draft · ready to sign`;
  }
  const when = new Date(r.finalised_at ?? r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${kind} ${r.status === 'signed' ? 'signed' : 'issued'} ${when}`;
}

function tenureStatus(t: Tenure | null): string {
  if (!t) return 'Not recorded';
  if (t.tenure_type === 'outright') {
    return t.purchase_price_rupees ? `Outright · ${crore(t.purchase_price_rupees)}` : 'Outright';
  }
  if (t.jda_model === 'revenue_sharing') {
    return `JDA · landowner ${t.landowner_revenue_share_pct}% of revenue`;
  }
  return `JDA · ${t.developer_area_share_pct} : ${t.landowner_area_share_pct}`;
}

export function ParcelHubScreen({ parcelId, onBack, onOpen }: Props) {
  const [loading, setLoading] = useState(true);
  const [parcel, setParcel] = useState<LandParcel | null>(null);
  const [feasibility, setFeasibility] = useState<Feasibility | null>(null);
  const [legal, setLegal] = useState<LegalCheck | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [tenure, setTenure] = useState<Tenure | null>(null);
  const [latestReport, setLatestReport] = useState<ReportSummary | null>(null);

  useEffect(() => {
    const path = { params: { path: { parcelID: parcelId } } };
    Promise.all([
      api.GET('/land-parcels/{id}', { params: { path: { id: parcelId } } }),
      api.GET('/land-parcels/{parcelID}/feasibility-assessment', path),
      api.GET('/land-parcels/{parcelID}/legal-check', path),
      api.GET('/land-parcels/{parcelID}/approvals', path),
      api.GET('/land-parcels/{parcelID}/tenure', path),
      api.GET('/land-parcels/{parcelID}/reports', path),
    ])
      .then(([p, f, l, a, t, r]) => {
        setLatestReport(r.data?.[0] ?? null);
        setParcel(p.data ?? null);
        setFeasibility(f.data ?? null);
        setLegal(l.data ?? null);
        setApprovals(a.data ?? []);
        setTenure(t.data ?? null);
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

  const legalInfo = legalStatus(legal);
  const approvalsInfo = approvalsStatus(approvals);
  // With no registered sales or government rate, the range is only a model's guess (it was wildly
  // low for Dhamni, Karjat), so no number is shown. Must match domain.VerdictNoMarketEvidence.
  const noEvidence = feasibility?.verdict === 'Not enough market evidence to judge the asking price';
  const likely = noEvidence ? undefined : feasibility?.current_valuation_rupees;

  const sections: { heading: string; about: string; note?: string; cards: Card[] }[] = [
    {
      heading: 'BEFORE YOU BUY THIS PARCEL',
      about: 'Check it before you pay a token: what it’s worth, what’s wrong with the title, and a report you can rely on.',
      cards: [
        {
          target: 'feasibility',
          title: 'Feasibility & value',
          status: noEvidence
            ? 'Collecting registered sale prices for this village'
            : likely
              ? `Likely ${crore(likely)}${feasibility?.verdict ? ` · ${feasibility.verdict}` : ''}`
              : 'Value, infrastructure and nearby sales',
        },
        { target: 'legalCheck', title: 'Legal & RERA check', ...legalInfo },
        {
          target: 'orderReport',
          title: 'Due-Diligence Report',
          status: reportStatus(latestReport),
          tone: 'paid',
        },
      ],
    },
    {
      heading: 'AFTER THE DEAL CLOSES',
      about: 'Once the land is yours: government approvals, how you acquired it, and the money plan.',
      cards: [
        { target: 'approvals', title: 'Government approvals', ...approvalsInfo },
        { target: 'landTenure', title: 'Land tenure & JDA', status: tenureStatus(tenure) },
        { target: 'financialStructure', title: 'Financial structuring', status: 'Sources & uses of funds' },
      ],
    },
    {
      heading: 'RUNNING THE PROJECT',
      about: 'While it’s being built: risks, contractors, the schedule and any disputes.',
      cards: [
        { target: 'riskRegister', title: 'Risk register', status: 'Risks, owners and mitigations' },
        { target: 'tender', title: 'Contractor tendering', status: 'Bids and contractor choice' },
        { target: 'masterSchedule', title: 'Master schedule', status: 'Project timeline' },
        { target: 'litigationCase', title: 'Litigation & disputes', status: 'Cases and hearings' },
      ],
    },
    {
      heading: 'MONEY & COMPLIANCE',
      about: 'Escrow, filings and lender reports the law and your lenders require.',
      note: 'These use the project’s shared figures until projects are linked to parcels.',
      cards: [
        { target: 'escrowAccount', title: 'Escrow account', status: 'RERA 70% account, bank-verified' },
        { target: 'certificationPacket', title: 'Certification packet', status: 'Quarterly engineer + CA sign-off' },
        { target: 'lenderCovenant', title: 'Lender covenants', status: 'Loan conditions and breaches' },
        { target: 'accountingSync', title: 'Accounting sync', status: 'Tally bridge' },
        { target: 'gstFiling', title: 'GST filing', status: 'Returns and ITC reversal' },
        { target: 'tdsFiling', title: 'TDS filing', status: 'Contractor and professional TDS' },
        { target: 'tpaReport', title: 'Lender report', status: 'TPA / QPR for each lender' },
      ],
    },
  ];

  const facts = [
    parcel?.area_acres ? `${parcel.area_acres} acres` : '',
    parcel?.cost_rupees ? crore(parcel.cost_rupees) : 'No price yet',
    parcel?.village || parcel?.location || '',
  ].filter(Boolean);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{parcel?.name ?? 'Parcel'}</Text>
          {parcel?.stage ? (
            <View style={styles.stagePill}>
              <Text style={styles.stageText}>{parcel.stage}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.subtitle}>{facts.join(' · ')}</Text>
      </View>

      {likely ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Value today</Text>
              <Text style={styles.summaryValue}>
                {feasibility?.current_low_rupees && feasibility?.current_high_rupees
                  ? `${crore(feasibility.current_low_rupees)} to ${crore(feasibility.current_high_rupees)}`
                  : crore(likely)}
              </Text>
            </View>
            {feasibility?.future_valuation_rupees ? (
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>
                  In {feasibility.future_valuation_year ?? '5 years'}
                </Text>
                <Text style={styles.summaryValue}>
                  {crore(feasibility.future_valuation_rupees)}
                </Text>
              </View>
            ) : null}
          </View>
          {feasibility?.verdict ? (
            <Text style={styles.summaryVerdict}>{feasibility.verdict}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryVerdictMuted}>
            {noEvidence
              ? 'No registered sales or government rate on record for this area yet, so we don’t put a value on it. Registered sale prices for the village are being collected (Index-II).'
              : 'Not valued yet. Open Feasibility & value to assess it.'}
          </Text>
        </View>
      )}

      {sections.map(section => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.sectionHeading}>{section.heading}</Text>
          <Text style={styles.sectionAbout}>{section.about}</Text>
          {section.note ? <Text style={styles.sectionNote}>{section.note}</Text> : null}
          {/* Two-column tile grid (owner's reference layout, 2026-10-05). */}
          <View style={styles.grid}>
            {section.cards.map(c => {
              const Icon = ICONS[c.target];
              return (
                <Pressable
                  key={c.target}
                  onPress={() => onOpen(c.target)}
                  style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
                  <View style={styles.tileTop}>
                    <Icon size={30} color={colors.onSurface} strokeWidth={1.6} />
                    {c.tone === 'paid' ? (
                      <View style={styles.paidPill}>
                        <Text style={styles.paidText}>Paid</Text>
                      </View>
                    ) : c.tone ? (
                      <View
                        style={[styles.toneDot, c.tone === 'ok' ? styles.dotOk : styles.dotWarn]}
                      />
                    ) : null}
                  </View>
                  <Text style={styles.tileTitle} numberOfLines={2}>
                    {c.title}
                  </Text>
                  <Text
                    style={[
                      styles.tileStatus,
                      c.tone === 'ok' && styles.statusOk,
                      c.tone === 'warn' && styles.statusWarn,
                    ]}
                    numberOfLines={2}>
                    {c.status}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: '700', color: colors.onSurface, flexShrink: 1 },
  stagePill: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  stageText: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant },
  subtitle: { fontSize: 13, color: colors.onSurfaceVariant },

  summaryCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  summaryRow: { flexDirection: 'row', gap: 16 },
  summaryCell: { flex: 1, gap: 2 },
  summaryLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, color: colors.onSurfaceVariant },
  summaryValue: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  summaryVerdict: { fontSize: 13, fontWeight: '600', color: colors.secondary },
  summaryVerdictMuted: { fontSize: 13, color: colors.onSurfaceVariant },

  section: { gap: 6, marginTop: 4 },
  sectionHeading: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: colors.onSurfaceVariant },
  sectionAbout: { fontSize: 13, lineHeight: 18, color: colors.onSurfaceVariant, marginBottom: 4 },
  sectionNote: { fontSize: 11, color: colors.outline },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: {
    width: '48.3%',
    minHeight: 138,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  tilePressed: { backgroundColor: colors.surfaceContainerLow },
  tileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  tileStatus: { fontSize: 12, lineHeight: 16, color: colors.onSurfaceVariant },
  statusOk: { color: colors.secondary },
  statusWarn: { color: '#8a6a1a' },
  toneDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  dotOk: { backgroundColor: colors.secondary },
  dotWarn: { backgroundColor: '#c9a82d' },
  paidPill: {
    backgroundColor: colors.infoContainer,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  paidText: { fontSize: 10, fontWeight: '700', color: colors.onInfoContainer },
});
