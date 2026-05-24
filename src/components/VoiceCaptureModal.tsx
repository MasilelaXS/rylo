// Voice capture modal — records audio, lets the user review/edit the transcript,
// extracts actionable tasks via AI, and stores both.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ExtractedTask } from '../services/aiService';
import { ensurePermission, isTranscriptionAvailable, saveTranscript, startRecording, stopRecording, transcribeAudio } from '../services/voiceCaptureService';
import { useTaskStore } from '../store/taskStore';
import { CARD_SHADOW, COLORS } from '../utils/constants';

export interface VoiceCaptureModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function VoiceCaptureModal({ visible, onClose }: VoiceCaptureModalProps) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing' | 'review' | 'saving' | 'done'>('idle');
  const [transcript, setTranscript] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [extracted, setExtracted] = useState<ExtractedTask[]>([]);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const reload = useTaskStore((s) => s.loadAll);

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      setTranscript('');
      setAudioUri(null);
      setDurationMs(0);
      setExtracted([]);
      setTranscribeError(null);
    }
  }, [visible]);

  const handleStart = async () => {
    const ok = await ensurePermission();
    if (!ok) return;
    await startRecording();
    setPhase('recording');
  };

  const handleStop = async () => {
    const { uri, durationMs } = await stopRecording();
    setAudioUri(uri);
    setDurationMs(durationMs);
    if (uri && isTranscriptionAvailable()) {
      setPhase('transcribing');
      setTranscribeError(null);
      try {
        const text = await transcribeAudio(uri);
        setTranscript(text);
      } catch (e: any) {
        setTranscribeError(e?.message ?? 'Transcription failed');
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
              <View style={[s.pulse]} />
              <Text style={s.sub}>Listening…</Text>
              <TouchableOpacity style={[s.recBtn, { backgroundColor: COLORS.danger }]} onPress={handleStop}>
                <Ionicons name="stop" size={22} color="#fff" />
                <Text style={s.recBtnText}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'transcribing' && (
            <View style={s.center}>
              <View style={[s.pulse, { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary }]} />
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
  pulse: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.dangerLight, borderWidth: 6, borderColor: COLORS.danger },
  recBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 999 },
  recBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  input: { backgroundColor: COLORS.cardAlt, borderRadius: 14, padding: 14, fontSize: 15, color: COLORS.text, textAlignVertical: 'top' },
  primaryBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 14, marginTop: 16 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomColor: COLORS.cardAlt, borderBottomWidth: 1 },
  taskTitle: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
