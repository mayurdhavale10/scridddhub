import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type Nearby = components['schemas']['NearbyRegisteredTransactions'];

type Props = { parcelId: string; onBack: () => void };

// Registered sales for a parcel's village, typed from Index-II copies by our team (services/
// registeredtransactions/README.md). With 3 or more comparable sales the valuation has real
// evidence and can judge the asking price; until then the report shows no value.

const GUNTHA_PER_ACRE = 40;

function Field({ label, value, onChange, placeholder, numeric }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; numeric?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colors.outline} keyboardType={numeric ? 'decimal-pad' : 'default'} />
    </View>
  );
}

function crore(r: number): string {
  const cr = r / 1e7;
  return cr >= 1 ? `₹${cr.toFixed(2)} Cr` : `₹${(r / 1e5).toFixed(1)} lakh`;
}

export function AddSaleScreen({ parcelId, onBack }: Props) {
  const [place, setPlace] = useState<{ district: string; taluka: string; village: string } | null>(null);
  const [nearby, setNearby] = useState<Nearby | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: '', doc: '', office: '', survey: '', acres: '', guntha: '', price: '', gov: '', reason: '' });
  const [type, setType] = useState<'land' | 'plot'>('land');
  const [comparable, setComparable] = useState(true);
  const [busy, setBusy] = useState<'save' | 'value' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadNearby = async () => {
    const { data } = await api.GET('/land-parcels/{parcelID}/registered-transactions', { params: { path: { parcelID: parcelId } } });
    setNearby(data ?? null);
  };

  useEffect(() => {
    Promise.all([api.GET('/land-parcels/{id}', { params: { path: { id: parcelId } } }), loadNearby()])
      .then(([p]) => {
        const d = p.data;
        if (d?.district && d.taluka && d.village) {
          setPlace({ district: d.district, taluka: d.taluka, village: d.village });
          setForm(f => ({ ...f, office: d.taluka ?? '' }));
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelId]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator /></View>;
  }

  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });
  const acres = (parseFloat(form.acres) || 0) + (parseFloat(form.guntha) || 0) / GUNTHA_PER_ACRE;
  const price = Math.round((parseFloat(form.price) || 0) * 1e5); // entered in lakh
  const comparables = nearby?.items?.length ?? 0;

  const save = async () => {
    if (!place) return;
    setBusy('save');
    setMsg(null);
    const { error } = await api.POST('/registered-transactions', {
      body: {
        ...place, survey_no: form.survey, registration_date: form.date, document_no: form.doc,
        office_name: form.office, property_type: type, area_acres: acres, sale_price_rupees: price,
        government_value_rupees: form.gov ? Math.round(parseFloat(form.gov) * 1e5) : null,
        comparable, exclusion_reason: comparable ? '' : form.reason,
      },
    });
    setBusy(null);
    if (error) {
      setMsg({ ok: false, text: (error as { error?: string }).error ?? 'Could not save. Check the fields.' });
      return;
    }
    setMsg({ ok: true, text: 'Sale saved.' });
    setForm({ ...form, date: '', doc: '', survey: '', acres: '', guntha: '', price: '', gov: '', reason: '' });
    await loadNearby();
  };

  const revalue = async () => {
    setBusy('value');
    setMsg(null);
    const { data, error } = await api.POST('/land-parcels/{parcelID}/valuation', { params: { path: { parcelID: parcelId } } });
    setBusy(null);
    setMsg(error || !data
      ? { ok: false, text: 'Could not re-value right now. Try again.' }
      : { ok: true, text: `Re-valued: ${data.verdict ?? 'done'}.` });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
        <Text style={styles.backArrow}>←</Text>
      </Pressable>
      <Text style={styles.title}>Registered sales</Text>
      <Text style={styles.subtitle}>
        {place ? `${place.village}, ${place.taluka}, ${place.district}` : 'Add the parcel’s village first (Order a Report)'}
      </Text>
      <Text style={styles.note}>
        Search Index-II for this village at the Sub-Registrar or IGR e-Search, and enter each land sale. With 3 or more
        comparable sales, the valuation uses their typical rate per acre and judges the asking price.
      </Text>

      <Text style={styles.sectionHeading}>ON RECORD ({comparables})</Text>
      <View style={styles.card}>
        {comparables ? (
          <>
            {nearby!.items.map(t => (
              <View key={t.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{t.registration_date?.slice(0, 10)} · {t.area_acres?.toFixed(2)} acres</Text>
                  <Text style={styles.rowSub}>Doc {t.document_no}, {t.office_name}{t.survey_no ? ` · Sy ${t.survey_no}` : ''}</Text>
                </View>
                <Text style={styles.rowValue}>{crore(t.rate_per_acre ?? 0)}/acre</Text>
              </View>
            ))}
            <Text style={styles.cardNote}>
              {nearby?.median_rate_per_acre
                ? `Typical rate: ${crore(nearby.median_rate_per_acre)} per acre`
                : `${3 - Math.min(comparables, 3)} more comparable sale${comparables === 2 ? '' : 's'} needed for a typical rate`}
            </Text>
          </>
        ) : (
          <Text style={styles.cardNote}>No sales entered for this village yet.</Text>
        )}
      </View>
      {comparables >= 3 ? (
        <Pressable style={[styles.secondaryBtn, busy === 'value' && styles.disabled]} onPress={revalue} disabled={!!busy}>
          <Text style={styles.secondaryBtnText}>{busy === 'value' ? 'Re-valuing…' : 'Re-value with these sales'}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionHeading}>ADD A SALE FROM INDEX-II</Text>
      <Field label="Registration date (YYYY-MM-DD)" value={form.date} onChange={set('date')} placeholder="2026-05-12" />
      <Field label="Document (dast) number" value={form.doc} onChange={set('doc')} placeholder="e.g. 4521" />
      <Field label="Sub-Registrar office" value={form.office} onChange={set('office')} placeholder="e.g. Karjat" />
      <Field label="Survey / gat no." value={form.survey} onChange={set('survey')} placeholder="e.g. 12/1" />
      <View style={styles.row2}>
        <View style={styles.flex}><Field label="Area: acres" numeric value={form.acres} onChange={set('acres')} placeholder="2" /></View>
        <View style={styles.flex}><Field label="+ guntha" numeric value={form.guntha} onChange={set('guntha')} placeholder="10" /></View>
      </View>
      <Field label="Sale price (₹ lakh)" numeric value={form.price} onChange={set('price')} placeholder="e.g. 85" />
      <Field label="Government value on the deed (₹ lakh, optional)" numeric value={form.gov} onChange={set('gov')} />
      <View style={styles.chips}>
        {(['land', 'plot'] as const).map(k => (
          <Pressable key={k} onPress={() => setType(k)} style={[styles.chip, type === k && styles.chipActive]}>
            <Text style={[styles.chipText, type === k && styles.chipTextActive]}>{k === 'land' ? 'Land' : 'Plot'}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setComparable(!comparable)} style={[styles.chip, comparable && styles.chipActive]}>
          <Text style={[styles.chipText, comparable && styles.chipTextActive]}>{comparable ? 'Comparable sale' : 'Not comparable'}</Text>
        </Pressable>
      </View>
      {!comparable ? (
        <Field label="Why not comparable" value={form.reason} onChange={set('reason')} placeholder="e.g. family transfer, part share" />
      ) : null}
      {acres > 0 && price > 0 ? <Text style={styles.note}>That’s {crore(price / acres)} per acre.</Text> : null}
      {msg ? <Text style={[styles.note, { color: msg.ok ? colors.secondary : colors.error }]}>{msg.text}</Text> : null}
      <Pressable style={[styles.primaryBtn, (!place || busy) && styles.disabled]} onPress={save} disabled={!place || !!busy}>
        <Text style={styles.primaryBtnText}>{busy === 'save' ? 'Saving…' : 'Save sale'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backButton: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 6 },
  backArrow: { fontSize: 22, color: colors.onSurface },
  title: { fontSize: 24, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: 13, color: colors.onSurfaceVariant },
  note: { fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant },
  sectionHeading: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: colors.onSurfaceVariant, marginTop: 10 },
  card: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14, color: colors.onSurface },
  rowSub: { fontSize: 11, color: colors.onSurfaceVariant },
  rowValue: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  cardNote: { fontSize: 12, color: colors.onSurfaceVariant, padding: 14 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  input: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.onSurface },
  row2: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '600' },
  chipTextActive: { color: colors.onPrimary },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primaryBtnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  disabled: { opacity: 0.5 },
});
