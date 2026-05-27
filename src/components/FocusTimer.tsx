import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import { COLORS } from '../utils/constants';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

const WORK_MINUTES   = 25;
const BREAK_MINUTES  = 5;
const LONG_BREAK_MIN = 15;

interface Props {
  visible: boolean;
  onClose: () => void;
  taskTitle?: string;
  estimatedMinutes?: number;
  onSessionComplete?: (minutes: number) => void;
}

type Phase = 'work' | 'break' | 'longBreak';

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function FocusTimer({ visible, onClose, taskTitle, estimatedMinutes, onSessionComplete }: Props) {
  const workMins   = estimatedMinutes && estimatedMinutes > 0 ? Math.min(estimatedMinutes, 60) : WORK_MINUTES;
  const totalSecs  = (phase: Phase) => {
    if (phase === 'work')      return workMins * 60;
    if (phase === 'break')     return BREAK_MINUTES * 60;
    return LONG_BREAK_MIN * 60;
  };

  const [phase,     setPhase]     = useState<Phase>('work');
  const [seconds,   setSeconds]   = useState(totalSecs('work'));
  const [running,   setRunning]   = useState(false);
  const [sessions,  setSessions]  = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  }, []);

  const notifyDone = useCallback((finishedPhase: Phase) => {
    Vibration.vibrate([0, 300, 200, 300]);
    if (IS_EXPO_GO) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      Notifications.scheduleNotificationAsync({
        content: {
          title: finishedPhase === 'work' ? '⏱ Focus session complete!' : '☕ Break over!',
          body: finishedPhase === 'work'
            ? `Great work on "${taskTitle ?? 'your task'}"! Take a break.`
            : 'Ready to focus again?',
          sound: true,
        },
        trigger: null,
      }).catch(() => {});
    } catch { /* notifications not available */ }
  }, [taskTitle]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const id = setInterval(() => {
      if (cancelled) return;
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(id);
          intervalRef.current = null;
          setRunning(false);

          // Advance phase
          setPhase((p) => {
            // Use functional update so we don't read a stale `sessions`.
            let nextSessionsLocal = 0;
            setSessions((curr) => {
              nextSessionsLocal = p === 'work' ? curr + 1 : curr;
              return nextSessionsLocal;
            });
            notifyDone(p);
            if (p === 'work' && onSessionComplete) {
              onSessionComplete(workMins);
            }
            const next: Phase = p === 'work'
              ? (nextSessionsLocal % 4 === 0 ? 'longBreak' : 'break')
              : 'work';
            setSeconds(totalSecs(next));
            return next;
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    intervalRef.current = id;
    return () => {
      cancelled = true;
      clearInterval(id);
      intervalRef.current = null;
    };
    // notifyDone/totalSecs are stable enough; we only want this to (re)start when `running` toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const handleReset = () => {
    stop();
    setSeconds(totalSecs(phase));
  };

  const handleSkip = () => {
    stop();
    setPhase((p) => {
      const next: Phase = p === 'work' ? 'break' : 'work';
      setSeconds(totalSecs(next));
      return next;
    });
  };

  const handleClose = () => { stop(); onClose(); };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const total   = totalSecs(phase);
  const elapsed = total - seconds;
  const pct     = total > 0 ? elapsed / total : 0;

  const phaseColor =
    phase === 'work' ? COLORS.primary :
    phase === 'break' ? COLORS.success :
    '#9B8CFF';

  const phaseLabel =
    phase === 'work' ? 'Focus' :
    phase === 'break' ? 'Short Break' :
    'Long Break';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Focus Timer</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={22} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          {taskTitle ? (
            <Text style={s.taskName} numberOfLines={2}>{taskTitle}</Text>
          ) : null}

          {/* Phase pill */}
          <View style={[s.phasePill, { backgroundColor: phaseColor + '22', borderColor: phaseColor + '55' }]}>
            <Text style={[s.phaseText, { color: phaseColor }]}>{phaseLabel}</Text>
          </View>

          {/* Ring timer */}
          <View style={s.ringWrap}>
            {/* Background ring */}
            <View style={[s.ring, { borderColor: phaseColor + '22' }]} />
            {/* Gradient fill overlay — visual progress */}
            <LinearGradient
              colors={[phaseColor + 'CC', phaseColor + '33']}
              style={[s.progressArc, { opacity: 0.15 + pct * 0.7 }]}
            />
            <View style={s.timeWrap}>
              <Text style={s.time}>{pad(mins)}:{pad(secs)}</Text>
              <Text style={s.sessionLabel}>{sessions} session{sessions !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={s.controls}>
            <TouchableOpacity style={s.secondaryBtn} onPress={handleReset}>
              <Ionicons name="refresh" size={20} color={COLORS.textSub} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.playBtn, { backgroundColor: phaseColor }]}
              onPress={() => setRunning((r) => !r)}
              activeOpacity={0.85}
            >
              <Ionicons name={running ? 'pause' : 'play'} size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={s.secondaryBtn} onPress={handleSkip}>
              <Ionicons name="play-skip-forward" size={20} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          {/* Session dots */}
          <View style={s.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[s.dot, { backgroundColor: i < (sessions % 4) ? phaseColor : COLORS.surfaceBorder }]}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const RING_SIZE = 200;

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48, alignItems: 'center',
  },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceBorder, marginBottom: 16 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 4 },
  title:    { fontSize: 18, fontWeight: '700', color: COLORS.text },
  taskName: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', marginBottom: 12, paddingHorizontal: 16 },

  phasePill:{ paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
  phaseText:{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  ringWrap: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },
  ring: {
    position: 'absolute', width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2, borderWidth: 12,
  },
  progressArc: {
    position: 'absolute', width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },
  timeWrap: { alignItems: 'center' },
  time:    { fontSize: 48, fontWeight: '800', color: COLORS.text, letterSpacing: -2 },
  sessionLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500', marginTop: 4 },

  controls:    { flexDirection: 'row', alignItems: 'center', gap: 24 },
  playBtn:     { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  secondaryBtn:{
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.cardAlt, borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },

  dots: { flexDirection: 'row', gap: 8, marginTop: 24 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
});
