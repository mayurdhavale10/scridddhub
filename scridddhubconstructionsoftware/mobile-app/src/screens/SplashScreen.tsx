import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

// Screen 1 (Splash), ported from docs/design/screen1-splash-reference.html — the CSS keyframe
// spec for a physics-driven leaf tumble (2 deliberate "air pocket" stalls) followed by a
// wordmark entrance. Ported with the plain Animated API (not reanimated) using TWO separate
// driving Animated.Values, matching the CSS's own two separate `animation` declarations with
// two different timing functions:
//   .leaf-motion:     cubic-bezier(0.2, 0.9, 0.3, 1)   — extremely front-loaded (measured:
//                      ~40% done by 226ms, ~96% done by 1150ms of the 2100ms total)
//   .wordmark-motion: cubic-bezier(0.22, 1, 0.36, 1)   — a gentler ease-out
// Each driver is interpolated through the exact same percentage keyframe breakpoints as its
// CSS counterpart — this preserves both leaf stall beats (~26-32%, ~58-64%) rather than
// smoothing over them, and reproduces the reference's actual real-time rhythm (fast tumble,
// then a long static hold) rather than an evenly-paced approximation.
//
// Two disclosed simplifications, not silently dropped:
// 1. CSS translateZ/perspective depth mid-flight isn't reproduced (RN has no real Z-compositing)
//    — only the entry scale(0.92)/scale(0.98) cues from the original keyframes are kept.
// 2. The wordmark's CSS `filter: blur(4px)→0` dissolve is approximated with a scale(0.96→1) pop
//    instead of true blur — a native blur view isn't part of this build yet.
// The exact brand typeface (Plus Jakarta Sans 800) also isn't linked as a custom font yet; this
// uses the system bold weight at the same size/spacing as a stand-in.

type Props = {
  onFinish: () => void;
};

// Deliberately paced at 5x the reference's real 2100ms, not just for legibility but as an
// intentional brand-splash choice (per user direction) — same bezier curves, same rhythm,
// stretched over more real time so the tumble reads as a considered brand moment.
const DURATION_MS = 10500;
// The hold itself isn't scaled with the tumble — a typical splash holds the settled logo for
// under a second before moving on, not proportionally as long as a slowed-down entrance.
const HOLD_MS = 600;

// The last breakpoint (83 in the original CSS keyframes) marks when the leaf slides from its
// landing spot (dead center, keyframe 70) into its final "logo lockup" position clear of the
// wordmark (translateX -104, see leafTranslateX below). That's fine at the reference's real
// 2100ms pace, but this bezier's tail crawls very slowly in raw-progress terms — at the 5x-slowed
// 10500ms duration, the 70→83 gap stretches into several real seconds, during which the leaf just
// sits on top of the text. Pulled the breakpoint in to 72 (right next to the 70 landing point, the
// same window the wordmark's own snap uses) so the leaf clears the text immediately after landing
// instead of after a multi-second delay — a timing fix, not a speed change to the tumble itself.
const KEYFRAMES = [0, 6, 14, 20, 26, 32, 38, 46, 52, 58, 64, 70, 72, 100];

export function SplashScreen({ onFinish }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const wordmarkProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Native-driven: the earlier "invisible leaf" bug was actually the absolute-positioning
    // issue above, not a native-driver limitation — that assumption was wrong and cost a JS-
    // driven animation's per-frame bridge traffic for no reason, which reads as lag/jank over
    // a long duration. opacity/transform (translate, scale, rotateX/Y/Z, perspective) are all
    // native-driver-supported, so this runs on the UI thread instead of re-sending a recomputed
    // style every frame from JS.
    const leafAnim = Animated.timing(progress, {
      toValue: 100,
      duration: DURATION_MS,
      easing: Easing.bezier(0.2, 0.9, 0.3, 1),
      useNativeDriver: true,
    });
    const wordmarkAnim = Animated.timing(wordmarkProgress, {
      toValue: 100,
      duration: DURATION_MS,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    leafAnim.start();
    wordmarkAnim.start();
    const timer = setTimeout(onFinish, DURATION_MS + HOLD_MS);
    return () => {
      leafAnim.stop();
      wordmarkAnim.stop();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leafTranslateX = progress.interpolate({
    inputRange: KEYFRAMES,
    outputRange: [-14, -28, -52, -38, -32, -35, -10, 38, 46, 18, 0, 0, -104, -104],
  });
  const leafTranslateY = progress.interpolate({
    inputRange: KEYFRAMES,
    outputRange: [-450, -330, -240, -185, -165, -162, -125, -68, -32, -12, 0, 0, 0, 0],
  });
  const leafRotateX = progress.interpolate({
    inputRange: KEYFRAMES,
    outputRange: [
      '42deg', '32deg', '18deg', '-10deg', '-18deg', '-8deg', '36deg',
      '24deg', '-14deg', '-8deg', '4deg', '0deg', '0deg', '0deg',
    ],
  });
  const leafRotateY = progress.interpolate({
    inputRange: KEYFRAMES,
    outputRange: [
      '-58deg', '-48deg', '-22deg', '12deg', '6deg', '14deg', '62deg',
      '44deg', '-28deg', '-10deg', '-4deg', '0deg', '0deg', '0deg',
    ],
  });
  const leafRotateZ = progress.interpolate({
    inputRange: KEYFRAMES,
    outputRange: [
      '-24deg', '-16deg', '-28deg', '-12deg', '-8deg', '-4deg', '18deg',
      '22deg', '12deg', '2deg', '-1deg', '0deg', '0deg', '0deg',
    ],
  });
  const leafScale = progress.interpolate({
    inputRange: [0, 6, 14, 100],
    outputRange: [0.92, 0.98, 1, 1],
  });
  const leafOpacity = progress.interpolate({
    inputRange: [0, 6, 100],
    outputRange: [0, 1, 1],
  });

  // The reveal itself (opacity/translate/scale settling to final state) is deliberately snappy —
  // starts at the same 68% mark as before (right as the leaf lands) but finishes by 72% instead
  // of 86%, cutting the fade-in from ~1.9s down to ~420ms. Leaf timing/duration/hold are untouched.
  const wordmarkOpacity = wordmarkProgress.interpolate({
    inputRange: [0, 68, 72, 100],
    outputRange: [0, 0, 1, 1],
  });
  const wordmarkTranslateX = wordmarkProgress.interpolate({
    inputRange: [0, 68, 72, 100],
    outputRange: [74, 74, 34, 34],
  });
  const wordmarkScale = wordmarkProgress.interpolate({
    inputRange: [0, 68, 72, 100],
    outputRange: [0.96, 0.96, 1, 1],
  });

  return (
    <View style={styles.container}>
      {/* Each element gets its own full-bleed centering layer. CSS centers a position:absolute
          child of a flex container by default (an absolute-child-alignment rule Yoga/RN doesn't
          implement) — without this wrapper, leaf/wordmark's position:absolute would anchor to
          the screen's top-left corner (0,0) instead of center, and every translate offset below
          would be measured from the wrong origin. This wrapper makes "centered, transform: none"
          the natural rest state, exactly matching the CSS reference. */}
      <View style={styles.centerLayer} pointerEvents="none">
        <Animated.Image
          source={require('../assets/leaf.png')}
          style={[
            styles.leaf,
            {
              opacity: leafOpacity,
              transform: [
                { perspective: 1000 },
                { translateX: leafTranslateX },
                { translateY: leafTranslateY },
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
            {
              opacity: wordmarkOpacity,
              transform: [{ translateX: wordmarkTranslateX }, { scale: wordmarkScale }],
            },
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
