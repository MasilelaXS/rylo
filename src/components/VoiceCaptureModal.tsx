// Voice capture modal — records audio, lets the user review/edit the transcript,
// extracts actionable tasks via AI, and stores both.

import { Ionicons } from '@expo/vector-icons';
import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import type { ExtractedTask } from '../services/aiService';
import { isTranscriptionAvailable, saveTranscript, transcribeAudio } from '../services/voiceCaptureService';
import { useTaskStore } from '../store/taskStore';
import { CARD_SHADOW, COLORS } from '../utils/constants';

export interface VoiceCaptureModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatSecs(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const sec = (total % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

const BAR_MAX_HEIGHTS = [10, 20, 32, 44, 32, 20, 10];
const BAR_DURATIONS   = [500, 380, 310, 260, 310, 380, 500];

function WaveformBar({ maxH, duration, delay }: { maxH: number; duration: number; delay: number }) {
  const h = useSharedValue(4);
  useEffect(() => {
    h.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(maxH, { duration }), withTiming(4, { duration })),
        -1,
      ),
    );
    return () => cancelAnimation(h);
  }, [maxH, duration, delay]);
  const animStyle = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[s.waveBar, animStyle]} />;
}

function PulseDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.55, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
    );
    return () => { cancelAnimation(scale); cancelAnimation(opacity); };
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return <Animated.View style={[s.pulseDot, animStyle]} />;
}

export default function VoiceCaptureModal({ visible, onClose }: VoiceCaptureModalProps) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing' | 'review' | 'saving' | 'done'>('idle');
  const [transcript, setTranscript] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [extracted, setExtracted] = useState<ExtractedTask[]>([]);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const reload = useTaskStore((s) => s.loadAll);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recordingSecs, setRecordingSecs] = useState(0);

  useEffect(() => {
    if (!visible) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setPhase('idle');
      setTranscript('');
      setAudioUri(null);
      setDurationMs(0);
      setExtracted([]);
      setTranscribeError(null);
      setRecordingSecs(0);
    }
  }, [visible]);

  const handleStart = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setTranscribeError('Microphone permission denied.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
      setRecordingSecs(0);
      timerRef.current = setInterval(() => setRecordingSecs(p => p + 1), 1000);
      setPhase('recording');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTranscribeError(msg || 'Could not start recording.');
    }
  };

  const handleStop = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    let uri: string | null = null;
    let duration = 0;
    try {
      await recorder.stop();
      uri = recorder.uri;
      duration = Date.now() - startedAtRef.current;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTranscribeError(msg || 'Could not stop recording.');
    }
    setAudioUri(uri);
    setDurationMs(duration);

    if (uri && isTranscriptionAvailable()) {
      setPhase('transcribing');
      setTranscribeError(null);
      try {
        const text = await transcribeAudio(uri);
        setTranscript(text);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setTranscribeError(msg || 'Transcription failed');
      }
      setPhase('review');
    } else {
      if (!isTranscriptionAvailable()) {
        setTranscribeError('Add EXPO_PUBLIC_GROQ_API_KEY in your .env to auto-transcribe.');
      }
      setPhase('review');
    }
  };

  const handleSave = async () => {
    setPhase('saving');
    const res = await saveTranscript(transcript, audioUri, durationMs);
    setExtracted(res.extracted);
    await reload();
    setPhase('done');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Ionicons name="mic" size={20} color={COLORS.primary} />
            <Text style={s.title}>Voice note</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={COLORS.textMuted} /></TouchableOpacity>
          </View>

          {phase === 'idle' && (
            <View style={s.center}>
              <Text style={s.sub}>Record a thought. We&apos;ll pull tasks out automatically.</Text>
              <TouchableOpacity style={s.recBtn} onPress={handleStart}>
                <Ionicons name="mic" size={28} color="#fff" />
                <Text style={s.recBtnText}>Start recording</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'recording' && (
            <View style={s.center}>
              <View style={s.waveContainer}>
                {BAR_MAX_HEIGHTS.map((maxH, i) => (
                  <WaveformBar key={i} maxH={maxH} duration={BAR_DURATIONS[i]} delay={i * 70} />
                ))}
              </View>
              <View style={s.recordingMeta}>
                <PulseDot />
                <Text style={s.recordingTime}>{formatSecs(recordingSecs)}</Text>
              </View>
              <Text style={s.sub}>Listening…</Text>
              <TouchableOpacity style={[s.recBtn, { backgroundColor: COLORS.danger }]} onPress={handleStop}>
                <Ionicons name="stop" size={22} color="#fff" />
                <Text style={s.recBtnText}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'transcribing' && (
            <View style={s.center}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={s.sub}>Transcribing…</Text>
            </View>
          )}

          {phase === 'review' && (
            <View>
              <Text style={s.label}>Transcript</Text>
              {transcribeError && (
                <Text style={[s.sub, { color: COLORS.danger, marginBottom: 6 }]}>{transcribeError}</Text>
              )}
              <TextInput
                style={[s.input, { minHeight: 140 }]}
                value={transcript}
                onChangeText={setTranscript}
                placeholder="What did you say?"
                placeholderTextColor={COLORS.textMuted}
                multiline
                autoFocus
              />
              <TouchableOpacity style={s.primaryBtn} onPress={handleSave} disabled={!transcript.trim()}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={s.primaryBtnText}>Save & extract tasks</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'saving' && (
            <View style={s.center}>
              <Text style={s.sub}>Saving & extracting tasks…</Text>
            </View>
          )}

          {phase === 'done' && (
            <View>
              <Text style={s.label}>Captured {extracted.length} task{extracted.length === 1 ? '' : 's'}</Text>
              <ScrollView style={{ maxHeight: 220 }}>
                {extracted.length === 0 ? (
                  <Text style={s.sub}>No actionable items found. Saved as a voice note.</Text>
                ) : extracted.map((t, i) => (
                  <View key={i} style={s.taskRow}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.primary} />
                    <Text style={s.taskTitle} numberOfLines={2}>{t.title}</Text>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={s.primaryBtn} onPress={onClose}>
                <Text style={s.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,29,46,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, ...CARD_SHADOW, minHeight: 360 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.text },
  center: { alignItems: 'center', paddingVertical: 26, gap: 18 },
  sub: { fontSize: 14, color: COLORS.textSub, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textSub, marginTop: 8, marginBottom: 6 },
  waveContainer: { flexDirection: 'row', alignItems: 'center', height: 68 },
  waveBar: { width: 5, borderRadius: 3, backgroundColor: COLORS.danger, marginHorizontal: 3 },
  recordingMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordingTime: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: 2 },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.danger },
  recBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 999 },
  recBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  input: { backgroundColor: COLORS.cardAlt, borderRadius: 14, padding: 14, fontSize: 15, color: COLORS.text, textAlignVertical: 'top' },
  primaryBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 14, marginTop: 16 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomColor: COLORS.cardAlt, borderBottomWidth: 1 },
  taskTitle: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
