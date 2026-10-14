import React, { useEffect, useRef, useState } from 'react';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

// react-native-webview 14 types WebView's props as `never` under React 19 (see LocationPicker).
const BhulekhWebView = WebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebView> }>;
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick as pickDocument, types } from '@react-native-documents/picker';
import { api, API_BASE_URL } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type SevenTwelve = components['schemas']['SevenTwelve'];
type Flag = components['schemas']['SevenTwelveFlag'];
type Draft = components['schemas']['SevenTwelveDraft'];

type Props = { parcelId: string; onBack: () => void };

// Read the parcel's 7/12 (services/duediligencereport/README.md, "Reading the 7/12"). A person
// takes or picks a photo; the AI reads it into a draft; the person checks every field against the
// paper and confirms. Only confirmed data is saved and used in reports (AI drafts, a person signs).

const AMBER = '#8a6a1a';
const AMBER_BG = '#f5efdc';
const RED_BG = '#fbe9e5';

const TENURE: Record<string, string> = { class_1: 'Class I', class_2: 'Class II', govt_lease: 'Govt. lease', '': 'Not readable' };

function FlagList({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
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

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, multiline && styles.inputMulti]} value={value} onChangeText={onChange} multiline={multiline} />
    </View>
  );
}

export function SevenTwelveScreen({ parcelId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<{ data: SevenTwelve; flags: Flag[]; confirmed_at: string } | null>(null);
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [data, setData] = useState<SevenTwelve | null>(null);
  const [busy, setBusy] = useState<'read' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bhulekh opened inside the app: the person types the captcha; the app only takes the page's
  // text once the record is on screen.
  const [web, setWeb] = useState(false);
  const [webMsg, setWebMsg] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const webRef = useRef<WebView>(null);

  useEffect(() => {
    api
      .GET('/land-parcels/{id}/seven-twelve', { params: { path: { id: parcelId } } })
      .then(({ data: d }) => d && setSaved(d))
      .finally(() => setLoading(false));
    api.GET('/land-parcels/{id}', { params: { path: { id: parcelId } } }).then(({ data: p }) => {
      if (p?.survey_number && p.village) {
        setHint(`Survey ${p.survey_number}, ${p.village}, ${p.taluka ?? ''} taluka, ${p.district ?? ''}`);
      }
    });
  }, [parcelId]);

  const takePage = () => {
    setWebMsg(null);
    webRef.current?.injectJavaScript(`(function(){
      var t = document.body ? document.body.innerText : '';
      var f = document.querySelectorAll('iframe');
      for (var i = 0; i < f.length; i++) { try { t += '\\n' + f[i].contentDocument.body.innerText; } catch (e) {} }
      window.ReactNativeWebView.postMessage(JSON.stringify({ url: location.href, text: t }));
    })(); true;`);
  };

  const onPage = async (raw: string) => {
    let msg: { url: string; text: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    setBusy('read');
    const { data: d, error: e } = await api.POST('/land-parcels/{id}/seven-twelve/read-text', {
      params: { path: { id: parcelId } },
      body: { text: msg.text, source_url: msg.url },
    });
    setBusy(null);
    if (e || !d) {
      setWebMsg((e as unknown as { error?: string } | undefined)?.error ?? 'Could not read this page. Take a screenshot and use Choose from gallery.');
      return;
    }
    setDraft(d);
    setData(d.data);
    setPhoto(null);
    setWeb(false);
  };

  const read = async (asset: Asset) => {
    if (!asset.uri) return;
    setPhoto(asset);
    setBusy('read');
    setError(null);
    try {
      const blob = await (await fetch(asset.uri)).blob();
      const res = await fetch(`${API_BASE_URL}/land-parcels/${parcelId}/seven-twelve/read`, {
        method: 'POST',
        headers: { 'Content-Type': asset.type ?? 'image/jpeg' },
        body: blob,
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? 'Could not read the photo. Try a clearer one.');
      } else {
        setDraft(body as Draft);
        setData((body as Draft).data);
      }
    } catch {
      setError('Could not read the photo. Check the connection and try again.');
    }
    setBusy(null);
  };

  // The signed 7/12 bought on Digital Satbara (₹15). Its file name carries the exact survey number,
  // so it's sent along.
  const pickPdf = async () => {
    let file: { uri: string; name: string | null };
    try {
      const [res] = await pickDocument({ type: [types.pdf] });
      const [copy] = await keepLocalCopy({ files: [{ uri: res.uri, fileName: res.name ?? 'satbara.pdf' }], destination: 'cachesDirectory' });
      if (copy.status !== 'success') {
        setError('Could not open that PDF.');
        return;
      }
      file = { uri: copy.localUri, name: res.name };
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return;
      setError('Could not open that PDF.');
      return;
    }
    setPhoto(null);
    setBusy('read');
    setError(null);
    try {
      const blob = await (await fetch(file.uri)).blob();
      const res = await fetch(
        `${API_BASE_URL}/land-parcels/${parcelId}/seven-twelve/read-pdf?filename=${encodeURIComponent(file.name ?? '')}`,
        { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: blob },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? 'Could not read the PDF.');
      } else {
        setDraft(body as Draft);
        setData((body as Draft).data);
      }
    } catch {
      setError('Could not read the PDF. Check the connection and try again.');
    }
    setBusy(null);
  };

  const pick = async (camera: boolean) => {
    // includeBase64 for the preview: the picker's content:// address doesn't always render in <Image>.
    const opts = { mediaType: 'photo' as const, quality: 0.8 as const, maxWidth: 2200, maxHeight: 2200, includeBase64: true };
    const r = camera ? await launchCamera(opts) : await launchImageLibrary(opts);
    if (r.assets?.[0]) read(r.assets[0]);
  };

  const confirm = async () => {
    if (!data) return;
    setBusy('save');
    setError(null);
    const { data: rec, error: e } = await api.PUT('/land-parcels/{id}/seven-twelve', {
      params: { path: { id: parcelId } },
      body: { data, read_by: draft?.read_by },
    });
    setBusy(null);
    if (e || !rec) {
      setError((e as { error?: string })?.error ?? 'Could not save. Try again.');
      return;
    }
    setSaved(rec);
    setDraft(null);
    setData(null);
    setPhoto(null);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const set = (patch: Partial<SevenTwelve>) => data && setData({ ...data, ...patch });

  if (web) {
    return (
      <View style={styles.webWrap}>
        <View style={styles.webHead}>
          <Pressable onPress={() => setWeb(false)} hitSlop={12}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.webTitle}>Bhulekh</Text>
        </View>
        <Text style={styles.webHint}>
          {hint ? `${hint}. ` : ''}Pick district, taluka and village, enter the survey number, type the captcha yourself.
          When the 7/12 shows, tap “Use this 7/12”.
        </Text>
        <BhulekhWebView
          ref={webRef}
          source={{ uri: 'https://bhulekh.mahabhumi.gov.in/' }}
          onMessage={(ev: WebViewMessageEvent) => onPage(ev.nativeEvent.data)}
          onLoadStart={() => setWebMsg(null)}
          javaScriptEnabled
          domStorageEnabled
          style={styles.web}
        />
        {webMsg ? <Text style={styles.webError}>{webMsg}</Text> : null}
        <Pressable style={[styles.primaryBtn, styles.webBtn, busy === 'read' && styles.disabled]} onPress={takePage} disabled={busy === 'read'}>
          <Text style={styles.primaryBtnText}>{busy === 'read' ? 'Reading…' : 'Use this 7/12'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
        <Text style={styles.backArrow}>←</Text>
      </Pressable>
      <Text style={styles.title}>7/12 Extract</Text>
      <Text style={styles.subtitle}>
        The record of rights: who holds the land, its class, its area and any loan, tenant or acquisition on it.
      </Text>

      {saved && !data ? (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Checked and saved {new Date(saved.confirmed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Reports on this parcel use it.
            </Text>
          </View>
          <FlagList flags={saved.flags} />
          <View style={styles.card}>
            <Text style={styles.cardLine}>Survey / gat no. {saved.data.survey_number} · {saved.data.village}</Text>
            <Text style={styles.cardLine}>
              {TENURE[saved.data.tenure] ?? saved.data.tenure} · {saved.data.total_area_hr} {saved.data.area_unit === 'are' ? 'are.sq m' : 'ha'}
              {saved.data.is_na ? ' · NA' : ''}
            </Text>
            {saved.data.verification_no ? (
              <Text style={styles.cardLine}>Signed copy, verification no. {saved.data.verification_no}</Text>
            ) : null}
            {saved.data.owners.filter(o => !o.former).map((o, i) => (
              <Text key={i} style={styles.cardLine}>Holder: {o.name}{o.mutation_no ? ` (mutation ${o.mutation_no})` : ''}</Text>
            ))}
          </View>
        </>
      ) : null}

      {!data ? (
        <View style={styles.actions}>
          <Text style={styles.sectionHeading}>{saved ? 'READ A NEWER 7/12' : 'ADD THE 7/12'}</Text>
          <Text style={styles.note}>Photograph the whole page in good light, flat, with all four edges showing.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => { setWebMsg(null); setWeb(true); }} disabled={!!busy}>
            <Text style={styles.primaryBtnText}>Open Bhulekh (you type the captcha)</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={pickPdf} disabled={!!busy}>
            <Text style={styles.secondaryBtnText}>Upload signed 7/12 PDF (Digital Satbara)</Text>
          </Pressable>
          <Text style={styles.note}>Or use a photo of a paper 7/12:</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => pick(true)} disabled={!!busy}>
            <Text style={styles.secondaryBtnText}>Take a photo</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => pick(false)} disabled={!!busy}>
            <Text style={styles.secondaryBtnText}>Choose from gallery</Text>
          </Pressable>
          {busy === 'read' ? (
            <View style={styles.reading}>
              <ActivityIndicator />
              <Text style={styles.note}>Reading the 7/12…</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {data && draft ? (
        <>
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              Read by AI. Check every field against the paper before saving: names, numbers and areas are where it slips.
            </Text>
          </View>
          {photo?.base64 || photo?.uri ? (
            <Image
              source={{ uri: photo.base64 ? `data:${photo.type ?? 'image/jpeg'};base64,${photo.base64}` : photo.uri }}
              style={styles.photo}
              resizeMode="contain"
            />
          ) : null}
          <FlagList flags={draft.flags} />

          <Text style={styles.sectionHeading}>LAND</Text>
          <Field label="Survey / gat no. with hissa" value={data.survey_number} onChange={v => set({ survey_number: v })} />
          <Field label="Village" value={data.village} onChange={v => set({ village: v })} />
          <Field label="Taluka" value={data.taluka} onChange={v => set({ taluka: v })} />
          <Field label="District" value={data.district} onChange={v => set({ district: v })} />
          <Text style={styles.fieldLabel}>Tenure (भूधारणा पद्धती)</Text>
          <View style={styles.chips}>
            {(['class_1', 'class_2', 'govt_lease'] as const).map(k => (
              <Pressable key={k} onPress={() => set({ tenure: k })} style={[styles.chip, data.tenure === k && styles.chipActive]}>
                <Text style={[styles.chipText, data.tenure === k && styles.chipTextActive]}>{TENURE[k]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Area unit printed on the 7/12</Text>
          <View style={styles.chips}>
            {([['hectare', 'हे.आर.चौ.मी (hectare)'], ['are', 'आर.चौ.मी (are, NA land)']] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => set({ area_unit: k })}
                style={[styles.chip, (data.area_unit || 'hectare') === k && styles.chipActive]}>
                <Text style={[styles.chipText, (data.area_unit || 'hectare') === k && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Total area, as written" value={data.total_area_hr} onChange={v => set({ total_area_hr: v })} />
          {data.verification_no ? (
            <Text style={styles.note}>
              Digitally signed{data.signed_on ? ` on ${data.signed_on}` : ''}. Verification no. {data.verification_no}.
            </Text>
          ) : null}

          <Text style={styles.sectionHeading}>HOLDERS</Text>
          {data.owners.map((o, i) => (
            <View key={i} style={styles.ownerCard}>
              <Field label={o.former ? 'Former holder (bracketed / struck out)' : 'Current holder'} value={o.name}
                onChange={v => set({ owners: data.owners.map((x, j) => (j === i ? { ...x, name: v } : x)) })} />
              <Field label="Mutation (फेरफार) no." value={o.mutation_no ?? ''}
                onChange={v => set({ owners: data.owners.map((x, j) => (j === i ? { ...x, mutation_no: v } : x)) })} />
              <Pressable onPress={() => set({ owners: data.owners.map((x, j) => (j === i ? { ...x, former: !x.former } : x)) })}>
                <Text style={styles.link}>{o.former ? 'Mark as current holder' : 'Mark as former holder'}</Text>
              </Pressable>
            </View>
          ))}

          <Text style={styles.sectionHeading}>RIGHTS AND ENTRIES</Text>
          <Field label="Tenant (कुळ), if any" value={data.tenants ?? ''} onChange={v => set({ tenants: v })} />
          <Field label="Other rights (इतर हक्क), one per line" multiline value={data.other_rights.join('\n')}
            onChange={v => set({ other_rights: v.split('\n').filter(l => l.trim()) })} />
          <Field label="Pending mutations, one per line" multiline value={data.pending_mutations.join('\n')}
            onChange={v => set({ pending_mutations: v.split('\n').filter(l => l.trim()) })} />
          <Field label="Last mutation no. and date" value={data.last_mutation ?? ''} onChange={v => set({ last_mutation: v })} />
          {data.notes ? <Text style={styles.note}>Reader’s note: {data.notes}</Text> : null}

          <View style={styles.row2}>
            <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => { setDraft(null); setData(null); setPhoto(null); }}>
              <Text style={styles.secondaryBtnText}>Discard</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, styles.flex, busy === 'save' && styles.disabled]} onPress={confirm} disabled={busy === 'save'}>
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
  card: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, padding: 14, gap: 4 },
  cardLine: { fontSize: 14, color: colors.onSurface },
  flags: { gap: 6 },
  flag: { borderRadius: 10, padding: 10 },
  flagText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  actions: { gap: 10 },
  reading: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  photo: { width: '100%', height: 220, borderRadius: 10, backgroundColor: colors.surfaceContainer },
  ownerCard: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, padding: 12, gap: 6 },
  link: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  input: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.onSurface },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '600' },
  chipTextActive: { color: colors.onPrimary },
  row2: { flexDirection: 'row', gap: 10, marginTop: 10 },
  flex: { flex: 1 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  disabled: { opacity: 0.5 },
  webWrap: { flex: 1, backgroundColor: colors.background },
  webHead: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 10 },
  webTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  webHint: { fontSize: 12, lineHeight: 17, color: colors.onInfoContainer, backgroundColor: colors.infoContainer, margin: 12, padding: 10, borderRadius: 10 },
  web: { flex: 1 },
  webError: { fontSize: 12, color: colors.error, paddingHorizontal: 16, paddingTop: 6 },
  webBtn: { margin: 12 },
});
