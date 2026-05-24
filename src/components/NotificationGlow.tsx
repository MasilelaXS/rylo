// Google-Assistant-style ambient glow: four large blurred colored blobs,
// one anchored at each corner, breathing softly out of phase. The blobs
// overlap along the edges so colors blend the way the Assistant ribbon does.
// Built on @shopify/react-native-skia (Circle + BlurMask) with Reanimated
// shared values driving radius + opacity per blob.

import { BlurMask, Canvas, Circle } from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// ─── Constants ───────────────────────────────────────────────────────────────
const G_BLUE   = '#4285F4';
const G_RED    = '#EA4335';
const G_YELLOW = '#FBBC04';
const G_GREEN  = '#34A853';

const TOTAL_MS    = 4200;
const BREATHE_MS  = 900;
const FADE_IN_MS  = 380;
const FADE_OUT_MS = 700;
const BLUR_SIGMA  = 60;

// ─── Event bus ───────────────────────────────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();

export function triggerNotificationGlow(): void {
  listeners.forEach((l) => { try { l(); } catch { /* ignore */ } });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function NotificationGlow() {
  const [visible, setVisible] = useState(false);
  const sizeRef = useRef(Dimensions.get('window'));

  // Master fade for the whole overlay
  const fade = useSharedValue(0);
  // Four breathing values, phase-offset so blobs don't pulse in unison
  const b0 = useSharedValue(0.7);
  const b1 = useSharedValue(0.95);
  const b2 = useSharedValue(0.75);
  const b3 = useSharedValue(0.9);

  useEffect(() => {
    const onTrigger = () => {
      sizeRef.current = Dimensions.get('window');
      setVisible(true);

      fade.value = 0;
      fade.value = withSequence(
        withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: TOTAL_MS - FADE_IN_MS - FADE_OUT_MS }),
        withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic) })
      );

      const breathe = (sv: typeof b0, low: number, high: number) => {
        sv.value = withRepeat(
          withSequence(
            withTiming(high, { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
            withTiming(low,  { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true
        );
      };
      breathe(b0, 0.70, 1.05);
      breathe(b1, 0.80, 1.10);
      breathe(b2, 0.65, 1.00);
      breathe(b3, 0.85, 1.15);

      setTimeout(() => {
        cancelAnimation(b0);
        cancelAnimation(b1);
        cancelAnimation(b2);
        cancelAnimation(b3);
        setVisible(false);
      }, TOTAL_MS + 100);
    };

    listeners.add(onTrigger);
    return () => {
      listeners.delete(onTrigger);
      cancelAnimation(fade);
      cancelAnimation(b0);
      cancelAnimation(b1);
      cancelAnimation(b2);
      cancelAnimation(b3);
    };
  }, [fade, b0, b1, b2, b3]);

  const { width: W, height: H } = sizeRef.current;
  // Base radius — large enough that the blob reaches the screen centre while
  // its core sits at the corner. ~55% of the screen diagonal works well.
  const baseR = Math.hypot(W, H) * 0.42;

  // Per-blob derived radius (base × breathing value × master fade)
  const r0 = useDerivedValue(() => baseR * b0.value * fade.value);
  const r1 = useDerivedValue(() => baseR * b1.value * fade.value);
  const r2 = useDerivedValue(() => baseR * b2.value * fade.value);
  const r3 = useDerivedValue(() => baseR * b3.value * fade.value);

  // Per-blob opacity (driven by master fade only — colors stay vivid)
  const op = useDerivedValue(() => 0.85 * fade.value);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={{ flex: 1 }}>
        {/* Top-left blue */}
        <Circle cx={0} cy={0} r={r0} color={G_BLUE} opacity={op}>
          <BlurMask blur={BLUR_SIGMA} style="normal" />
        </Circle>
        {/* Top-right red */}
        <Circle cx={W} cy={0} r={r1} color={G_RED} opacity={op}>
          <BlurMask blur={BLUR_SIGMA} style="normal" />
        </Circle>
        {/* Bottom-right yellow */}
        <Circle cx={W} cy={H} r={r2} color={G_YELLOW} opacity={op}>
          <BlurMask blur={BLUR_SIGMA} style="normal" />
        </Circle>
        {/* Bottom-left green */}
        <Circle cx={0} cy={H} r={r3} color={G_GREEN} opacity={op}>
          <BlurMask blur={BLUR_SIGMA} style="normal" />
        </Circle>
      </Canvas>
    </View>
  );
}
