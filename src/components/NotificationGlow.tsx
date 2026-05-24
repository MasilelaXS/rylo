// Google-Assistant-style ambient edge glow. A single stroked rounded-rect
// hugs the screen border, painted with a fixed SweepGradient (no rotation)
// so each corner naturally sits at one Google color. A BlurMask softens the
// stroke into a halo bleeding inward. A second wider, lower-opacity copy
// adds outer bloom. Opacity gently breathes while visible.

import {
  BlurMask,
  Canvas,
  Group,
  RoundedRect,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
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
// Colours are placed so each Google corner is at one screen corner.
// SweepGradient starts at 3-o'clock and goes clockwise:
//   right edge: blue→red, bottom: red→yellow, left: yellow→green, top: green→blue
const COLORS = [G_BLUE, G_RED, G_YELLOW, G_GREEN, G_BLUE];

const TOTAL_MS    = 4200;
const FADE_IN_MS  = 400;
const FADE_OUT_MS = 800;
const BREATHE_MS  = 1100;

const STROKE_WIDTH = 56;   // visible band thickness (half spills off-canvas)
const BLOOM_EXTRA  = 28;   // outer bloom adds this much extra stroke width
const BLUR_INNER   = 26;   // inward glow softness
const BLUR_OUTER   = 44;   // outer bloom softness
const CORNER_R     = 28;   // matches typical phone screen corner curvature

// ─── Event bus ───────────────────────────────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();

export function triggerNotificationGlow(): void {
  listeners.forEach((l) => { try { l(); } catch { /* ignore */ } });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function NotificationGlow() {
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const fade    = useSharedValue(0); // 0..1 master visibility
  const breathe = useSharedValue(1); // ~0.9..1.1 breathing multiplier

  useEffect(() => {
    const onTrigger = () => {
      setVisible(true);

      fade.value = 0;
      fade.value = withSequence(
        withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: TOTAL_MS - FADE_IN_MS - FADE_OUT_MS }),
        withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic) })
      );

      breathe.value = 1;
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.88, { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true
      );

      setTimeout(() => {
        cancelAnimation(breathe);
        setVisible(false);
      }, TOTAL_MS + 100);
    };

    listeners.add(onTrigger);
    return () => {
      listeners.delete(onTrigger);
      cancelAnimation(fade);
      cancelAnimation(breathe);
    };
  }, [fade, breathe]);

  const groupOpacity = useDerivedValue(() => fade.value * breathe.value);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  if (!visible || size.w === 0 || size.h === 0) {
    // Still mount the View so onLayout fires before the next trigger.
    return (
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        onLayout={onLayout}
      />
    );
  }

  const W = size.w;
  const H = size.h;
  const center = vec(W / 2, H / 2);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <Canvas style={{ flex: 1 }}>
        <Group opacity={groupOpacity}>
          {/* Outer bloom — wider, softer, lower alpha */}
          <Group opacity={0.55}>
            <RoundedRect
              x={0} y={0} width={W} height={H} r={CORNER_R}
              style="stroke" strokeWidth={STROKE_WIDTH + BLOOM_EXTRA}
            >
              <SweepGradient c={center} colors={COLORS} />
              <BlurMask blur={BLUR_OUTER} style="normal" />
            </RoundedRect>
          </Group>
          {/* Core edge ring */}
          <RoundedRect
            x={0} y={0} width={W} height={H} r={CORNER_R}
            style="stroke" strokeWidth={STROKE_WIDTH}
          >
            <SweepGradient c={center} colors={COLORS} />
            <BlurMask blur={BLUR_INNER} style="normal" />
          </RoundedRect>
        </Group>
      </Canvas>
    </View>
  );
}
