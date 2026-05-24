// Google-Assistant-style edge glow rendered with Skia. A blurred, stroked
// rounded rectangle is inset just outside the screen edges so the stroke
// sits exactly on the border. A four-color sweep gradient rotates around it
// (the same blue/red/yellow/green ring Assistant uses), and the whole layer
// fades in, pulses, and fades out on every trigger.

import {
  Canvas,
  Group,
  RoundedRect,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
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
const COLORS   = [G_BLUE, G_RED, G_YELLOW, G_GREEN, G_BLUE]; // last repeats for seamless wrap

const STROKE_WIDTH  = 38;   // thickness of the colored ring
const BLUR_RADIUS   = 26;   // softness — bigger = more bloom
const CORNER_RADIUS = 60;   // rounded corners on the glow ring

const TOTAL_MS = 4200;

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

  const opacity  = useSharedValue(0);
  const scale    = useSharedValue(0.96);
  const rotation = useSharedValue(0); // 0..1 → mapped to 0..2π for the sweep

  useEffect(() => {
    const onTrigger = () => {
      sizeRef.current = Dimensions.get('window');
      setVisible(true);

      // Reset
      opacity.value = 0;
      scale.value = 0.96;
      rotation.value = 0;

      // Continuous rotation while visible
      rotation.value = withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.linear }),
        -1,
        false
      );

      // Fade in → breathe twice → fade out
      opacity.value = withSequence(
        withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: TOTAL_MS - 380 - 700 }),
        withTiming(0, { duration: 700, easing: Easing.in(Easing.cubic) })
      );

      scale.value = withSequence(
        withTiming(1.02, { duration: 380, easing: Easing.out(Easing.cubic) }),
        withRepeat(
          withSequence(
            withTiming(0.985, { duration: 750, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.02,  { duration: 750, easing: Easing.inOut(Easing.sin) }),
          ),
          2,
          false
        ),
        withTiming(0.96, { duration: 700, easing: Easing.in(Easing.cubic) })
      );

      // Stop and hide
      setTimeout(() => {
        cancelAnimation(rotation);
        setVisible(false);
      }, TOTAL_MS + 100);
    };

    listeners.add(onTrigger);
    return () => {
      listeners.delete(onTrigger);
      cancelAnimation(rotation);
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [opacity, scale, rotation]);

  const animatedHostStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // Derived transform so Skia repaints per frame as `rotation` changes.
  const transform = useDerivedValue(() => [{ rotate: rotation.value * Math.PI * 2 }]);

  if (!visible) return null;

  const { width: W, height: H } = sizeRef.current;
  // Inset the ring so the stroke sits ON the screen edges (half the stroke
  // protrudes outside, half inside — this is what makes it look like the glow
  // is hugging the bezel).
  const inset = STROKE_WIDTH / 2;
  const rectX = inset;
  const rectY = inset;
  const rectW = W - inset * 2;
  const rectH = H - inset * 2;
  const center = vec(W / 2, H / 2);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedHostStyle]}>
      <View style={StyleSheet.absoluteFill}>
        <Canvas style={{ flex: 1 }}>
          <Group transform={transform} origin={center}>
            <RoundedRect
              x={rectX}
              y={rectY}
              width={rectW}
              height={rectH}
              r={CORNER_RADIUS}
              style="stroke"
              strokeWidth={STROKE_WIDTH}
            >
              <SweepGradient c={center} colors={COLORS} />
            </RoundedRect>
          </Group>
          {/* Soft outer bloom — second copy with bigger stroke, lower alpha */}
          <Group opacity={0.55} transform={transform} origin={center}>
            <RoundedRect
              x={rectX - 6}
              y={rectY - 6}
              width={rectW + 12}
              height={rectH + 12}
              r={CORNER_RADIUS + 6}
              style="stroke"
              strokeWidth={STROKE_WIDTH + BLUR_RADIUS}
            >
              <SweepGradient c={center} colors={COLORS} />
            </RoundedRect>
          </Group>
        </Canvas>
      </View>
    </Animated.View>
  );
}
