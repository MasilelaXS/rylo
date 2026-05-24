// Google-Assistant-style edge glow. Four large blurred coloured blobs sit
// just outside each screen corner, but a <Mask> restricts visible pixels to
// a stroked rounded-rectangle band hugging the screen edges — so the colours
// only appear on the border, not across the whole screen.
//
// Built on @shopify/react-native-skia (Mask + Circle + BlurMask + RoundedRect).
// Animation: per-blob breathing radius via Reanimated shared values fed into
// Skia props through useDerivedValue.

import { BlurMask, Canvas, Circle, Group, Mask, RoundedRect } from '@shopify/react-native-skia';
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

const TOTAL_MS     = 4200;
const BREATHE_MS   = 900;
const FADE_IN_MS   = 380;
const FADE_OUT_MS  = 700;
const BLUR_SIGMA   = 50;   // softness of each blob
// The mask is a stroked rect centred on the screen edge — half the stroke is
// clipped off-screen, half is visible inside. So visible band ≈ BAND_WIDTH/2.
const BAND_WIDTH   = 160;  // total stroke width → ~80px visible band
const CORNER_R     = 0;    // sharp corners so the band reaches every pixel

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

  const fade = useSharedValue(0);
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
  // Blobs reach roughly to mid-screen so their bright cores sit at the corners
  // and they overlap along the edges (blend at edge midpoints).
  const baseR = Math.hypot(W, H) * 0.45;

  const r0 = useDerivedValue(() => baseR * b0.value);
  const r1 = useDerivedValue(() => baseR * b1.value);
  const r2 = useDerivedValue(() => baseR * b2.value);
  const r3 = useDerivedValue(() => baseR * b3.value);
  const op = useDerivedValue(() => fade.value);

  if (!visible) return null;

  // Position the mask path ON the screen edges (x=0, y=0, w=W, h=H). Because
  // strokes are centred on the path, half the stroke spills outside the canvas
  // (clipped) and half lies inside flush with the edge. Net result: the band
  // starts exactly at pixel 0 and extends inward by BAND_WIDTH/2.
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={{ flex: 1 }}>
        <Group opacity={op}>
          <Mask
            mode="alpha"
            mask={
              <Group>
                <RoundedRect
                  x={0}
                  y={0}
                  width={W}
                  height={H}
                  r={CORNER_R}
                  style="stroke"
                  strokeWidth={BAND_WIDTH}
                  color="white"
                />
              </Group>
            }
          >
            {/* Top-left blue */}
            <Circle cx={0} cy={0} r={r0} color={G_BLUE}>
              <BlurMask blur={BLUR_SIGMA} style="normal" />
            </Circle>
            {/* Top-right red */}
            <Circle cx={W} cy={0} r={r1} color={G_RED}>
              <BlurMask blur={BLUR_SIGMA} style="normal" />
            </Circle>
            {/* Bottom-right yellow */}
            <Circle cx={W} cy={H} r={r2} color={G_YELLOW}>
              <BlurMask blur={BLUR_SIGMA} style="normal" />
            </Circle>
            {/* Bottom-left green */}
            <Circle cx={0} cy={H} r={r3} color={G_GREEN}>
              <BlurMask blur={BLUR_SIGMA} style="normal" />
            </Circle>
          </Mask>
        </Group>
      </Canvas>
    </View>
  );
}
