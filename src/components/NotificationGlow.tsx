// Full-screen ambient glow overlay that pulses when a notification arrives.
// Triggered by `triggerNotificationGlow()` — registered listeners in
// _layout.tsx call this from expo-notifications received/response events.

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

// ─── Palettes ────────────────────────────────────────────────────────────────
// Each palette is 4 colors → 4 orbs (top-left, top-right, bottom-left, bottom-right)
const PALETTES: readonly (readonly [string, string, string, string])[] = [
  ['#FF6CAB', '#7366FF', '#00D4FF', '#FFC371'], // sunset aurora
  ['#00F5A0', '#00D9F5', '#7B61FF', '#FF61D2'], // neon dream
  ['#FFD86F', '#FC6262', '#A06EFF', '#5B8DEF'], // warm electric
  ['#56CCF2', '#2F80ED', '#9B51E0', '#EB5757'], // ocean fire
  ['#1DE9B6', '#00B0FF', '#FFAB40', '#FF4081'], // tropical
  ['#A8FF78', '#78FFD6', '#56CCF2', '#BB6BD9'], // mint dream
];

const pickPalette = () => PALETTES[Math.floor(Math.random() * PALETTES.length)];

// ─── Event bus (module-level listener registry) ──────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();

export function triggerNotificationGlow(): void {
  listeners.forEach((l) => {
    try { l(); } catch { /* ignore */ }
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function NotificationGlow() {
  const [palette, setPalette] = useState<readonly [string, string, string, string]>(() => pickPalette());
  const [visible, setVisible] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const pulse   = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const onTrigger = () => {
      setPalette(pickPalette());
      setVisible(true);

      opacity.setValue(0);
      pulse.setValue(0.85);

      Animated.sequence([
        // Fade in
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Three breathing pulses
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1.12,
              duration: 900,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(pulse, {
              toValue: 0.85,
              duration: 900,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          { iterations: 2 }
        ),
        // Fade out
        Animated.timing(opacity, {
          toValue: 0,
          duration: 800,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setVisible(false));
    };

    listeners.add(onTrigger);
    return () => { listeners.delete(onTrigger); };
  }, [opacity, pulse]);

  if (!visible) return null;

  const { width: W, height: H } = Dimensions.get('window');
  const orbSize = Math.max(W, H) * 0.95;

  // Four corner orbs. Each is a circular linear gradient (color → transparent).
  const orbs = [
    { top: -orbSize * 0.35, left:  -orbSize * 0.35, color: palette[0] },
    { top: -orbSize * 0.35, left:   W - orbSize * 0.65, color: palette[1] },
    { top:  H - orbSize * 0.65, left: -orbSize * 0.35, color: palette[2] },
    { top:  H - orbSize * 0.65, left:  W - orbSize * 0.65, color: palette[3] },
  ];

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.host, { opacity }]}>
      {orbs.map((o, i) => (
        <Animated.View
          key={i}
          style={[
            styles.orb,
            {
              width: orbSize,
              height: orbSize,
              borderRadius: orbSize / 2,
              top: o.top,
              left: o.left,
              transform: [{ scale: pulse }],
            },
          ]}
        >
          <LinearGradient
            colors={[o.color, `${o.color}00`]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>
      ))}
      {/* Soft inner vignette to keep content readable */}
      <View pointerEvents="none" style={styles.vignette} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    overflow: 'hidden',
    zIndex: 9999,
    elevation: 9999,
  },
  orb: {
    position: 'absolute',
    opacity: 0.85,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});
