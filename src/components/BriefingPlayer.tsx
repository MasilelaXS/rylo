// Voice-first briefing player — speaks morning/evening plan and review.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { buildEveningBriefing, buildMorningBriefing, speakBriefing } from '../services/briefingService';
import { useSettingsStore } from '../store/settingsStore';
import { useTaskStore } from '../store/taskStore';
import { CARD_SHADOW, COLORS } from '../utils/constants';
import { stopSpeaking } from '../voice/ttsService';

export type BriefingKind = 'morning' | 'evening';

interface Props { kind?: BriefingKind; }

export default function BriefingPlayer({ kind }: Props) {
  const { tasks } = useTaskStore();
  const { settings } = useSettingsStore();
  const [playing, setPlaying] = useState(false);

  const auto: BriefingKind = kind ?? (new Date().getHours() < 14 ? 'morning' : 'evening');

  const text = auto === 'morning'
    ? buildMorningBriefing(tasks, settings.userName)
    : buildEveningBriefing(tasks, settings.userName);

  useEffect(() => () => { stopSpeaking(); }, []);

  const toggle = () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
    } else {
      speakBriefing(text);
      setPlaying(true);
    }
  };

  return (
    <View style={s.card}>
      <View style={s.row}>
        <Ionicons name={auto === 'morning' ? 'sunny-outline' : 'moon-outline'} size={20} color={COLORS.primary} />
        <Text style={s.title}>{auto === 'morning' ? 'Morning briefing' : 'Evening review'}</Text>
        <TouchableOpacity style={[s.playBtn, playing && s.playBtnActive]} onPress={toggle}>
          <Ionicons name={playing ? 'stop' : 'play'} size={18} color={playing ? '#fff' : COLORS.primary} />
        </TouchableOpacity>
      </View>
      <Text style={s.text} numberOfLines={5}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 16, marginBottom: 12, ...CARD_SHADOW },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  playBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight },
  playBtnActive: { backgroundColor: COLORS.primary },
  text: { marginTop: 10, fontSize: 14, color: COLORS.textSub, lineHeight: 20 },
});
