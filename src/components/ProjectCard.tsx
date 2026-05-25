import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Project } from '../types';
import { CARD_SHADOW_SM, COLORS } from '../utils/constants';

interface Props {
  project: Project;
  taskCount?: number;
  completedCount?: number;
  onPress: (project: Project) => void;
}

function ProjectCard({ project, taskCount = 0, completedCount = 0, onPress }: Props) {
  const progressPct = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
  return (
    <TouchableOpacity onPress={() => onPress(project)} activeOpacity={0.75} style={[s.card, CARD_SHADOW_SM]}>
      <View style={s.body}>
        <View style={s.row}>
          {/* Colored icon bubble */}
          <View style={[s.iconBubble, { backgroundColor: project.color + '22' }]}>
            <Ionicons name="folder-open-outline" size={16} color={project.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{project.name}</Text>
            {project.description ? (
              <Text style={s.desc} numberOfLines={1}>{project.description}</Text>
            ) : null}

            {/* Progress bar */}
            {taskCount > 0 && (
              <View style={s.progressTrack}>
                <View
                  style={[s.progressFill, {
                    width: `${Math.max(progressPct, 3)}%` as any,
                    backgroundColor: progressPct >= 100 ? COLORS.success : project.color,
                  }]}
                />
              </View>
            )}
          </View>
          <View style={[s.countBadge, { backgroundColor: project.color + '18', borderColor: project.color + '40' }]}>
            <Text style={[s.countText, { color: project.color }]}>
              {completedCount}/{taskCount}
            </Text>
            <Text style={[s.countLabel, { color: project.color }]}>
              {progressPct}%
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBubble: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  desc: { color: COLORS.textSub, fontSize: 12, marginTop: 2 },
  progressTrack: {
    height: 4, borderRadius: 2, backgroundColor: COLORS.cardAlt,
    marginTop: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  progressFill: { height: '100%', borderRadius: 2 },
  countBadge: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1,
  },
  countText: { fontSize: 14, fontWeight: '700', lineHeight: 16 },
  countLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.3, opacity: 0.7 },
});

export default memo(ProjectCard);



