import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { api, API_BASE_URL } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type Entry = components['schemas']['MutationEntry'];
type Flag = components['schemas']['SevenTwelveFlag'];
type Saved = components['schemas']['LandMutations'];
type Draft = components['schemas']['FerfarDraft'];

type Props = { parcelId: string; onBack: () => void };

// The mutation register (Ferfar): the ownership chain for the Due-Diligence Report's section B.
// Photograph each page; the AI reads its entries into one combined draft; a person checks every
// entry against the paper and saves. Only the checked register is used in reports.

const AMBER = '#8a6a1a';
const AMBER_BG = '#f5efdc';
const RED_BG = '#fbe9e5';

const TYPES: Record<Entry['type'], string> = {
  sale: 'Sale', inheritance: 'Inheritance', gift: 'Gift', partition: 'Partition', charge: 'Bank charge',
  charge_released: 'Charge released', na: 'NA order', court_order: 'Court order', acquisition: 'Acquisition', other: 'Other',
};
const STATUS: Record<'certified' | 'pending' | 'rejected', string> = { certified: 'Certified', pending: 'Pending', rejected: 'Rejected' };

function Flags({ flags }: { flags: Flag[] }) {
  return (
    <View style={styles.flags}>
      {flags.map((f, i) => (
        <View key={i} style={[styles.flag, { backgroundColor: f.level === 'high' ? RED_BG : AMBER_BG }]}>
          <Text style={[styles.flagText, { color: f.level === 'high' ? colors.error : AMBER }]}>{f.text}</Text>
        </View>
      ))}
    </View>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} />
    </View>
  );
}

export function FerfarScreen({ parcelId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [readBy, setReadBy] = useState('');
  const [pages, setPages] = useState(0);
  const [busy, setBusy] = useState<'read' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.GET('/land-parcels/{id}/ferfar', { params: { path: { id: parcelId } } })
      .then(({ data }) => data && setSaved(data))
      .finally(() => setLoading(false));
  }, [parcelId]);

  const read = async (asset: Asset) => {
    if (!asset.uri) return;
    setBusy('read');
    setError(null);
    try {
      const blob = await (await fetch(asset.uri)).blob();
      const res = await fetch(`${API_BASE_URL}/land-parcels/${parcelId}/ferfar/read`, {
        method: 'POST', headers: { 'Content-Type': asset.type ?? 'image/jpeg' }, body: blob,
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? 'Could not read the page. Try a clearer photo.');
      } else {
        const d = body as Draft;
        setEntries(prev => [...(prev ?? []), ...d.data.entries]);
        setFlags(d.flags);
        setReadBy(d.read_by);
        setPages(p => p + 1);
      }
    } catch {
      setError('Could not read the page. Check the connection and try again.');
    }
    setBusy(null);
  };

  const pick = async (camera: boolean) => {
    const opts = { mediaType: 'photo' as const, quality: 0.8 as const, maxWidth: 2200, maxHeight: 2200 };
    const r = camera ? await launchCamera(opts) : await launchImageLibrary(opts);
    if (r.assets?.[0]) read(r.assets[0]);
  };

  const save = async () => {
    if (!entries) return;
    setBusy('save');
    setError(null);
    const { data, error: e } = await api.PUT('/land-parcels/{id}/ferfar', {
      params: { path: { id: parcelId } }, body: { data: { entries }, read_by: readBy },
    });
    setBusy(null);
    if (e || !data) {
      setError((e as { error?: string })?.error ?? 'Could not save. Check every entry has a number and type.');
      return;
    }
    setSaved(data);
    setEntries(null);
    setPages(0);
  };

  const edit = (i: number, patch: Partial<Entry>) =>
    setEntries(es => (es ?? []).map((e, j) => (j === i ? { ...e, ...patch } : e)));

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
        <Text style={styles.backArrow}>←</Text>
      </Pressable>
      <Text style={styles.title}>Mutation register (Ferfar)</Text>
      <Text style={styles.subtitle}>
        Every change of rights on the land: sales, inheritance, loans and their release. Read in order, it’s the
        ownership chain a 30-year title search traces.
      </Text>

      {saved && !entries ? (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              {saved.data.entries.length} entries checked and saved, going back {saved.years_covered} years. Reports on this parcel use them.
            </Text>
          </View>
          <Flags flags={saved.flags} />
        </>
      ) : null}

      <Text style={styles.sectionHeading}>{entries ? `PAGES READ: ${pages}` : saved ? 'READ AGAIN' : 'ADD THE MUTATION ENTRIES'}</Text>
      <Text style={styles.note}>Photograph one page at a time, flat and in good light. Each page adds its entries below.</Text>
      <View style={styles.row2}>
        <Pressable style={[styles.primaryBtn, styles.flex]} onPress={() => pick(true)} disabled={!!busy}>
          <Text style={styles.primaryBtnText}>{entries ? 'Photo of next page' : 'Take a photo'}</Text>
        </Pressable>
        <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => pick(false)} disabled={!!busy}>
          <Text style={styles.secondaryBtnText}>Gallery</Text>
        </Pressable>
      </View>
      {busy === 'read' ? (
        <View style={styles.reading}><ActivityIndicator /><Text style={styles.note}>Reading the entries…</Text></View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {entries ? (
        <>
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>Read by AI. Check every entry against the paper: numbers, dates and names are where it slips.</Text>
          </View>
          {pages === 1 && flags.length ? <Flags flags={flags} /> : null}
          {entries.map((e, i) => (
            <View key={i} style={styles.entryCard}>
              <View style={styles.row2}>
                <View style={styles.flex}><Input label="Mutation no." value={e.number} onChange={v => edit(i, { number: v })} /></View>
                <View style={styles.flex}><Input label="Date (dd/mm/yyyy)" value={e.date} onChange={v => edit(i, { date: v })} /></View>
              </View>
              <View style={styles.chips}>
                {(Object.keys(TYPES) as Entry['type'][]).map(k => (
                  <Pressable key={k} onPress={() => edit(i, { type: k })} style={[styles.chip, e.type === k && styles.chipActive]}>
                    <Text style={[styles.chipText, e.type === k && styles.chipTextActive]}>{TYPES[k]}</Text>
                  </Pressable>
                ))}
              </View>
              <Input label="From (whose right ended)" value={e.from ?? ''} onChange={v => edit(i, { from: v })} />
              <Input label="To (whose right began)" value={e.to ?? ''} onChange={v => edit(i, { to: v })} />
              <View style={styles.chips}>
                {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map(k => (
                  <Pressable key={k} onPress={() => edit(i, { status: k })} style={[styles.chip, e.status === k && styles.chipActive]}>
                    <Text style={[styles.chipText, e.status === k && styles.chipTextActive]}>{STATUS[k]}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => setEntries(es => (es ?? []).filter((_, j) => j !== i))}>
                <Text style={styles.link}>Remove this entry</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => setEntries(es => [...(es ?? []), { number: '', date: '', type: 'other', status: '' }])}>
            <Text style={styles.link}>+ Add an entry by hand</Text>
          </Pressable>
          <View style={styles.row2}>
            <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => { setEntries(null); setPages(0); }}>
              <Text style={styles.secondaryBtnText}>Discard</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, styles.flex, busy === 'save' && styles.disabled]} onPress={save} disabled={!!busy}>
              <Text style={styles.primaryBtnText}>{busy === 'save' ? 'Saving…' : 'Checked, save'}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
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
  subtitle: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },
  sectionHeading: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: colors.onSurfaceVariant, marginTop: 10 },
  note: { fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant },
  error: { fontSize: 13, color: colors.error },
  infoCard: { backgroundColor: colors.infoContainer, borderRadius: 12, padding: 14 },
  infoText: { fontSize: 13, lineHeight: 19, color: colors.onInfoContainer },
  warnCard: { backgroundColor: AMBER_BG, borderRadius: 12, padding: 14 },
  warnText: { fontSize: 13, lineHeight: 19, color: AMBER, fontWeight: '600' },
  flags: { gap: 6 },
  flag: { borderRadius: 10, padding: 10 },
  flagText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  reading: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  entryCard: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, padding: 12, gap: 8 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  input: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.onSurface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '600' },
  chipTextActive: { color: colors.onPrimary },
  link: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  row2: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  disabled: { opacity: 0.5 },
});
