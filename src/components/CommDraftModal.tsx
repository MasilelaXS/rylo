// Comm-draft modal — AI-drafts a message for a "tell X that Y" task, lets the
// user pick channel + recipient and fire it through the OS share/sms/mailto.

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { startCall } from '../services/callService';
import { copyDraft, generateDraft, saveDraft, sendDraft } from '../services/messagingService';
import type { CommDraft, Task } from '../types';
import { CARD_SHADOW, COLORS } from '../utils/constants';

const CHANNELS: { id: CommDraft['channel']; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'sms',      label: 'SMS',      icon: 'chatbox-outline' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { id: 'email',    label: 'Email',    icon: 'mail-outline' },
  { id: 'other',    label: 'Share',    icon: 'share-outline' },
];

export interface CommDraftModalProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onSent?: (draft: CommDraft) => void;
}

export default function CommDraftModal({ visible, task, onClose, onSent }: CommDraftModalProps) {
  const [channel, setChannel] = useState<CommDraft['channel']>('sms');
  const [recipient, setRecipient] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !task) return;
    setRecipient(task.communicationTarget ?? '');
    setBody('');
    setLoading(true);
    generateDraft(task, channel)
      .then((b) => setBody(b))
      .finally(() => setLoading(false));
  }, [visible, task?.id, channel]);

  const handleSend = async () => {
    if (!task) return;
    const d = await saveDraft(task.id, channel, recipient, body);
    await sendDraft(d);
    onSent?.(d);
    onClose();
  };

  const handleCall = async () => {
    if (!task) return;
    await startCall(task.id, recipient);
  };

  const handleCopy = async () => {
    await copyDraft(body);
  };

  const handleRegenerate = useCallback(async () => {
    if (!task || loading) return;
    setLoading(true);
    try {
      const b = await generateDraft(task, channel);
      setBody(b);
    } finally {
      setLoading(false);
    }
  }, [task, channel, loading]);

  if (!task) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Ionicons name="paper-plane-outline" size={20} color={COLORS.primary} />
            <Text style={s.title}>Draft message</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={COLORS.textMuted} /></TouchableOpacity>
          </View>
          <Text style={s.taskTitle} numberOfLines={2}>{task.title}</Text>

          <View style={s.chRow}>
            {CHANNELS.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[s.chBtn, channel === c.id && s.chBtnActive]}
                onPress={() => setChannel(c.id)}
              >
                <Ionicons name={c.icon} size={16} color={channel === c.id ? '#fff' : COLORS.primary} />
                <Text style={[s.chText, channel === c.id && s.chTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Recipient</Text>
          <TextInput
            style={s.input}
            value={recipient}
            onChangeText={setRecipient}
            placeholder={channel === 'email' ? 'name@example.com' : 'Phone or contact'}
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            keyboardType={channel === 'email' ? 'email-address' : 'default'}
          />

          <Text style={s.label}>Message</Text>
          <View style={{ position: 'relative' }}>
            {loading && (
              <View style={s.loadingOverlay}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={s.loadingText}>Drafting…</Text>
              </View>
            )}
            <TextInput
              style={[s.input, s.bodyInput]}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={6}
              placeholder="The AI will draft something here."
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 12 }}>
            <TouchableOpacity style={s.actionPill} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
              <Text style={s.actionPillText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionPill} onPress={handleRegenerate} disabled={loading}>
              <Ionicons name="refresh" size={16} color={COLORS.primary} />
              <Text style={s.actionPillText}>Regenerate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionPill} onPress={handleCall}>
              <Ionicons name="call-outline" size={16} color={COLORS.primary} />
              <Text style={s.actionPillText}>Call instead</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity style={s.sendBtn} onPress={handleSend} disabled={!body.trim()}>
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={s.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,29,46,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, ...CARD_SHADOW, maxHeight: '92%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.text },
  taskTitle: { fontSize: 14, color: COLORS.textSub, marginTop: 6 },
  chRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  chBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primaryLight },
  chBtnActive: { backgroundColor: COLORS.primary },
  chText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  chTextActive: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSub, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: COLORS.cardAlt, borderRadius: 14, padding: 14, fontSize: 15, color: COLORS.text },
  bodyInput: { minHeight: 120, textAlignVertical: 'top' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, zIndex: 2, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14 },
  loadingText: { color: COLORS.textSub, fontSize: 13 },
  actionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primaryLight },
  actionPillText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  sendBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, marginTop: 6 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
