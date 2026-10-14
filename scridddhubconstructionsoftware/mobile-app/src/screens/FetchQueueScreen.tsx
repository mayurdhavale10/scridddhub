import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { api } from '../api/client';
import { mobileForBhulekh, records, type RecordRequest } from '../api/records';
import { buildFillScript, surveyPart1, type BhulekhMessage } from '../bhulekh/fillScript';
import { colors } from '../theme/colors';

type Props = { onBack: () => void };

// Land records to fetch (docs/design/land-records-acquisition.md, "assisted fetch console").
// A queue of survey numbers, by region. "Start fetching" opens each on Bhulekh in the app; the app
// fills district, taluka, village, survey and mobile; the person types ONLY the captcha and taps
// Submit; the 7/12's text is saved to the cache and the next one opens.

const BhulekhWebView = WebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebView> }>;

// Region the team is working first (owner, 2026-10-11): Thane district, Kalyan / Dombivli and
// around. Mumbai uses property cards, not 7/12s, and comes later.
const TALUKAS = ['Thane', 'Kalyan', 'Ambernath', 'Ulhasnagar', 'Bhiwandi'];
const DISTRICT = 'Thane';

const STAGE: Record<string, string> = {
  district: 'Choosing the district…', taluka: 'Choosing the taluka…', village: 'Choosing the village…',
  search: 'Searching the survey number…', survey: 'Choosing the survey number…',
};

export function FetchQueueScreen({ onBack }: Props) {
  const [taluka, setTaluka] = useState('');
  const [items, setItems] = useState<RecordRequest[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [mobile, setMobile] = useState(mobileForBhulekh.get());
  const [error, setError] = useState<string | null>(null);
  // Adding survey numbers
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<{ district: string; taluka: string; village: string }[]>([]);
  const [village, setVillage] = useState<{ district: string; taluka: string; village: string } | null>(null);
  const [surveys, setSurveys] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  // Fetching
  const [index, setIndex] = useState<number | null>(null);
  const [stage, setStage] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(0);
  const webRef = useRef<WebView>(null);

  const load = useCallback(async () => {
    try {
      const r = await records.list('queued', DISTRICT, taluka);
      setItems(r.items);
      setCounts(r.counts);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, [taluka]);

  useEffect(() => {
    load();
  }, [load]);

  // The phone's Back button leaves the fetch view for the queue, not the whole screen.
  useEffect(() => {
    if (index == null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setIndex(null);
      load();
      return true;
    });
    return () => sub.remove();
  }, [index, load]);

  useEffect(() => {
    if (query.trim().length < 3 || (village && village.village === query)) {
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await api.GET('/reference/geography/villages/search', { params: { query: { q: query.trim() } } });
      setMatches(
        (data?.results ?? [])
          .filter((m): m is { district: string; taluka: string; village: string } => !!m.district && !!m.taluka && !!m.village)
          .filter(m => m.district === DISTRICT)
          .slice(0, 6),
      );
    }, 300);
    return () => clearTimeout(t);
  }, [query, village]);

  const current = index != null ? items[index] : null;
  const plan = useMemo(
    () =>
      current
        ? {
            id: current.id,
            district: current.district_mr || current.district,
            taluka: current.taluka_mr || current.taluka,
            village: current.village_mr || current.village,
            surveyPart1: surveyPart1(current.survey_number),
            survey: current.survey_number,
            mobile,
          }
        : null,
    [current, mobile],
  );

  const next = () => {
    setStage('');
    setIndex(i => (i == null || i + 1 >= items.length ? null : i + 1));
  };

  const onMessage = async (ev: WebViewMessageEvent) => {
    if (!current || saving) return;
    let m: BhulekhMessage;
    try {
      m = JSON.parse(ev.nativeEvent.data);
    } catch {
      return;
    }
    if (m.stage === 'busy') setStage(STAGE[m.step] ?? 'Filling the form…');
    if (m.stage === 'choose') setStage(`Couldn’t match the ${m.field}: pick it by hand, then fill the captcha.`);
    if (m.stage === 'captcha') setStage('Type the captcha and tap Submit.');
    if (m.stage === 'options') {
      // "1" has hissas 1/1, 1/2…: queue each as its own lookup and move on. A list this long
      // means something went wrong, so it's left to the person.
      if (m.options.length > 60) {
        setStage(`Survey ${current.survey_number} lists ${m.options.length} entries; pick the one you need by hand.`);
        return;
      }
      setSaving(true);
      try {
        const r = await records.enqueue(m.options.map(o => ({
          district: current.district, taluka: current.taluka, village: current.village, survey_number: o,
        })));
        await records.setStatus(current.id, 'skipped', `split into ${m.options.length} hissas`);
        const fresh = await records.list('queued', DISTRICT, taluka);
        setItems(fresh.items);
        setCounts(fresh.counts);
        setStage(`Survey ${current.survey_number} has ${m.options.length} hissas: ${r.added} added to the list.`);
        setIndex(fresh.items.length ? 0 : null);
      } catch (e) {
        setStage(`Couldn’t add the hissas: ${(e as Error).message}`);
      }
      setSaving(false);
    }
    if (m.stage === 'result') {
      setSaving(true);
      setStage('Saving the 7/12…');
      try {
        await records.saveResult(current.id, m.text, m.url, m.image && m.mime ? { base64: m.image, mime: m.mime } : undefined);
        setDone(d => d + 1);
        next();
      } catch (e) {
        setStage(`Not saved: ${(e as Error).message}`);
      }
      setSaving(false);
    }
  };

  const mark = async (status: 'not_found' | 'skipped') => {
    if (!current) return;
    await records.setStatus(current.id, status).catch(() => {});
    next();
  };

  if (index != null && current && plan) {
    return (
      <View style={styles.webWrap}>
        <View style={styles.webHead}>
          <Pressable onPress={() => { setIndex(null); load(); }} hitSlop={12}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.webTitle}>{index + 1} of {items.length} · Survey {current.survey_number}</Text>
            <Text style={styles.webSub}>{current.village}, {current.taluka} · {done} saved this session</Text>
          </View>
        </View>
        <Text style={styles.webHint}>{stage || 'Opening Bhulekh…'}</Text>
        <BhulekhWebView
          key={current.id}
          ref={webRef}
          source={{ uri: 'https://bhulekh.mahabhumi.gov.in/' }}
          onLoadEnd={() => webRef.current?.injectJavaScript(buildFillScript(plan))}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          style={styles.flex}
        />
        <View style={styles.row2}>
          <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => mark('not_found')}>
            <Text style={styles.secondaryBtnText}>Not on Bhulekh</Text>
          </Pressable>
          <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => mark('skipped')}>
            <Text style={styles.secondaryBtnText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
        <Text style={styles.backArrow}>←</Text>
      </Pressable>
      <Text style={styles.title}>Land records to fetch</Text>
      <Text style={styles.subtitle}>
        Thane district first (Thane, Kalyan and Dombivli, Ambernath, Ulhasnagar, Bhiwandi). The app fills Bhulekh’s form; you
        type only the captcha. Each 7/12 is saved once and reused for every report on that land.
      </Text>

      <View style={styles.countRow}>
        <Text style={styles.count}><Text style={styles.countNum}>{counts.queued ?? 0}</Text> to fetch</Text>
        <Text style={styles.count}><Text style={styles.countNum}>{counts.fetched ?? 0}</Text> saved</Text>
        <Text style={styles.count}><Text style={styles.countNum}>{counts.not_found ?? 0}</Text> not on Bhulekh</Text>
      </View>

      <View style={styles.chips}>
        {['', ...TALUKAS].map(t => (
          <Pressable key={t || 'all'} onPress={() => setTaluka(t)} style={[styles.chip, taluka === t && styles.chipActive]}>
            <Text style={[styles.chipText, taluka === t && styles.chipTextActive]}>{t || 'All'}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Mobile number for Bhulekh (asked once)</Text>
      <TextInput style={styles.input} value={mobile} keyboardType="number-pad" placeholder="10-digit mobile"
        placeholderTextColor={colors.outline}
        onChangeText={v => { mobileForBhulekh.set(v); setMobile(mobileForBhulekh.get()); }} />

      <Pressable
        style={[styles.primaryBtn, (!items.length || mobile.length !== 10) && styles.disabled]}
        disabled={!items.length || mobile.length !== 10}
        onPress={() => { setDone(0); setIndex(0); }}>
        <Text style={styles.primaryBtnText}>Start fetching ({items.length})</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.sectionHeading}>ADD SURVEY NUMBERS</Text>
      <TextInput style={styles.input} value={query} placeholder="Village in Thane district, e.g. Nilaje"
        placeholderTextColor={colors.outline} onChangeText={v => { setQuery(v); setVillage(null); }} />
      {village ? <Text style={styles.note}>{village.village}, {village.taluka} taluka</Text> : null}
      {matches.map(m => (
        <Pressable key={`${m.taluka}/${m.village}`} style={styles.match}
          onPress={() => { setVillage(m); setQuery(m.village); setMatches([]); }}>
          <Text style={styles.rowLabel}>{m.village}</Text>
          <Text style={styles.note}>{m.taluka}</Text>
        </Pressable>
      ))}
      <TextInput style={[styles.input, styles.inputMulti]} value={surveys} multiline
        placeholder="Survey / gat numbers, separated by commas or new lines, e.g. 12, 45/2A, 101"
        placeholderTextColor={colors.outline} onChangeText={setSurveys} />
      <Pressable
        style={[styles.secondaryBtn, (!village || !surveys.trim()) && styles.disabled]}
        disabled={!village || !surveys.trim()}
        onPress={async () => {
          if (!village) return;
          const list = surveys.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
          try {
            const r = await records.enqueue(list.map(s => ({ ...village, survey_number: s })));
            setAdded(`${r.added} added (${list.length - r.added} were already in the list).`);
            setSurveys('');
            load();
          } catch (e) {
            setAdded((e as Error).message);
          }
        }}>
        <Text style={styles.secondaryBtnText}>Add to the list</Text>
      </Pressable>
      {added ? <Text style={styles.note}>{added}</Text> : null}

      <Text style={styles.sectionHeading}>TO FETCH</Text>
      <View style={styles.card}>
        {items.length ? items.map((x, i) => (
          <View key={x.id} style={[styles.row, i < items.length - 1 && styles.divider]}>
            <Text style={styles.rowLabel}>Survey {x.survey_number}</Text>
            <Text style={styles.note}>{x.village}, {x.taluka}</Text>
          </View>
        )) : <Text style={styles.note}>Nothing waiting. Add survey numbers above; parcels’ land details are added automatically.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 6 },
  backArrow: { fontSize: 22, color: colors.onSurface },
  title: { fontSize: 24, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },
  sectionHeading: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: colors.onSurfaceVariant, marginTop: 12 },
  note: { fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant },
  error: { fontSize: 13, color: colors.error },
  countRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  count: { fontSize: 12, color: colors.onSurfaceVariant },
  countNum: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '600' },
  chipTextActive: { color: colors.onPrimary },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 6 },
  input: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.onSurface },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  match: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer },
  card: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, padding: 12 },
  row: { paddingVertical: 8 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer },
  rowLabel: { fontSize: 14, color: colors.onSurface },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primaryBtnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  disabled: { opacity: 0.4 },
  webWrap: { flex: 1, backgroundColor: colors.background },
  webHead: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 10 },
  webTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  webSub: { fontSize: 12, color: colors.onSurfaceVariant },
  webHint: { fontSize: 13, fontWeight: '600', color: colors.onInfoContainer, backgroundColor: colors.infoContainer, margin: 12, padding: 10, borderRadius: 10 },
  row2: { flexDirection: 'row', gap: 10, padding: 12 },
});
