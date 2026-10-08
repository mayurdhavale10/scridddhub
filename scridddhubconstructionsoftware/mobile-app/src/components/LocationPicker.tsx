import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewProps,
} from 'react-native-webview';

// react-native-webview 14 types WebView as a class whose props resolve to `never` under this
// app's React 19 types (TS2769 on every prop). The component itself works; this alias restores
// the documented props.
const MapWebView = WebView as unknown as React.ComponentType<
  WebViewProps & { ref?: React.Ref<WebView> }
>;
import { api } from '../api/client';
import { colors } from '../theme/colors';

// Where the parcel actually is (docs/design/parcel-location-first-principles.md): land has no
// street address, so instead of guessing from text we ask the person who knows — drag a pin onto
// the plot, use GPS while standing on it, or paste a Google Maps link.
//
// Used when adding a parcel (the Location field, both tabs) and on a saved parcel's detail
// screen. It only picks a point; the caller decides what to do with it.

export type PinSource = 'pin' | 'gps' | 'maps_link';
export type Point = { lat: number; lng: number };

type Props = {
  title: string;
  // Where the pin starts: an existing pin, else our best guess for the typed location, else
  // the middle of Maharashtra.
  startPoint?: Point | null;
  startText?: string;
  confirmLabel: string;
  onBack: () => void;
  // Returns an error message to show, or nothing on success.
  onConfirm: (point: Point, source: PinSource) => Promise<string | void> | void;
};

type Source = PinSource;

// Free OpenStreetMap tiles (owner decision 2026-09-29). Their usage policy allows light use only,
// so this URL is the one thing to switch to a tile provider or our own tiles before launch.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAHARASHTRA_CENTRE: Point = { lat: 19.6, lng: 75.3 };

function mapHtml(start: Point, zoom: number): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0}</style>
</head><body><div id="map"></div><script>
  var map = L.map('map', { zoomControl: true }).setView([${start.lat}, ${start.lng}], ${zoom});
  L.tileLayer('${TILE_URL}', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  var marker = L.marker([${start.lat}, ${start.lng}], { draggable: true }).addTo(map);
  function report(source) {
    var p = marker.getLatLng();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin', lat: p.lat, lng: p.lng, source: source }));
  }
  marker.on('dragend', function () { report('pin'); });
  map.on('click', function (e) { marker.setLatLng(e.latlng); report('pin'); });
  // Called from the app when GPS or a pasted link supplies the point.
  window.setPin = function (lat, lng, zoom, source) {
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], zoom || map.getZoom());
    report(source);
  };
  window.locateMe = function () {
    navigator.geolocation.getCurrentPosition(
      function (pos) { window.setPin(pos.coords.latitude, pos.coords.longitude, 18, 'gps'); },
      function (err) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'gps_error', message: err.message })); },
      { enableHighAccuracy: true, timeout: 20000 }
    );
  };
  report('start');
</script></body></html>`;
}

export function LocationPicker({
  title,
  startPoint,
  startText,
  confirmLabel,
  onBack,
  onConfirm,
}: Props) {
  const web = useRef<WebView>(null);
  const [start, setStart] = useState<{ point: Point; zoom: number } | null>(
    null,
  );
  const [pin, setPin] = useState<Point | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<'gps' | 'link' | 'save' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Start where the parcel already is, else our best guess from its typed location, else the
  // middle of Maharashtra — the user moves the pin from there. Decided once, when the picker
  // opens, so later prop changes never move the map under the user's finger.
  useEffect(() => {
    (async () => {
      if (startPoint) {
        setStart({ point: startPoint, zoom: 17 });
        return;
      }
      const text = (startText ?? '').trim();
      if (text) {
        const { data: guess } = await api.GET('/reference/location-guess', {
          params: { query: { location: text } },
        });
        if (guess?.found && guess.latitude != null && guess.longitude != null) {
          setStart({
            point: { lat: guess.latitude, lng: guess.longitude },
            zoom: 15,
          });
          return;
        }
      }
      setStart({ point: MAHARASHTRA_CENTRE, zoom: 7 });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately once, on open
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    const msg = JSON.parse(e.nativeEvent.data);
    if (msg.type === 'pin') {
      setPin({ lat: msg.lat, lng: msg.lng });
      // 'start' is only our guess, so it doesn't count as the user having placed the pin.
      setSource(msg.source === 'start' ? null : msg.source);
      if (msg.source === 'gps') {
        setBusy(null);
      }
    } else if (msg.type === 'gps_error') {
      setBusy(null);
      setMessage(`Couldn't get your location: ${msg.message}`);
    }
  }, []);

  const useGps = useCallback(async () => {
    setMessage(null);
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        setMessage(
          'Location permission is needed to use your current position.',
        );
        return;
      }
    }
    setBusy('gps');
    web.current?.injectJavaScript('window.locateMe(); true;');
  }, []);

  const useLink = useCallback(async () => {
    setMessage(null);
    setBusy('link');
    const { data, error } = await api.GET('/reference/map-link', {
      params: { query: { url: link.trim() } },
    });
    setBusy(null);
    if (
      error ||
      !data?.found ||
      data.latitude == null ||
      data.longitude == null
    ) {
      setMessage(
        (error as { error?: string } | undefined)?.error ??
          "That link doesn't contain a location.",
      );
      return;
    }
    web.current?.injectJavaScript(
      `window.setPin(${data.latitude}, ${data.longitude}, 17, 'maps_link'); true;`,
    );
    setLink('');
  }, [link]);

  const save = useCallback(async () => {
    if (!pin || !source) {
      return;
    }
    setMessage(null);
    setBusy('save');
    const problem = await onConfirm(pin, source);
    setBusy(null);
    if (problem) {
      setMessage(problem);
    }
  }, [pin, source, onConfirm]);

  // Built once per screen: a new source object on every render (each pin move sets state) would
  // make the WebView reload the map and throw the pin back to where it started.
  const mapSource = useMemo(
    // baseUrl makes the inline page a secure (https) origin: WebView only allows
    // navigator.geolocation on secure origins ("Only secure origins are allowed" otherwise).
    () =>
      start
        ? {
            html: mapHtml(start.point, start.zoom),
            baseUrl: 'https://scridddhub.local/',
          }
        : undefined,
    [start],
  );

  if (!start) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>
          Drag the pin onto the land, or tap the map.
        </Text>
      </View>

      <MapWebView
        ref={web}
        style={styles.map}
        originWhitelist={['*']}
        source={mapSource}
        onMessage={onMessage}
        geolocationEnabled
        javaScriptEnabled
      />

      {/* Main way: the client, usually in an office far from the land, drags the pin onto the
          plot and confirms it. GPS only helps someone standing on the site, so it's a small
          secondary option — tapped by mistake in an office it would pin the office. */}
      <View style={styles.panel}>
        {pin && source ? (
          <Text style={styles.coords}>
            This is the land you pinned: {pin.lat.toFixed(5)},{' '}
            {pin.lng.toFixed(5)}
          </Text>
        ) : (
          <Text style={styles.coords}>
            Drag the pin onto the land, then confirm.
          </Text>
        )}

        {message ? <Text style={styles.errorText}>{message}</Text> : null}

        <Pressable
          style={[
            styles.ctaButton,
            (!source || busy !== null) && styles.disabled,
          ]}
          disabled={!source || busy !== null}
          onPress={save}
        >
          <Text style={styles.ctaButtonText}>
            {busy === 'save'
              ? 'Saving…'
              : source
              ? confirmLabel
              : 'Move the pin to the land first'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.textButton}
          disabled={busy !== null}
          onPress={useGps}
          hitSlop={8}
        >
          <Text style={styles.textButtonText}>
            {busy === 'gps'
              ? 'Finding your location…'
              : 'At the site right now? Use my current location'}
          </Text>
        </Pressable>

        <View style={styles.linkRow}>
          <TextInput
            style={styles.linkInput}
            value={link}
            onChangeText={setLink}
            placeholder="Paste a Google Maps link"
            placeholderTextColor={colors.onSurfaceVariant}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[
              styles.linkButton,
              (!link.trim() || busy !== null) && styles.disabled,
            ]}
            disabled={!link.trim() || busy !== null}
            onPress={useLink}
          >
            <Text style={styles.linkButtonText}>
              {busy === 'link' ? '…' : 'Use'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 4 },
  backLinkText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  hint: { fontSize: 13, color: colors.onSurfaceVariant },
  map: { flex: 1 },
  panel: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  textButton: { alignSelf: 'center', paddingVertical: 2 },
  textButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textDecorationLine: 'underline',
  },
  linkRow: { flexDirection: 'row', gap: 8 },
  linkInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.onSurface,
  },
  linkButton: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  linkButtonText: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  errorText: { fontSize: 13, color: colors.error },
  coords: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center' },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ctaButtonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
