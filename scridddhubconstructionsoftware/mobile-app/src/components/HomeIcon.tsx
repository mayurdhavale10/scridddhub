import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  color: string;
  // The door is a cut-out, so it's painted in whatever the icon sits on.
  backgroundColor: string;
};

// A filled house (roof, chimney, door) drawn with plain Views, so the app needs no icon or SVG
// library for one glyph. Roof is a border-triangle; everything scales from `size`.
export function HomeIcon({ size = 20, color, backgroundColor }: Props) {
  const roofH = size * 0.46;
  const bodyW = size * 0.72;
  const bodyH = size * 0.44;
  const doorW = size * 0.22;
  const doorH = size * 0.26;
  return (
    <View style={{ width: size, height: roofH + bodyH }}>
      <View
        style={[
          styles.abs,
          {
            left: size * 0.66,
            top: size * 0.06,
            width: size * 0.12,
            height: roofH * 0.7,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.roof,
          {
            borderLeftWidth: size / 2,
            borderRightWidth: size / 2,
            borderBottomWidth: roofH,
            borderBottomColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.body,
          {
            width: bodyW,
            height: bodyH,
            marginLeft: (size - bodyW) / 2,
            backgroundColor: color,
          },
        ]}
      >
        <View style={{ width: doorW, height: doorH, backgroundColor }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  roof: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  body: { alignItems: 'center', justifyContent: 'flex-end' },
});
