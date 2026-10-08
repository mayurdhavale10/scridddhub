import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';
import { LocationPicker, type Point } from '../components/LocationPicker';

// Pin (or move the pin of) a parcel that's already saved — for parcels added before the Location
// field had a pin, and for fixing a wrong one. New parcels are pinned while being added.

type Props = {
  parcelId: string;
  onBack: () => void;
  onSaved: () => void;
};

type Loaded = { name: string; text: string; point: Point | null };

export function PinLocationScreen({ parcelId, onBack, onSaved }: Props) {
  const [parcel, setParcel] = useState<Loaded | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.GET('/land-parcels/{id}', {
        params: { path: { id: parcelId } },
      });
      setParcel({
        name: data?.name ?? '',
        text: data?.location || data?.village || '',
        point:
          data?.latitude != null && data.longitude != null
            ? { lat: data.latitude, lng: data.longitude }
            : null,
      });
    })();
  }, [parcelId]);

  if (!parcel) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <LocationPicker
      title={`Where is ${parcel.name || 'this parcel'}?`}
      startPoint={parcel.point}
      startText={parcel.text}
      confirmLabel="Confirm this location"
      onBack={onBack}
      onConfirm={async (point, source) => {
        const { error } = await api.PUT('/land-parcels/{id}/location', {
          params: { path: { id: parcelId } },
          body: {
            latitude: point.lat,
            longitude: point.lng,
            location_source: source,
          },
        });
        if (error) {
          return (
            (error as { error?: string }).error ??
            'Could not save the location.'
          );
        }
        onSaved();
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
