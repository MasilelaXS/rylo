// Encrypted backup/restore controls — drop into Settings.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { exportEncryptedBackup, importEncryptedBackup } from '../services/backupService';
import { CARD_SHADOW, COLORS } from '../utils/constants';

export default function BackupSection() {
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<null | 'export' | 'import'>(null);
  const [pass, setPass] = useState('');

  const run = async () => {
    if (!pass || pass.length < 6) {
      Alert.alert('Pick a passphrase', 'Use at least 6 characters. Without it, your backup cannot be restored.');
      return;
    }
    setBusy(true);
    try {
      if (show === 'export') {
        const path = await exportEncryptedBackup(pass);
        Alert.alert('Backup created', `Saved to ${path}`);
      } else if (show === 'import') {
        const { restored } = await importEncryptedBackup(pass);
        Alert.alert('Restore complete', `${restored} records restored. Reopen the app to refresh all views.`);
      }
      setShow(null);
      setPass('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Failed', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.group}>
      <TouchableOpacity style={s.row} onPress={() => setShow('export')}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Export encrypted backup</Text>
          <Text style={s.sub}>AES-encrypted file of all your data</Text>
        </View>
        <Ionicons name="cloud-upload-outline" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <View style={s.divider} />
      <TouchableOpacity style={s.row} onPress={() => setShow('import')}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Restore from backup</Text>
          <Text style={s.sub}>Replaces all current data</Text>
        </View>
        <Ionicons name="cloud-download-outline" size={18} color={COLORS.primary} />
      </TouchableOpacity>

      <Modal visible={show !== null} transparent animationType="fade" onRequestClose={() => setShow(null)}>
        <View style={s.scrim}>
          <View style={s.card}>
            <Text style={s.title}>{show === 'export' ? 'Choose passphrase' : 'Enter passphrase'}</Text>
            <Text style={s.cardSub}>This protects your backup file. Don&apos;t lose it — there is no recovery.</Text>
            <TextInput
              style={s.input}
              value={pass}
              onChangeText={setPass}
              placeholder="Passphrase"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoFocus
            />
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnSec]} onPress={() => { setShow(null); setPass(''); }} disabled={busy}>
                <Text style={s.btnSecText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnPri]} onPress={run} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPriText}>{show === 'export' ? 'Export' : 'Restore'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  group:   { backgroundColor: COLORS.card, borderRadius: 18, marginBottom: 24, ...CARD_SHADOW, overflow: 'hidden' },
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  divider: { height: 1, backgroundColor: COLORS.cardAlt, marginHorizontal: 16 },
  label:   { fontSize: 15, fontWeight: '500', color: COLORS.text },
  sub:     { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  scrim:   { flex: 1, backgroundColor: 'rgba(26,29,46,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:    { width: '100%', backgroundColor: COLORS.card, borderRadius: 22, padding: 22 },
  title:   { fontSize: 18, fontWeight: '800', color: COLORS.text },
  cardSub: { fontSize: 13, color: COLORS.textSub, marginTop: 6 },
  input:   { backgroundColor: COLORS.cardAlt, borderRadius: 14, padding: 14, marginTop: 14, fontSize: 15, color: COLORS.text },
  btnRow:  { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn:     { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnSec:  { backgroundColor: COLORS.cardAlt },
  btnPri:  { backgroundColor: COLORS.primary },
  btnSecText: { color: COLORS.textSub, fontWeight: '700' },
  btnPriText: { color: '#fff', fontWeight: '700' },
});
