import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { DEV_PROJECT_ID } from '../config/devProject';

type Props = {
  onBack: () => void;
  onCreated: () => void;
};

type Flow = 'priced' | 'estimate';

// A standalone, location-based estimate from Maharashtra's own published Ready Reckoner Rate —
// never a comparison against other parcels in this app (docs/adr/0004). `null` after a lookup
// means no rate is on file yet for this exact village, not zero value.
type Estimate = {
  ratePerSqm: number;
  effectiveYear: string;
  sourceUrl: string;
  verifiedAt: string;
  estimatedValueCr: number;
} | null;

// The Groq fallback for a location that isn't in Maharashtra's real geography data yet —
// deliberately a different shape from Estimate above (no source URL, no verified_at, a
// reasoning string instead) so it can never be mistaken for the government-data-backed one.
// Confidence is always "low"; this is unverified by construction, not a judgment about this
// particular guess.
type AIEstimate = {
  estimatedTotalValueCr: number;
  estimatedRatePerAcre: number;
  reasoning: string;
  model: string;
} | null;

type VillageResult = { district: string; taluka: string; village: string };

// Free-text Location with suggestions from all 44,918 real Maharashtra villages. Picking one
// (case A) links the parcel to real geography, so the estimate can use the database's Ready
// Reckoner rate; typing anything else and not picking (case B) is fully fine — the estimate then
// works from the typed text alone. No "check the spelling" nagging: many real localities
// (societies, landmarks) simply aren't villages. Debounced 300ms.
function LocationSearchField({
  value,
  picked,
  onChangeText,
  onPick,
}: {
  value: string;
  picked: VillageResult | null;
  onChangeText: (text: string) => void;
  onPick: (match: VillageResult) => void;
}) {
  const [results, setResults] = useState<VillageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onType = (text: string) => {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const { data } = await api.GET('/reference/geography/villages/search', {
        params: { query: { q: trimmed } },
      });
      setResults(
        (data?.results ?? []).filter((r): r is VillageResult =>
          Boolean(r.district && r.taluka && r.village),
        ),
      );
      setLoading(false);
    }, 300);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Location</Text>
      <View style={styles.sourceBox}>
        <TextInput
          style={styles.locationSearchInput}
          value={value}
          onChangeText={onType}
          onBlur={() => {
            // Tapping elsewhere dismisses the suggestions. Deferred so a tap ON a suggestion
            // (which also blurs this field) still gets to fire its onPress first.
            setTimeout(() => setResults([]), 150);
          }}
          placeholder="area, city"
          placeholderTextColor={colors.outline}
          autoCorrect={false}
        />
        {loading ? <ActivityIndicator size="small" color={colors.onSurfaceVariant} /> : null}
      </View>
      {picked ? (
        <Text style={styles.sourceCaption}>
          matched village: {picked.village}, {picked.taluka}, {picked.district}
        </Text>
      ) : null}
      {results.length > 0 ? (
        <View style={styles.sourceMenu}>
          {results.map((r, i) => (
            <Pressable
              key={`${r.district}-${r.taluka}-${r.village}-${i}`}
              onPress={() => {
                setResults([]);
                onPick(r);
              }}
              style={styles.sourceOption}>
              <Text style={styles.sourceOptionText}>{r.village}</Text>
              <Text style={styles.sourceCaption}>
                {r.taluka}, {r.district}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setResults([])} style={styles.sourceOptionDismiss}>
            <Text style={styles.sourceOptionDismissText}>None of these — keep what I typed</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// Two different vocabularies on purpose: a priced deal (Flow A) came through a different set of
// channels than a scouted, not-yet-priced location (Flow B) — see Screen 4.1/4.2.
const SOURCE_OPTIONS_PRICED = [
  'Broker',
  'Online listing (99acres, MagicBricks)',
  'Direct owner outreach',
  'Referral',
  'Government auction',
  'Other',
];
const SOURCE_OPTIONS_ESTIMATE = [
  'Field survey/scouting',
  'Broker mentioned, no formal offer',
  'DP portal reservation check',
  'Referral',
  'Other',
];

// Only sources that plausibly have a real link behind them get the optional URL field — a
// broker phone call or a field survey doesn't have one to give.
const SOURCE_OPTIONS_WITH_LINK = new Set([
  'Online listing (99acres, MagicBricks)',
  'DP portal reservation check',
]);

function SourceField({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Source</Text>
      <Pressable onPress={() => setOpen(o => !o)} style={styles.sourceBox}>
        <Text style={[styles.sourceValue, !value && styles.sourcePlaceholder]}>
          {value ?? 'Select source'}
        </Text>
        <Text style={styles.sourceChevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.sourceMenu}>
          {options.map(opt => (
            <Pressable
              key={opt}
              onPress={() => {
                onChange(opt);
                setOpen(false);
              }}
              style={styles.sourceOption}>
              <Text style={styles.sourceOptionText}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.sourceCaption}>{options.join(' · ')}</Text>
      )}
    </View>
  );
}

function SourceLinkField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Listing URL (optional)</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="paste the listing/portal link"
        placeholderTextColor={colors.outline}
      />
    </View>
  );
}

export function CreateLandParcelScreen({ onBack, onCreated }: Props) {
  const [flow, setFlow] = useState<Flow>('priced');

  // Free-text location — the same plain field in both flows.
  const [location, setLocation] = useState('');

  // Flow A ("I have a price") only.
  const [name, setName] = useState('');
  const [costCr, setCostCr] = useState('');
  const [fsi, setFsi] = useState('');

  // Shared across both flows.
  const [areaAcres, setAreaAcres] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Flow B ("Just checking a location") only. `picked` is set only when the user chose one of
  // the real-village suggestions (case A); otherwise the typed location stands alone (case B).
  const [picked, setPicked] = useState<VillageResult | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<Estimate>(null);
  const [aiEstimate, setAiEstimate] = useState<AIEstimate>(null);
  const [aiEstimateError, setAiEstimateError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectFlow = (next: Flow) => {
    if (next === flow) return;
    setFlow(next);
    setSource(null); // the two flows use different source vocabularies
    setSourceUrl('');
    setError(null);
  };

  const selectSource = (next: string) => {
    setSource(next);
    if (!SOURCE_OPTIONS_WITH_LINK.has(next)) {
      setSourceUrl('');
    }
    clearEstimates();
  };

  // Every input the estimate uses (location, area, source, notes) makes a shown result stale.
  const requestSeqRef = useRef(0);
  const clearEstimates = () => {
    requestSeqRef.current++; // drop any in-flight result for the old inputs
    setEstimating(false);
    setEstimate(null);
    setAiEstimate(null);
    setAiEstimateError(null);
  };

  const onFlowBLocationChange = (text: string) => {
    setLocation(text);
    setPicked(null); // editing the text un-links any previously picked village
    clearEstimates();
  };

  const onFlowBPick = (match: VillageResult) => {
    setLocation(`${match.village}, ${match.taluka}, ${match.district}`);
    setPicked(match);
    clearEstimates();
  };

  // On-demand only — runs when the user presses "Estimate Value". Standalone and location-based,
  // never a comparison against other parcels in this app (docs/adr/0004).
  //   Case A (real village picked): the database's government Ready Reckoner rate, if on file, is
  //     shown as its own card AND given to the LLM (server-side lookup) as a floor, together with
  //     location, area, source and notes.
  //   Case B (no village picked): the same LLM call from location, area, source and notes alone.
  const estimateValue = async () => {
    const acres = Number(areaAcres);
    const typed = location.trim();
    if (!typed || !(acres > 0)) return;
    clearEstimates();
    const seq = requestSeqRef.current;
    setEstimating(true);

    const aiQuery = {
      location: typed,
      area_acres: acres,
      source: source ?? undefined,
      notes: notes.trim() || undefined,
      ...(picked ?? {}),
    };
    const [rrr, ai] = await Promise.all([
      picked
        ? api.GET('/land-parcels/estimate-value', {
            params: { query: { ...picked, area_acres: acres } },
          })
        : Promise.resolve(null),
      api.GET('/land-parcels/estimate-value/ai', { params: { query: aiQuery } }),
    ]);
    if (seq !== requestSeqRef.current) return; // inputs changed while this was in flight
    setEstimating(false);

    if (rrr?.data) {
      const d = rrr.data;
      setEstimate({
        ratePerSqm: d.rate_per_sqm_rupees!,
        effectiveYear: d.effective_year!,
        sourceUrl: d.source_url!,
        verifiedAt: d.verified_at!,
        estimatedValueCr: d.estimated_value_rupees! / 1e7,
      });
    }
    if (ai.error || !ai.data) {
      setAiEstimateError('Could not get an estimate — try again in a moment.');
      return;
    }
    setAiEstimate({
      estimatedTotalValueCr: ai.data.estimated_total_value_rupees! / 1e7,
      estimatedRatePerAcre: ai.data.estimated_rate_per_acre_rupees!,
      reasoning: ai.data.reasoning!,
      model: ai.data.model!,
    });
  };

  const canSubmit =
    !submitting &&
    (flow === 'priced'
      ? location.trim().length > 0 && name.trim().length > 0 && Number(areaAcres) > 0 && Number(costCr) > 0
      : location.trim().length > 0);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    // Flow B has no separate Name field in the design — the typed location stands in as both,
    // until there's something more specific to call it.
    const { error: apiError } = await api.POST('/land-parcels', {
      body: {
        project_id: DEV_PROJECT_ID,
        name: flow === 'priced' ? name.trim() : location.trim(),
        location: location.trim(),
        area_acres: areaAcres.trim() ? Number(areaAcres) : undefined,
        cost_rupees: flow === 'priced' ? Math.round(Number(costCr) * 1e7) : undefined,
        fsi: flow === 'priced' && fsi.trim() ? Number(fsi) : undefined,
        source: source ?? undefined,
        source_url: sourceUrl.trim() || undefined,
        // Structured location — only known for Flow B, and only when the user picked a real village
        // suggestion. Kept alongside `location`, not instead of it, so a future closed price on this
        // parcel can be pooled into the pricing dataset (docs/adr/0005) without needing to solve
        // free-text location matching first.
        district: flow === 'estimate' ? picked?.district : undefined,
        taluka: flow === 'estimate' ? picked?.taluka : undefined,
        village: flow === 'estimate' ? picked?.village : undefined,
        notes: notes.trim() || undefined,
      },
    });
    setSubmitting(false);
    if (apiError) {
      setError('Could not create the parcel. Check the values and try again.');
      return;
    }
    onCreated();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>New Land Parcel</Text>

      <View style={styles.toggle}>
        <Pressable
          onPress={() => selectFlow('priced')}
          style={[styles.toggleTab, flow === 'priced' && styles.toggleTabActive]}>
          <Text style={[styles.toggleTabText, flow === 'priced' && styles.toggleTabTextActive]}>
            I have a price
          </Text>
        </Pressable>
        <Pressable
          onPress={() => selectFlow('estimate')}
          style={[styles.toggleTab, flow === 'estimate' && styles.toggleTabActive]}>
          <Text style={[styles.toggleTabText, flow === 'estimate' && styles.toggleTabTextActive]}>
            Just checking a location
          </Text>
        </Pressable>
      </View>
      <Text style={styles.toggleHelper}>
        {flow === 'priced'
          ? "no offer or asking price yet? switch tabs — we'll estimate a value instead of asking for one"
          : "no offer or asking price yet — we'll estimate a value instead of asking for one"}
      </Text>

      {flow === 'priced' ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Parcel A — Wagholi Rd"
              placeholderTextColor={colors.outline}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="area, city"
              placeholderTextColor={colors.outline}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={styles.label}>Area (acres)</Text>
              <TextInput
                style={styles.input}
                value={areaAcres}
                onChangeText={setAreaAcres}
                keyboardType="decimal-pad"
                placeholder="e.g. 2.1"
                placeholderTextColor={colors.outline}
              />
            </View>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={styles.label}>Asking Price (₹ Cr)</Text>
              <TextInput
                style={styles.input}
                value={costCr}
                onChangeText={setCostCr}
                keyboardType="decimal-pad"
                placeholder="e.g. 3.2"
                placeholderTextColor={colors.outline}
              />
            </View>
          </View>

          <SourceField value={source} options={SOURCE_OPTIONS_PRICED} onChange={selectSource} />
          {source && SOURCE_OPTIONS_WITH_LINK.has(source) ? (
            <SourceLinkField value={sourceUrl} onChange={setSourceUrl} />
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>FSI (optional)</Text>
            <TextInput
              style={styles.input}
              value={fsi}
              onChangeText={setFsi}
              keyboardType="decimal-pad"
              placeholder="e.g. 1.5"
              placeholderTextColor={colors.outline}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="any context worth recording"
              placeholderTextColor={colors.outline}
            />
          </View>

          <Text style={styles.stageCaption}>
            new parcels always start at stage <Text style={styles.stageCaptionBold}>'Sourced'</Text> — no
            stage picker needed here
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}>
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>Add Parcel</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <LocationSearchField
            value={location}
            picked={picked}
            onChangeText={onFlowBLocationChange}
            onPick={onFlowBPick}
          />

          <View style={styles.field}>
            <Text style={styles.label}>Area (acres)</Text>
            <TextInput
              style={styles.input}
              value={areaAcres}
              onChangeText={text => {
                setAreaAcres(text);
                clearEstimates();
              }}
              keyboardType="decimal-pad"
              placeholder="e.g. 2.1"
              placeholderTextColor={colors.outline}
            />
          </View>

          <SourceField value={source} options={SOURCE_OPTIONS_ESTIMATE} onChange={selectSource} />
          {source && SOURCE_OPTIONS_WITH_LINK.has(source) ? (
            <SourceLinkField value={sourceUrl} onChange={setSourceUrl} />
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={text => {
                setNotes(text);
                clearEstimates(); // notes feed the estimate, so an edit makes it stale
              }}
              multiline
              placeholder="any context worth recording — used in the estimate"
              placeholderTextColor={colors.outline}
            />
          </View>

          <Pressable
            onPress={estimateValue}
            disabled={!location.trim() || !(Number(areaAcres) > 0) || estimating}
            style={[
              styles.submitButton,
              (!location.trim() || !(Number(areaAcres) > 0) || estimating) &&
                styles.submitButtonDisabled,
            ]}>
            {estimating ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>Estimate Value</Text>
            )}
          </Pressable>

          {estimate ? (
            <View style={styles.estimateCard}>
              <Text style={styles.estimateCardHeading}>
                Government floor value (stamp-duty basis)
              </Text>
              <Text style={styles.estimateCardRange}>₹{estimate.estimatedValueCr.toFixed(2)} Cr</Text>
              <Text style={[styles.estimateCardText, styles.estimateCardWarning]}>
                this is the legal minimum used for stamp duty, not a market estimate — real asking
                prices in developing areas are often several times higher.
              </Text>
              <View style={styles.estimateDivider} />
              <Text style={styles.estimateCardText}>
                ₹{estimate.ratePerSqm.toLocaleString('en-IN')}/m² — Maharashtra Ready Reckoner
                Rate, {estimate.effectiveYear}, verified{' '}
                {new Date(estimate.verifiedAt).toLocaleDateString()}
              </Text>
              <Pressable onPress={() => Linking.openURL(estimate.sourceUrl)}>
                <Text style={styles.estimateSourceLink}>View source (e-ASR portal) →</Text>
              </Pressable>
              <Text style={styles.estimateCardText}>
                a standalone valuation from this location's own government-published rate — not a
                comparison against any other parcel in this app.
              </Text>
            </View>
          ) : null}

          {aiEstimate ? (
            <View style={styles.estimateCard}>
              <Text style={styles.estimateCardHeading}>AI Estimate</Text>
              <Text style={styles.estimateCardRange}>
                ₹{aiEstimate.estimatedTotalValueCr.toFixed(2)} Cr
              </Text>
              <Text style={styles.estimateCardText}>Not based on real market data.</Text>
              <View style={styles.estimateDivider} />
              <Text style={styles.estimateCardText}>{aiEstimate.reasoning}</Text>
              <Text style={styles.estimateCardText}>
                ₹{aiEstimate.estimatedRatePerAcre.toLocaleString('en-IN')}/acre
              </Text>
            </View>
          ) : null}

          {aiEstimateError ? (
            <View style={styles.estimateCard}>
              <Text style={styles.estimateCardText}>{aiEstimateError}</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.saveOutlineButton, !canSubmit && styles.submitButtonDisabled]}>
            {submitting ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.saveOutlineButtonText}>Save as Parcel</Text>
            )}
          </Pressable>
          <Text style={styles.stageCaption}>
            saves at stage 'Sourced', no price recorded — the estimate shown above isn't stored as
            an asking price
          </Text>
        </>
      )}
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
    gap: 12,
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 2,
  },
  toggle: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 999,
    padding: 6,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  toggleTabActive: {
    backgroundColor: colors.primary,
  },
  toggleTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  toggleTabTextActive: {
    color: colors.onPrimary,
  },
  toggleHelper: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    lineHeight: 15,
    marginTop: -4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  field: {
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLowest,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sourceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surfaceContainerLowest,
  },
  sourceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  sourcePlaceholder: {
    fontWeight: '400',
    color: colors.outline,
  },
  sourceChevron: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  sourceCaption: {
    fontSize: 11,
    color: colors.outline,
    lineHeight: 15,
  },
  sourceMenu: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerLowest,
    overflow: 'hidden',
  },
  sourceOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  sourceOptionText: {
    fontSize: 13,
    color: colors.onSurface,
  },
  sourceOptionDismiss: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sourceOptionDismissText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  locationSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.onSurface,
    paddingVertical: 0,
  },
  stageCaption: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 15,
  },
  stageCaptionBold: {
    fontWeight: '700',
    color: colors.onSurface,
  },
  estimateCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginTop: 8,
  },
  estimateCardHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  estimateCardRange: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  estimateCardText: {
    fontSize: 12,
    color: colors.outline,
    lineHeight: 18,
  },
  estimateCardWarning: {
    color: colors.error,
    fontWeight: '600',
  },
  aiEstimateLoading: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  aiEstimateLoadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  estimateDivider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
  },
  estimateSourceLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.3,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  saveOutlineButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveOutlineButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
