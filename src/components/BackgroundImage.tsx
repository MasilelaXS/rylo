import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../utils/constants';

interface Props {
  screen?: string;
  children: React.ReactNode;
}

export default function BackgroundImage({ children }: Props) {
  return <View style={styles.bg}>{children}</View>;
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
});
