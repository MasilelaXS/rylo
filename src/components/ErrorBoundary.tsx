import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../utils/constants';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // In production you could send to a crash reporting service here
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  retry = () => this.setState({ hasError: false, message: '' });

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Text style={s.icon}>⚠️</Text>
          <Text style={s.title}>{this.props.fallbackTitle ?? 'Something went wrong'}</Text>
          <Text style={s.msg} numberOfLines={3}>{this.state.message}</Text>
          <TouchableOpacity style={s.btn} onPress={this.retry}>
            <Text style={s.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: COLORS.bg,
    gap: 12,
  },
  icon:  { fontSize: 48 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  msg:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  btn:   { marginTop: 8, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
