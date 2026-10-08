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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import type { components } from '@scridddhub/api-client';

type LegalCheck = components['schemas']['LegalCheck'];
type RiskLevel = components['schemas']['RiskLevel'];
type ChainEntry = components['schemas']['OwnershipChainEntry'];
type ReraEntry = components['schemas']['RERAHistoryEntry'];

type Props = {
  parcelId: string;
  onBack: () => void;
  onDealClosed: () => void;
};

// Screen 6: Legal & RERA Check (Level 1). Any parcel starts from the standard checklist
// (POST /legal-check). The team fills it in here: risks, title chain, searches, the seller's
// RERA track record, documents. Every change saves immediately (PUT). "Deal Closed" unlocks once
// every risk is judged and every search is done; the backend enforces the same rule.

const RISK_LEVELS: RiskLevel[] = ['not_checked', 'low', 'medium', 'high'];

const RISK_LABEL: Record<RiskLevel, string> = {
  not_checked: 'Not checked',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const RISK_STYLE: Record<RiskLevel, { bg: string; text: string }> = {
  not_checked: { bg: colors.surfaceContainer, text: colors.onSurfaceVariant },
  low: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer },
  medium: { bg: '#f5efdc', text: '#8a6a1a' },
  high: { bg: '#fbe9e5', text: colors.error },
};

type RiskKey = 'ownership' | 'litigation' | 'encumbrance' | 'regulatory';

const RISKS: { key: RiskKey; label: string }[] = [
  { key: 'ownership', label: 'Ownership' },
  { key: 'litigation', label: 'Litigation' },
  { key: 'encumbrance', label: 'Encumbrance' },
  { key: 'regulatory', label: 'Regulatory' },
];

function riskOf(c: LegalCheck, key: RiskKey): RiskLevel {
  return (c[`${key}_risk`] as RiskLevel | undefined) ?? 'not_checked';
}

function noteOf(c: LegalCheck, key: RiskKey): string {
  return (c[`${key}_risk_note`] as string | undefined) ?? '';
}

function toBody(c: LegalCheck) {
  return {
    ownership_risk: riskOf(c, 'ownership'),
    ownership_risk_note: noteOf(c, 'ownership'),
    litigation_risk: riskOf(c, 'litigation'),
    litigation_risk_note: noteOf(c, 'litigation'),
    encumbrance_risk: riskOf(c, 'encumbrance'),
    encumbrance_risk_note: noteOf(c, 'encumbrance'),
    regulatory_risk: riskOf(c, 'regulatory'),
    regulatory_risk_note: noteOf(c, 'regulatory'),
    ownership_chain: c.ownership_chain ?? [],
    encumbrance_searches: c.encumbrance_searches ?? [],
    search_summary_note: c.search_summary_note ?? '',
    rera_history: c.rera_history ?? [],
    rera_history_summary_note: c.rera_history_summary_note ?? '',
    documents: c.documents ?? [],
    status: c.status ?? 'in_progress',
  };
}

// What still blocks "Deal Closed", in the same terms as the backend's OpenItems.
function openItems(c: LegalCheck): string[] {
  const open: string[] = [];
  const unjudged = RISKS.filter(r => riskOf(c, r.key) === 'not_checked').length;
  if (unjudged) open.push(`${unjudged} risk${unjudged > 1 ? 's' : ''} not checked`);
  const pending = (c.encumbrance_searches ?? []).filter(s => !s.completed).length;
  if (pending) open.push(`${pending} search${pending > 1 ? 'es' : ''} not done`);
  return open;
}

// ---- Edit sheets ----------------------------------------------------------------------------

type Field = { key: string; label: string; placeholder?: string; multiline?: boolean };

type SheetState = {
  title: string;
  fields: Field[];
  values: Record<string, string>;
  toggle?: { label: string; value: boolean };
  onSave: (values: Record<string, string>, toggle: boolean) => void;
  onDelete?: () => void;
};

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetBackdrop}
        // Android already resizes the window for the keyboard; adjusting again shifts the sheet
        // twice and taps miss.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* While the keyboard is up the sheet shifts as it closes, so a tap meant for the sheet
            can land here; then it only hides the keyboard instead of closing the sheet. */}
        <Pressable
          style={styles.sheetDismiss}
          onPress={() => (Keyboard.isVisible() ? Keyboard.dismiss() : onClose())}
        />
        {/* ScrollView so a tap on Save while the keyboard is up saves, not just closes it. */}
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>{title}</Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditSheet({ sheet, onClose }: { sheet: SheetState; onClose: () => void }) {
  const [values, setValues] = useState(sheet.values);
  const [toggle, setToggle] = useState(sheet.toggle?.value ?? false);
  const firstKey = sheet.fields[0]?.key;
  const canSave = !firstKey || (values[firstKey] ?? '').trim() !== '';

  return (
    <Sheet title={sheet.title} onClose={onClose}>
      {sheet.fields.map(f => (
        <View key={f.key} style={styles.field}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <TextInput
            style={[styles.input, f.multiline && styles.inputMultiline]}
            value={values[f.key] ?? ''}
            placeholder={f.placeholder}
            placeholderTextColor={colors.outline}
            multiline={f.multiline}
            onChangeText={text => setValues(v => ({ ...v, [f.key]: text }))}
          />
        </View>
      ))}
      {sheet.toggle ? (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{sheet.toggle.label}</Text>
          <Switch value={toggle} onValueChange={setToggle} />
        </View>
      ) : null}
      <View style={styles.sheetActions}>
        {sheet.onDelete ? (
          <Pressable
            style={styles.sheetSecondary}
            onPress={() => {
              sheet.onDelete!();
              onClose();
            }}>
            <Text style={styles.deleteText}>Remove</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.sheetSecondary} onPress={onClose}>
            <Text style={styles.sheetSecondaryText}>Cancel</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.sheetPrimary, !canSave && styles.disabled]}
          disabled={!canSave}
          onPress={() => {
            const trimmed: Record<string, string> = {};
            for (const f of sheet.fields) trimmed[f.key] = (values[f.key] ?? '').trim();
            sheet.onSave(trimmed, toggle);
            onClose();
          }}>
          <Text style={styles.sheetPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function RiskSheet({
  label,
  risk,
  note,
  onSave,
  onClose,
}: {
  label: string;
  risk: RiskLevel;
  note: string;
  onSave: (risk: RiskLevel, note: string) => void;
  onClose: () => void;
}) {
  const [level, setLevel] = useState(risk);
  const [text, setText] = useState(note);
  return (
    <Sheet title={`${label} risk`} onClose={onClose}>
      <View style={styles.chips}>
        {RISK_LEVELS.map(l => {
          const active = l === level;
          return (
            <Pressable
              key={l}
              onPress={() => setLevel(l)}
              style={[
                styles.chip,
                active && { backgroundColor: RISK_STYLE[l].bg, borderColor: RISK_STYLE[l].text },
              ]}>
              <Text style={[styles.chipText, active && { color: RISK_STYLE[l].text }]}>
                {RISK_LABEL[l]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Note (optional)</Text>
        <TextInput
          style={styles.input}
          value={text}
          placeholder="e.g. CC pending"
          placeholderTextColor={colors.outline}
          onChangeText={setText}
        />
      </View>
      <View style={styles.sheetActions}>
        <Pressable style={styles.sheetSecondary} onPress={onClose}>
          <Text style={styles.sheetSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={styles.sheetPrimary}
          onPress={() => {
            onSave(level, text.trim());
            onClose();
          }}>
          <Text style={styles.sheetPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

type ReraHistory = components['schemas']['RERAPromoterHistory'];
type ReraMatch = components['schemas']['RERAPromoterMatch'];

// Looks the seller up in collected public MahaRERA records: type a name, pick the developer,
// preview their projects and complaint count, then add them to the check.
function ReraSearchSheet({
  onAdd,
  onClose,
}: {
  onAdd: (history: ReraHistory) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<ReraMatch[]>([]);
  const [history, setHistory] = useState<ReraHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (history || query.trim().length < 3) {
      setMatches([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await api.GET('/rera/promoters', {
        params: { query: { q: query.trim() } },
      });
      setMatches(data ?? []);
      setSearched(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, history]);

  const pick = async (name: string) => {
    setLoading(true);
    const { data } = await api.GET('/rera/promoters/history', {
      params: { query: { name } },
    });
    setLoading(false);
    if (data) setHistory(data);
  };

  return (
    <Sheet title="Find seller on MahaRERA" onClose={onClose}>
      {!history ? (
        <>
          <TextInput
            style={styles.input}
            value={query}
            autoFocus
            placeholder="Developer or seller name"
            placeholderTextColor={colors.outline}
            onChangeText={setQuery}
          />
          {matches.map(m => (
            <Pressable key={m.promoter_name} style={styles.matchRow} onPress={() => pick(m.promoter_name)}>
              <Text style={styles.matchName}>{m.promoter_name}</Text>
              <Text style={styles.matchCount}>
                {m.projects} project{m.projects === 1 ? '' : 's'}
              </Text>
            </Pressable>
          ))}
          {searched && matches.length === 0 ? (
            <Text style={styles.emptyRow}>No developer by that name in MahaRERA records yet.</Text>
          ) : null}
          {loading ? <ActivityIndicator /> : null}
        </>
      ) : (
        <>
          <Text style={styles.matchName}>{history.promoter_name}</Text>
          <Text style={styles.summaryNote}>{reraSummary(history)}</Text>
          {history.projects.slice(0, 6).map(p => (
            <View key={p.registration_number} style={styles.previewRow}>
              <Text style={styles.reraName} numberOfLines={1}>
                {p.project_name}
              </Text>
              <Text style={styles.reraNumber}>
                MahaRERA {p.registration_number}
                {p.location ? ` · ${p.location}` : ''}
                {p.has_extension ? ' · time extension' : ''}
              </Text>
            </View>
          ))}
          {history.projects.length > 6 ? (
            <Text style={styles.summaryNote}>+ {history.projects.length - 6} more</Text>
          ) : null}
          <View style={styles.sheetActions}>
            <Pressable style={styles.sheetSecondary} onPress={() => setHistory(null)}>
              <Text style={styles.sheetSecondaryText}>Back</Text>
            </Pressable>
            <Pressable
              style={styles.sheetPrimary}
              onPress={() => {
                onAdd(history);
                onClose();
              }}>
              <Text style={styles.sheetPrimaryText}>
                Add {history.projects.length} project{history.projects.length === 1 ? '' : 's'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </Sheet>
  );
}

function reraSummary(h: ReraHistory): string {
  const n = h.projects.length;
  // "found" until a statewide collection has finished; only then is the count a total.
  const parts = [
    h.projects_complete
      ? `${n} registered project${n === 1 ? '' : 's'} on MahaRERA`
      : `${n} project${n === 1 ? '' : 's'} found on MahaRERA`,
  ];
  if (n > 0) parts.push(`${h.with_extension} with a time extension`);
  if (h.complaints != null) {
    parts.push(`${h.complaints} complaint${h.complaints === 1 ? '' : 's'} on record`);
  }
  const asOf = h.projects_as_of ?? h.complaints_as_of;
  return parts.join(' · ') + (asOf ? ` (MahaRERA, as of ${asOf})` : '');
}

// ---- Small pieces ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: string }) {
  return <Text style={styles.sectionHeading}>{children}</Text>;
}

function CheckBadge({ done }: { done: boolean }) {
  return (
    <View style={[styles.checkBadge, done ? styles.checkDone : styles.checkPending]}>
      <Text style={[styles.checkText, done ? styles.checkTextDone : styles.checkTextPending]}>
        {done ? '✓' : '…'}
      </Text>
    </View>
  );
}

function AddLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.addLink}>
      <Text style={styles.addLinkText}>+ {label}</Text>
    </Pressable>
  );
}

// ---- Screen ---------------------------------------------------------------------------------

export function LegalCheckScreen({ parcelId, onBack, onDealClosed }: Props) {
  const [check, setCheck] = useState<LegalCheck | null>(null);
  const [parcelName, setParcelName] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [riskEdit, setRiskEdit] = useState<RiskKey | null>(null);
  const [reraSearch, setReraSearch] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.GET('/land-parcels/{parcelID}/legal-check', {
        params: { path: { parcelID: parcelId } },
      }),
      api.GET('/land-parcels/{id}', { params: { path: { id: parcelId } } }),
    ])
      .then(([legal, parcel]) => {
        setCheck(legal.data ?? null);
        setParcelName(parcel.data?.name ?? '');
      })
      .finally(() => setLoading(false));
  }, [parcelId]);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    const { data, error: apiError } = await api.POST(
      '/land-parcels/{parcelID}/legal-check',
      { params: { path: { parcelID: parcelId } } },
    );
    setStarting(false);
    if (apiError || !data) {
      setError('Could not start the legal check. Try again.');
    } else {
      setCheck(data);
    }
  }, [parcelId]);

  // Saves the whole check. The screen updates at once and rolls back if the save fails.
  const save = useCallback(
    async (next: LegalCheck) => {
      const previous = check;
      setCheck(next);
      setError(null);
      const { data, error: apiError } = await api.PUT(
        '/land-parcels/{parcelID}/legal-check',
        { params: { path: { parcelID: parcelId } }, body: toBody(next) },
      );
      if (apiError || !data) {
        setCheck(previous);
        setError('Could not save that change. Try again.');
        return false;
      }
      setCheck(data);
      return true;
    },
    [check, parcelId],
  );

  const closeDeal = useCallback(async () => {
    if (!check) return;
    if (check.status === 'cleared') {
      onDealClosed();
      return;
    }
    setClearing(true);
    const ok = await save({ ...check, status: 'cleared' });
    setClearing(false);
    if (ok) onDealClosed();
  }, [check, save, onDealClosed]);

  const header = (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
        <Text style={styles.backArrow}>←</Text>
      </Pressable>
      <Text style={styles.title}>Legal &amp; RERA Check</Text>
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

  if (!check) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {header}
        <View style={styles.startCard}>
          <Text style={styles.startTitle}>No legal check started yet</Text>
          <Text style={styles.startText}>
            Start the standard checklist: four risks to judge, three public-record searches and the
            documents to collect. Fill it in as you go.
          </Text>
          <Pressable
            style={[styles.ctaButton, starting && styles.disabled]}
            disabled={starting}
            onPress={start}>
            <Text style={styles.ctaButtonText}>
              {starting ? 'Starting…' : 'Start legal check'}
            </Text>
          </Pressable>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  const chain = check.ownership_chain ?? [];
  const searches = check.encumbrance_searches ?? [];
  const rera = check.rera_history ?? [];
  const documents = check.documents ?? [];
  const open = openItems(check);
  const cleared = check.status === 'cleared';

  const editChainEntry = (index: number | null) => {
    const entry: ChainEntry = index === null ? {} : chain[index];
    setSheet({
      title: index === null ? 'Add title step' : 'Edit title step',
      fields: [
        { key: 'title', label: 'Step', placeholder: 'e.g. Sale deed, 2014' },
        {
          key: 'description',
          label: 'Details',
          placeholder: 'e.g. to current owner, registered & stamped',
          multiline: true,
        },
      ],
      values: { title: entry.title ?? '', description: entry.description ?? '' },
      toggle: { label: 'End of chain (traced back, uncontested)', value: !!entry.is_final },
      onSave: (v, isFinal) => {
        const updated: ChainEntry = { title: v.title, description: v.description, is_final: isFinal };
        const next = index === null ? [...chain, updated] : chain.map((e, i) => (i === index ? updated : e));
        save({ ...check, ownership_chain: next });
      },
      onDelete:
        index === null
          ? undefined
          : () => save({ ...check, ownership_chain: chain.filter((_, i) => i !== index) }),
    });
  };

  const editReraEntry = (index: number | null) => {
    const entry: ReraEntry = index === null ? {} : rera[index];
    setSheet({
      title: index === null ? 'Add past project' : 'Edit past project',
      fields: [
        { key: 'project_name', label: 'Project', placeholder: 'e.g. Sunrise Heights' },
        { key: 'rera_registration_number', label: 'MahaRERA number', placeholder: 'e.g. P52100012345' },
        { key: 'delivery_status', label: 'Delivery', placeholder: 'e.g. delivered on time' },
      ],
      values: {
        project_name: entry.project_name ?? '',
        rera_registration_number: entry.rera_registration_number ?? '',
        delivery_status: entry.delivery_status ?? '',
      },
      onSave: v => {
        const updated: ReraEntry = {
          project_name: v.project_name,
          rera_registration_number: v.rera_registration_number,
          delivery_status: v.delivery_status,
        };
        const next = index === null ? [...rera, updated] : rera.map((e, i) => (i === index ? updated : e));
        save({ ...check, rera_history: next });
      },
      onDelete:
        index === null
          ? undefined
          : () => save({ ...check, rera_history: rera.filter((_, i) => i !== index) }),
    });
  };

  const editNote = (
    field: 'search_summary_note' | 'rera_history_summary_note',
    title: string,
    placeholder: string,
  ) =>
    setSheet({
      title,
      fields: [{ key: 'note', label: 'Summary', placeholder, multiline: true }],
      values: { note: check[field] ?? '' },
      onSave: v => save({ ...check, [field]: v.note }),
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {header}

      <SectionHeading>RISK BREAKDOWN</SectionHeading>
      <View style={styles.card}>
        {RISKS.map((r, i) => {
          const risk = riskOf(check, r.key);
          const note = noteOf(check, r.key);
          return (
            <Pressable
              key={r.key}
              onPress={() => setRiskEdit(r.key)}
              style={[styles.row, i < RISKS.length - 1 && styles.divider]}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <View style={[styles.pill, { backgroundColor: RISK_STYLE[risk].bg }]}>
                <Text style={[styles.pillText, { color: RISK_STYLE[risk].text }]}>
                  {RISK_LABEL[risk]}
                  {note ? ` — ${note}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <SectionHeading>OWNERSHIP CHAIN</SectionHeading>
      <View style={[styles.card, styles.chainCard]}>
        {chain.length === 0 ? (
          <Text style={styles.emptyRow}>
            Add each transfer from the earliest record to the current owner.
          </Text>
        ) : (
          chain.map((entry, i) => {
            const last = i === chain.length - 1;
            return (
              <Pressable key={i} onPress={() => editChainEntry(i)} style={styles.chainRow}>
                <View style={styles.chainRail}>
                  <View style={[styles.chainDot, entry.is_final && styles.chainDotFinal]} />
                  {!last ? <View style={styles.chainLine} /> : null}
                </View>
                <View style={[styles.chainText, entry.is_final && styles.chainFinalBox]}>
                  <Text style={[styles.chainTitle, entry.is_final && styles.chainTitleFinal]}>
                    {entry.title}
                  </Text>
                  {entry.description ? (
                    <Text style={styles.chainDescription}>{entry.description}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
        <AddLink label="Add title step" onPress={() => editChainEntry(null)} />
      </View>

      <SectionHeading>ENCUMBRANCE &amp; LITIGATION SEARCH</SectionHeading>
      <View style={styles.card}>
        {searches.map((item, i) => (
          <Pressable
            key={i}
            onPress={() =>
              save({
                ...check,
                encumbrance_searches: searches.map((s, j) =>
                  j === i ? { ...s, completed: !s.completed } : s,
                ),
              })
            }
            style={[styles.row, i < searches.length - 1 && styles.divider]}>
            <Text style={styles.rowLabel}>{item.search_type}</Text>
            <CheckBadge done={!!item.completed} />
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() =>
          editNote(
            'search_summary_note',
            'What the searches found',
            'e.g. no mortgages, liens, pending suits, or acquisition notices found on this parcel',
          )
        }>
        <Text style={check.search_summary_note ? styles.summaryNote : styles.summaryPlaceholder}>
          {check.search_summary_note || 'Tap to add what the searches found'}
        </Text>
      </Pressable>

      <SectionHeading>SELLER / CO-DEVELOPER RERA HISTORY</SectionHeading>
      <View style={styles.card}>
        {rera.length === 0 ? (
          <Text style={styles.emptyRow}>
            Add the seller's or co-developer's past MahaRERA projects.
          </Text>
        ) : (
          rera.map((entry, i) => (
            <Pressable
              key={i}
              onPress={() => editReraEntry(i)}
              style={[styles.row, styles.reraRow, styles.divider]}>
              <View style={styles.reraText}>
                <Text style={styles.reraName} numberOfLines={1}>
                  {entry.project_name}
                </Text>
                {entry.rera_registration_number ? (
                  <Text style={styles.reraNumber}>MahaRERA {entry.rera_registration_number}</Text>
                ) : null}
              </View>
              {entry.delivery_status ? (
                <View style={[styles.pill, styles.deliveryPill]}>
                  <Text style={[styles.pillText, styles.deliveryText]}>{entry.delivery_status}</Text>
                </View>
              ) : null}
            </Pressable>
          ))
        )}
        <AddLink label="Find seller on MahaRERA" onPress={() => setReraSearch(true)} />
        <AddLink label="Add past project by hand" onPress={() => editReraEntry(null)} />
      </View>
      <Pressable
        onPress={() =>
          editNote(
            'rera_history_summary_note',
            'Track record summary',
            'e.g. 3 of 3 past projects delivered · 1 delay, no unresolved disputes',
          )
        }>
        <Text
          style={check.rera_history_summary_note ? styles.summaryNote : styles.summaryPlaceholder}>
          {check.rera_history_summary_note || 'Tap to add a track record summary'}
        </Text>
      </Pressable>

      <SectionHeading>DOCUMENTS</SectionHeading>
      <View style={styles.card}>
        {documents.map((doc, i) => {
          const received = doc.status === 'received';
          return (
            <Pressable
              key={i}
              onPress={() =>
                save({
                  ...check,
                  documents: documents.map((d, j) =>
                    j === i ? { ...d, status: received ? 'pending' : 'received' } : d,
                  ),
                })
              }
              onLongPress={() =>
                save({ ...check, documents: documents.filter((_, j) => j !== i) })
              }
              style={[styles.row, styles.divider]}>
              <Text style={[styles.rowLabel, !received && styles.rowLabelPending]}>
                {doc.document_type}
              </Text>
              <CheckBadge done={received} />
            </Pressable>
          );
        })}
        <AddLink
          label="Add document"
          onPress={() =>
            setSheet({
              title: 'Add document',
              fields: [{ key: 'name', label: 'Document', placeholder: 'e.g. NA order' }],
              values: { name: '' },
              onSave: v =>
                save({
                  ...check,
                  documents: [...documents, { document_type: v.name, status: 'pending' }],
                }),
            })
          }
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>ⓘ</Text>
        <Text style={styles.infoText}>
          If the deal is a JDA: also check the landowner's own title, the registered
          Development Agreement + Power of Attorney, and that the landowner is disclosed as a
          co-promoter in the RERA registration. The JDA itself is a registered instrument — ~7%
          stamp + registration.
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!cleared && open.length > 0 ? (
        <Text style={styles.blockers}>To close the deal: {open.join(' · ')}</Text>
      ) : null}
      <Pressable
        style={[styles.ctaButton, ((!cleared && open.length > 0) || clearing) && styles.disabled]}
        disabled={(!cleared && open.length > 0) || clearing}
        onPress={closeDeal}>
        <Text style={styles.ctaButtonText}>
          {clearing
            ? 'Updating…'
            : cleared
              ? 'Deal Closed — Go to Approvals'
              : 'Deal Closed — Start Approvals'}
        </Text>
      </Pressable>

      {sheet ? <EditSheet sheet={sheet} onClose={() => setSheet(null)} /> : null}
      {reraSearch ? (
        <ReraSearchSheet
          onClose={() => setReraSearch(false)}
          onAdd={h => {
            // Merge by registration number so re-adding never duplicates a project.
            const known = new Set(rera.map(e => e.rera_registration_number));
            const added: ReraEntry[] = h.projects
              .filter(p => !known.has(p.registration_number))
              .map(p => ({
                project_name: p.project_name,
                rera_registration_number: p.registration_number,
                delivery_status: p.has_extension ? 'time extension granted' : 'no extension on record',
              }));
            save({
              ...check,
              rera_history: [...rera, ...added],
              rera_history_summary_note: reraSummary(h),
            });
          }}
        />
      ) : null}
      {riskEdit ? (
        <RiskSheet
          label={RISKS.find(r => r.key === riskEdit)!.label}
          risk={riskOf(check, riskEdit)}
          note={noteOf(check, riskEdit)}
          onClose={() => setRiskEdit(null)}
          onSave={(risk, note) =>
            save({ ...check, [`${riskEdit}_risk`]: risk, [`${riskEdit}_risk_note`]: note })
          }
        />
      ) : null}
    </ScrollView>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 10,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer },
  rowLabel: { fontSize: 14, color: colors.onSurface, flexShrink: 1 },
  rowLabelPending: { color: colors.onSurfaceVariant },
  emptyRow: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  pill: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10, flexShrink: 1 },
  pillText: { fontSize: 11, fontWeight: '700' },

  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.secondaryContainer },
  checkPending: { backgroundColor: colors.surfaceContainer },
  checkText: { fontSize: 11, fontWeight: '700' },
  checkTextDone: { color: colors.secondary },
  checkTextPending: { color: colors.onSurfaceVariant },

  chainCard: { paddingTop: 12 },
  chainRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  chainRail: { alignItems: 'center', width: 12 },
  chainDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.onSurface,
    backgroundColor: colors.surface,
    marginTop: 3,
  },
  chainDotFinal: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  chainLine: { flex: 1, width: 2, backgroundColor: colors.outlineVariant, marginVertical: 2 },
  chainText: { flex: 1, paddingBottom: 14, gap: 2 },
  chainFinalBox: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  chainTitle: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  chainTitleFinal: { color: colors.secondary },
  chainDescription: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },

  reraRow: { alignItems: 'flex-start' },
  reraText: { flex: 1, gap: 2 },
  reraName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  reraNumber: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  deliveryPill: { backgroundColor: colors.surfaceContainer, maxWidth: '55%' },
  deliveryText: { color: colors.onSurface },

  summaryNote: { fontSize: 11, color: colors.onSurfaceVariant, paddingHorizontal: 4 },
  summaryPlaceholder: { fontSize: 11, color: colors.outline, paddingHorizontal: 4 },

  matchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
    gap: 10,
  },
  matchName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.onSurface },
  matchCount: { fontSize: 12, color: colors.onSurfaceVariant },
  previewRow: { gap: 2, paddingVertical: 4 },
  addLink: { paddingVertical: 12, paddingHorizontal: 16 },
  addLinkText: { fontSize: 13, fontWeight: '600', color: colors.onSurface },

  infoCard: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    backgroundColor: colors.surfaceContainerLow,
  },
  infoIcon: { fontSize: 14, color: colors.onSurfaceVariant },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant },

  startCard: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  startTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  startText: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },

  blockers: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 8 },
  errorText: { fontSize: 12, color: colors.error, textAlign: 'center' },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  disabled: { opacity: 0.4 },
  ctaButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetDismiss: { flex: 1 },
  sheetScroll: {
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheet: {
    padding: 20,
    paddingBottom: 28,
    gap: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
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
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toggleLabel: { flex: 1, fontSize: 13, color: colors.onSurface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sheetSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetSecondaryText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  deleteText: { fontSize: 14, fontWeight: '600', color: colors.error },
  sheetPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetPrimaryText: { fontSize: 14, fontWeight: '700', color: colors.onPrimary },
});
