import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { components } from '@scridddhub/api-client';
import { api } from '../api/client';
import { colors } from '../theme/colors';

type Result = components['schemas']['NearbyRegisteredTransactions'];
function money(value: number): string {
  return value >= 10000000
    ? `₹${(value / 10000000).toFixed(2)} Cr`
    : `₹${(value / 100000).toFixed(2)} lakh`;
}

export function NearbyRegisteredTransactions({
  parcelID,
}: {
  parcelID: string;
}) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setData(null);
    setExpanded(false);
    (async () => {
      try {
        const result = await api.GET(
          '/land-parcels/{parcelID}/registered-transactions',
          {
            params: { path: { parcelID } },
          },
        );
        if (!cancelled) {
          setData(result.data ?? null);
          if (result.data?.coverage?.status === 'searching') {
            timer = setTimeout(() => setAttempt(n => n + 1), 5000);
          }
        }
      } catch {
        /* Request failures are separate from an empty search result. */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [parcelID, attempt]);

  if (loading) return <ActivityIndicator />;
  if (!data)
    return (
      <View>
        <Text>Could not load registered sales.</Text>
        <Pressable onPress={() => setAttempt(n => n + 1)}>
          <Text style={s.link}>Retry</Text>
        </Pressable>
      </View>
    );
  const where =
    data.match_basis === 'distance' ? 'within 3 km' : 'in the same village';
  const coverage = data.coverage;
  const complete = coverage?.status === 'searched';
  const visible = expanded ? data.items : data.items.slice(0, 5);
  return (
    <View style={s.container}>
      {data.match_basis !== 'unresolved' && (
        <>
          <Text style={s.summary}>
            {data.count > 0
              ? `${data.count} recorded land/plot sale${
                  data.count === 1 ? '' : 's'
                } ${where} in the last ${data.months} months`
              : complete
              ? `No registered land sales found ${where} in the last ${data.months} months.`
              : `No registered land sales on record ${where} yet.`}
            {data.median_rate_per_acre != null &&
              ` · Typical rate ${money(
                data.median_rate_per_acre,
              )}/acre (range ${money(data.min_rate_per_acre!)}–${money(
                data.max_rate_per_acre!,
              )})`}
          </Text>
          {/* The widening only means something when there are sales to show. */}
          {data.months === 12 && data.count > 0 && (
            <Text style={s.note}>
              Includes the last 12 months: fewer than 3 sales in 6 months.
            </Text>
          )}
          {data.count > 0 && data.count < 3 && (
            <Text style={s.note}>Too few sales to judge the area's value.</Text>
          )}
        </>
      )}
      {/* Collector/coverage internals stay in the API response (owner, 2026-10-01: keep internal
          details off the screen); only an active search is worth telling the user about. */}
      {coverage?.status === 'searching' && (
        <Text style={s.note}>Searching registration records…</Text>
      )}
      {visible.map(item => (
        // Tapping a sale opens its official record, like a planned project; no per-item source
        // line (same rule as Planned Infrastructure).
        <Pressable
          key={item.id}
          style={s.sale}
          accessibilityRole="link"
          onPress={() => {
            Linking.openURL(item.source_url).catch(() => {});
          }}
        >
          <Text>
            {new Date(item.registration_date).toLocaleDateString('en-IN')} ·{' '}
            {item.area_acres.toLocaleString('en-IN', {
              maximumFractionDigits: 3,
            })}{' '}
            acres
          </Text>
          <Text>
            {money(item.sale_price_rupees)} · {money(item.rate_per_acre)}/acre
          </Text>
          <Text style={s.note}>
            {item.distance_km == null
              ? 'Same village; parcel distance unknown'
              : `${
                  item.location_method === 'survey_centre' ? 'Approx. ' : ''
                }${item.distance_km.toFixed(2)} km away`}
          </Text>
        </Pressable>
      ))}
      {data.items.length > 5 && (
        <Pressable onPress={() => setExpanded(!expanded)}>
          <Text style={s.link}>
            {expanded ? 'Show fewer' : `See all ${data.count} sales`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 8 },
  summary: { fontWeight: '600' },
  note: { color: colors.onSurfaceVariant, fontSize: 12 },
  sale: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    gap: 3,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
    paddingVertical: 4,
  },
});
