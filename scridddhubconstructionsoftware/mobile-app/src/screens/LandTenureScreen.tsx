import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type ParcelTenure = components['schemas']['ParcelTenure'];
type TenureInput = components['schemas']['ParcelTenureInput'];
type JDAModel = 'area_sharing' | 'revenue_sharing' | 'deposit_plus_share';

type Props = {
  parcelId: string;
  onBack: () => void;
  onSeeFinancialStructure: () => void;
};

// Screen 8.9: Land Tenure & JDA Structure, per deal (owner decision, 2026-10-03). After the deal
// closes, the team records how the land is acquired: bought outright, or a Joint Development
// Agreement where the landowner keeps the land and takes a share of the flats or revenue.
// Amounts are entered by the team; the hints say what the law-driven items usually are, and that
// the lawyer or CA confirms them.

const MODELS: { key: JDAModel; label: string; hint: string }[] = [
  { key: 'area_sharing', label: 'Area share', hint: 'Landowner gets a share of the built flats' },
  { key: 'revenue_sharing', label: 'Revenue share', hint: 'Landowner gets a share of sales revenue' },
  {
    key: 'deposit_plus_share',
    label: 'Deposit + share',
    hint: 'Area share plus a security deposit paid to the landowner',
  },
];

function crore(rupees?: number | null): string {
  if (rupees == null) return '';
  const cr = rupees / 1e7;
  return `₹${cr >= 10 ? cr.toFixed(1) : cr.toFixed(2)} Cr`;
}

// Inputs are typed in crore ("4.2"), stored in rupees.
function toRupees(text: string): number | null {
  const v = parseFloat(text.replace(/[^0-9.]/g, ''));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 1e7) : null;
}
function toCroreText(rupees?: number | null): string {
  return rupees == null ? '' : String(+(rupees / 1e7).toFixed(2));
}
function toPct(text: string): number | null {
  const v = parseFloat(text.replace(/[^0-9.]/g, ''));
  return Number.isFinite(v) ? v : null;
}

type Draft = {
  tenure: 'outright' | 'jda';
  price: string;
  purchaseStamp: string;
  model: JDAModel;
  devShare: string;
  revenueShare: string;
  cashOnTop: boolean;
  deposit: string;
  depositRefundable: boolean;
  jdaStamp: string;
  gstReverse: boolean;
  coPromoter: boolean;
};

function draftFrom(t: ParcelTenure | null, askingRupees?: number | null): Draft {
  return {
    tenure: t?.tenure_type ?? 'outright',
    price: toCroreText(t?.purchase_price_rupees ?? askingRupees),
    purchaseStamp: toCroreText(t?.purchase_stamp_duty_rupees),
    model: ((t?.jda_model as JDAModel) || 'area_sharing'),
    devShare: t?.developer_area_share_pct != null ? String(t.developer_area_share_pct) : '62',
    revenueShare:
      t?.landowner_revenue_share_pct != null ? String(t.landowner_revenue_share_pct) : '30',
    cashOnTop: t?.cash_on_top_of_share ?? false,
    deposit: toCroreText(t?.security_deposit_rupees),
    depositRefundable: t?.deposit_refundable ?? true,
    jdaStamp: toCroreText(t?.jda_stamp_duty_rupees),
    gstReverse: t?.gst_reverse_charge_applicable ?? true,
    coPromoter: t?.landowner_is_co_promoter ?? true,
  };
}

function toInput(d: Draft): TenureInput {
  if (d.tenure === 'outright') {
    return {
      tenure_type: 'outright',
      purchase_price_rupees: toRupees(d.price),
      purchase_stamp_duty_rupees: toRupees(d.purchaseStamp),
    };
  }
  const areaModel = d.model !== 'revenue_sharing';
  return {
    tenure_type: 'jda',
    jda_model: d.model,
    developer_area_share_pct: areaModel ? toPct(d.devShare) : null,
    landowner_revenue_share_pct: areaModel ? null : toPct(d.revenueShare),
    cash_on_top_of_share: d.cashOnTop,
    security_deposit_rupees: toRupees(d.deposit),
    deposit_refundable: d.depositRefundable,
    jda_stamp_duty_rupees: toRupees(d.jdaStamp),
    gst_reverse_charge_applicable: d.gstReverse,
    landowner_is_co_promoter: d.coPromoter,
  };
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  suffix,
  placeholder,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.inputBox}>
        <TextInput
          nativeID={id}
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={placeholder ?? '0'}
          placeholderTextColor={colors.outline}
        />
        <Text style={styles.suffix}>{suffix}</Text>
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export function LandTenureScreen({ parcelId, onBack, onSeeFinancialStructure }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<ParcelTenure | null>(null);
  const [draft, setDraft] = useState<Draft>(draftFrom(null));
  const [parcelName, setParcelName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.GET('/land-parcels/{parcelID}/tenure', { params: { path: { parcelID: parcelId } } }),
      api.GET('/land-parcels/{id}', { params: { path: { id: parcelId } } }),
    ])
      .then(([tenure, parcel]) => {
        setParcelName(parcel.data?.name ?? '');
        setSaved(tenure.data ?? null);
        setDraft(draftFrom(tenure.data ?? null, parcel.data?.cost_rupees));
      })
      .finally(() => setLoading(false));
  }, [parcelId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setNotice(null);
    setDraft(d => ({ ...d, [key]: value }));
  };

  const dirty = useMemo(
    () => JSON.stringify(toInput(draft)) !== JSON.stringify(toInput(draftFrom(saved))),
    [draft, saved],
  );

  const save = async () => {
    setSaving(true);
    setError(null);
    const { data, error: apiError } = await api.PUT('/land-parcels/{parcelID}/tenure', {
      params: { path: { parcelID: parcelId } },
      body: toInput(draft),
    });
    setSaving(false);
    if (apiError || !data) {
      const msg = (apiError as { error?: string } | undefined)?.error;
      setError(msg ? `Could not save: ${msg}.` : 'Could not save these terms. Try again.');
      return;
    }
    setSaved(data);
    setDraft(draftFrom(data));
    setNotice('Saved');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const isJDA = draft.tenure === 'jda';
  const areaModel = draft.model !== 'revenue_sharing';
  const dev = toPct(draft.devShare);
  const landownerShare = dev != null && dev > 0 && dev < 100 ? 100 - dev : null;
  const depositRupees = toRupees(draft.deposit);
  const jdaStampRupees = toRupees(draft.jdaStamp);
  const priceRupees = toRupees(draft.price);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>Land Tenure &amp; JDA</Text>
        {parcelName ? <Text style={styles.subtitle}>{parcelName}</Text> : null}
      </View>

      <Text style={styles.intro}>
        How is this land being acquired? Under a JDA the landowner keeps the land and takes a
        share of the project instead of cash.
      </Text>

      <View style={styles.segment}>
        {(['outright', 'jda'] as const).map(t => {
          const active = draft.tenure === t;
          return (
            <Pressable
              key={t}
              onPress={() => set('tenure', t)}
              style={[styles.segmentOption, active && styles.segmentActive]}>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {t === 'outright' ? 'Outright purchase' : 'Joint development (JDA)'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!isJDA ? (
        <>
          <Text style={styles.sectionHeading}>PURCHASE</Text>
          <View style={styles.card}>
            <Field
              id="price"
              label="Agreed price"
              hint="Pre-filled from the asking price"
              value={draft.price}
              onChange={v => set('price', v)}
              suffix="Cr"
            />
            <View style={styles.divider} />
            <Field
              id="purchaseStamp"
              label="Stamp duty + registration"
              hint="A real cash cost on top of the price. Your lawyer confirms the amount."
              value={draft.purchaseStamp}
              onChange={v => set('purchaseStamp', v)}
              suffix="Cr"
            />
          </View>
          {priceRupees ? (
            <Text style={styles.summaryLine}>
              Land cost in the budget: {crore(priceRupees + (toRupees(draft.purchaseStamp) ?? 0))}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.sectionHeading}>JDA TYPE</Text>
          <View style={styles.card}>
            {MODELS.map((m, i) => {
              const active = draft.model === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => set('model', m.key)}
                  style={[styles.modelRow, i < MODELS.length - 1 && styles.rowDivider]}>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.fieldText}>
                    <Text style={[styles.rowLabel, active && styles.bold]}>{m.label}</Text>
                    <Text style={styles.hint}>{m.hint}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionHeading}>THE SPLIT</Text>
          <View style={styles.card}>
            {areaModel ? (
              <>
                <Field
                  id="devShare"
                  label="Your share of built area"
                  value={draft.devShare}
                  onChange={v => set('devShare', v)}
                  suffix="%"
                />
                <View style={styles.splitBar}>
                  <View style={[styles.splitDev, { flex: dev && dev > 0 && dev < 100 ? dev : 50 }]} />
                  <View
                    style={[styles.splitOwner, { flex: landownerShare ?? 50 }]}
                  />
                </View>
                <Text style={styles.splitLabel}>
                  {landownerShare != null
                    ? `You ${dev}% · Landowner ${landownerShare}% of the flats`
                    : 'Enter a share between 1 and 99%'}
                </Text>
              </>
            ) : (
              <Field
                id="revenueShare"
                label="Landowner's share of revenue"
                value={draft.revenueShare}
                onChange={v => set('revenueShare', v)}
                suffix="%"
              />
            )}
            <View style={styles.divider} />
            <ToggleRow
              label="Cash to landowner on top of the share"
              value={draft.cashOnTop}
              onChange={v => set('cashOnTop', v)}
            />
          </View>

          <Text style={styles.sectionHeading}>MONEY</Text>
          <View style={styles.card}>
            <Field
              id="deposit"
              label="Security deposit to landowner"
              hint={
                draft.model === 'deposit_plus_share'
                  ? 'Required for this JDA type'
                  : 'Leave empty if none'
              }
              value={draft.deposit}
              onChange={v => set('deposit', v)}
              suffix="Cr"
            />
            <View style={styles.divider} />
            <ToggleRow
              label="Deposit is refundable"
              hint={
                draft.depositRefundable
                  ? 'Comes back on completion, so it is a temporary outflow, not a cost'
                  : 'A non-refundable deposit is a cost and attracts TDS (s.194-IC). Your CA confirms.'
              }
              value={draft.depositRefundable}
              onChange={v => set('depositRefundable', v)}
            />
            <View style={styles.divider} />
            <Field
              id="jdaStamp"
              label="Stamp duty + registration on the JDA"
              hint="A JDA is registered like a sale, so this is a real cash cost. Your lawyer confirms the amount."
              value={draft.jdaStamp}
              onChange={v => set('jdaStamp', v)}
              suffix="Cr"
            />
            <View style={styles.divider} />
            <ToggleRow
              label="GST on development rights (reverse charge)"
              hint="Paid on the landowner's share as flats are handed over. Your CA confirms timing."
              value={draft.gstReverse}
              onChange={v => set('gstReverse', v)}
            />
          </View>

          <Text style={styles.sectionHeading}>RERA</Text>
          <View style={styles.card}>
            <ToggleRow
              label="Landowner is a co-promoter"
              hint="A landowner who shares in the flats or sales is a promoter under RERA and must be named in the project registration."
              value={draft.coPromoter}
              onChange={v => set('coPromoter', v)}
            />
          </View>

          <Text style={styles.sectionHeading}>WHAT CHANGES VS BUYING OUTRIGHT</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLine}>• You don't pay for the land in cash.</Text>
            {depositRupees || jdaStampRupees ? (
              <Text style={styles.infoLine}>
                • Cash out instead:{' '}
                {[
                  depositRupees ? `${crore(depositRupees)} deposit${draft.depositRefundable ? ' (refundable)' : ''}` : '',
                  jdaStampRupees ? `${crore(jdaStampRupees)} stamp duty` : '',
                ]
                  .filter(Boolean)
                  .join(' + ')}
              </Text>
            ) : null}
            {areaModel && landownerShare != null ? (
              <Text style={styles.infoLine}>
                • You sell {dev}% of the flats. The landowner's {landownerShare}% are theirs, so
                revenue and escrow work on your share only.
              </Text>
            ) : null}
            {!areaModel && toPct(draft.revenueShare) ? (
              <Text style={styles.infoLine}>
                • {toPct(draft.revenueShare)}% of sales revenue goes to the landowner.
              </Text>
            ) : null}
            {draft.coPromoter ? (
              <Text style={styles.infoLine}>
                • The Legal Check must also cover the landowner's title, the registered JDA and
                the power of attorney.
              </Text>
            ) : null}
          </View>
        </>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {notice && !dirty ? <Text style={styles.savedText}>{notice}</Text> : null}

      <Pressable
        onPress={save}
        disabled={saving || (!dirty && saved != null)}
        style={[styles.primaryButton, (saving || (!dirty && saved != null)) && styles.disabled]}>
        <Text style={styles.primaryButtonText}>
          {saving ? 'Saving…' : saved && !dirty ? 'Saved' : 'Save terms'}
        </Text>
      </Pressable>

      <Pressable onPress={onSeeFinancialStructure} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Financial Structuring →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { gap: 2, marginBottom: 2 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backArrow: { fontSize: 22, color: colors.onSurface },
  title: { fontSize: 24, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: 13, color: colors.onSurfaceVariant },
  intro: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 10,
    padding: 4,
    gap: 4,
    marginTop: 4,
  },
  segmentOption: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  segmentTextActive: { color: colors.onPrimary },

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
  divider: { height: 1, backgroundColor: colors.surfaceContainer },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  fieldText: { flex: 1, gap: 3 },
  rowLabel: { fontSize: 14, color: colors.onSurface },
  bold: { fontWeight: '700' },
  hint: { fontSize: 11, lineHeight: 15, color: colors.onSurfaceVariant },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 10,
    minWidth: 96,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    paddingVertical: 8,
    textAlign: 'right',
  },
  suffix: { fontSize: 13, color: colors.onSurfaceVariant, marginLeft: 4 },

  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
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

  splitBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  splitDev: { backgroundColor: colors.primary },
  splitOwner: { backgroundColor: colors.infoContainer },
  splitLabel: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },

  summaryLine: { fontSize: 13, fontWeight: '600', color: colors.onSurface, paddingHorizontal: 4 },
  infoCard: {
    backgroundColor: colors.infoContainer,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  infoLine: { fontSize: 13, lineHeight: 19, color: colors.onInfoContainer },

  errorText: { fontSize: 12, color: colors.error },
  savedText: { fontSize: 12, color: colors.secondary, textAlign: 'center' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  disabled: { opacity: 0.4 },
  primaryButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
});
