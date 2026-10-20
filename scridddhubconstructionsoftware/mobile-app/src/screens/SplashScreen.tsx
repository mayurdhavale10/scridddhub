import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

// Screen 1 (Splash): a leaf falls the way a real one does, then the wordmark settles beside it.
//
// A falling leaf doesn't drop straight or jump between poses: it swings like a pendulum, tilting
// into each swing, gliding and lifting a little at the end of each one, and the swings die down
// until it lands softly. That motion is computed here as smooth functions of time and sampled
// into many points (FALL_SAMPLES), so every frame is on the curve. (The first version jumped
// between 14 fixed poses in straight lines, which showed as kinks, and was stretched to 10.5 s.)
// One linear clock drives everything on the native driver, so it runs on the UI thread.

type Props = {
  onFinish: () => void;
};

const FALL_MS = 3600; // the fall itself; a real leaf crosses a phone-height in roughly 3–4 s
const SLIDE_MS = 600; // landed leaf glides into the logo position as the wordmark appears
const HOLD_MS = 700; // settled logo, then on to the app
const TOTAL_MS = FALL_MS + SLIDE_MS + HOLD_MS;
const FALL_SAMPLES = 90; // points per curve; enough that the path reads as continuous

// The fall's shape.
const DROP = 430; // starts this far above its landing spot (px)
const SWAY = 72; // widest side-to-side swing (px), shrinking to 0 at landing
const SWINGS = 2.5; // swings during the fall
const LIFT = 26; // how much it glides up at the end of each swing (px)
const TILT = 28; // tilt into the swing (deg)
const LOGO_X = -104; // where the leaf rests in the logo, left of the wordmark

const fallInput: number[] = [];
const fall = { x: [] as number[], y: [] as number[], rz: [] as string[], ry: [] as string[], rx: [] as string[] };
for (let i = 0; i <= FALL_SAMPLES; i++) {
  const u = i / FALL_SAMPLES; // 0 → 1 over the fall
  // Swings shrink to nothing; the 1.5 power makes them fade with zero speed at landing, so the
  // leaf settles instead of stopping dead.
  const env = Math.pow(1 - u, 1.5);
  const phase = 2 * Math.PI * SWINGS * u - Math.PI / 2; // starts at the left end of a swing
  const swing = Math.sin(phase);
  // Descends at a nearly steady rate (it reaches its slow terminal speed at once), easing off
  // just before the ground, and lifts slightly at each end of a swing as it glides.
  const descent = 1 - Math.pow(1 - u, 1.25);
  fallInput.push(u * FALL_MS);
  fall.x.push(SWAY * env * swing);
  fall.y.push(-DROP * (1 - descent) - LIFT * env * swing * swing);
  // Tilts toward the way it's moving (the swing's velocity), and turns over a little as it rocks.
  fall.rz.push(`${(TILT * env * Math.cos(phase)).toFixed(2)}deg`);
  fall.ry.push(`${(34 * env * Math.sin(2 * phase)).toFixed(2)}deg`);
  fall.rx.push(`${(16 * env * Math.cos(phase)).toFixed(2)}deg`);
}

// After landing: glide into the logo position with a gentle ease-out, then hold.
const SLIDE_SAMPLES = 20;
const slideInput: number[] = [];
const slideX: number[] = [];
for (let i = 1; i <= SLIDE_SAMPLES; i++) {
  const v = i / SLIDE_SAMPLES;
  const eased = 1 - Math.pow(1 - v, 3);
  slideInput.push(FALL_MS + v * SLIDE_MS);
  slideX.push(LOGO_X * eased);
}

const holdAt = <T,>(values: T[], last: T) => [...values, last];
const IN_FALL = [...fallInput, TOTAL_MS];
const IN_ALL = [...fallInput, ...slideInput, TOTAL_MS];

export function SplashScreen({ onFinish }: Props) {
  const clock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(clock, {
      toValue: TOTAL_MS,
      duration: TOTAL_MS,
      easing: Easing.linear, // the curves above carry the motion; the clock just ticks
      useNativeDriver: true,
    });
    anim.start(({ finished }) => finished && onFinish());
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leafX = clock.interpolate({ inputRange: IN_ALL, outputRange: [...fall.x, ...slideX, LOGO_X] });
  const leafY = clock.interpolate({ inputRange: IN_FALL, outputRange: holdAt(fall.y, 0) });
  const leafRotateZ = clock.interpolate({ inputRange: IN_FALL, outputRange: holdAt(fall.rz, '0deg') });
  const leafRotateY = clock.interpolate({ inputRange: IN_FALL, outputRange: holdAt(fall.ry, '0deg') });
  const leafRotateX = clock.interpolate({ inputRange: IN_FALL, outputRange: holdAt(fall.rx, '0deg') });
  const leafOpacity = clock.interpolate({ inputRange: [0, 260, TOTAL_MS], outputRange: [0, 1, 1] });
  const leafScale = clock.interpolate({ inputRange: [0, FALL_MS * 0.2, TOTAL_MS], outputRange: [0.94, 1, 1] });

  // The wordmark fades and slides in as the leaf glides aside, on an ease-out.
  const reveal = [FALL_MS + 80, FALL_MS + 260, FALL_MS + 460, FALL_MS + SLIDE_MS, TOTAL_MS];
  const wordmarkOpacity = clock.interpolate({ inputRange: [0, ...reveal], outputRange: [0, 0, 0.6, 0.92, 1, 1] });
  const wordmarkX = clock.interpolate({ inputRange: [0, ...reveal], outputRange: [74, 74, 48, 37, 34, 34] });
  const wordmarkScale = clock.interpolate({ inputRange: [0, ...reveal], outputRange: [0.96, 0.96, 0.985, 0.997, 1, 1] });

  return (
    <View style={styles.container}>
      {/* Each element gets its own full-bleed centering layer, so "centered, no transform" is the
          rest state and every translate is measured from the screen's centre (RN doesn't centre
          absolutely positioned children the way CSS does). */}
      <View style={styles.centerLayer} pointerEvents="none">
        <Animated.Image
          source={require('../assets/leaf.png')}
          style={[
            styles.leaf,
            {
              opacity: leafOpacity,
              transform: [
                { perspective: 1000 },
                { translateX: leafX },
                { translateY: leafY },
                { rotateX: leafRotateX },
                { rotateY: leafRotateY },
                { rotateZ: leafRotateZ },
                { scale: leafScale },
              ],
            },
          ]}
        />
      </View>
      <View style={styles.centerLayer} pointerEvents="none">
        <Animated.Text
          style={[
            styles.wordmark,
            { opacity: wordmarkOpacity, transform: [{ translateX: wordmarkX }, { scale: wordmarkScale }] },
          ]}>
          ScridddHub
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centerLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaf: {
    width: 64,
    height: 64,
  },
  wordmark: {
    fontSize: 40,
    fontWeight: '800',
    color: '#2E7D32',
    letterSpacing: -1.2,
  },
});
