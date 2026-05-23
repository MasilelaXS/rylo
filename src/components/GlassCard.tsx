import { GlassView } from 'expo-glass-effect';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { CARD_SHADOW, COLORS } from '../utils/constants';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Kept for API compatibility */
  intensity?: number;
  padding?: number;
}

export default function GlassCard({ children, style, padding = 16 }: Props) {
  return (
    <GlassView style={[styles.card, style]} glassEffectStyle="regular">
      <View style={{ padding }}>{children}</View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: {
    // Fallback background shown on Android / iOS < 26
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
});
