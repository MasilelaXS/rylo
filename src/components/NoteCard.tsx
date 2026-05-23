import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Note } from '../types';
import { CARD_SHADOW, COLORS } from '../utils/constants';

interface Props {
  note: Note;
  onPress: () => void;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - ms) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NoteCard({ note, onPress }: Props) {
  const preview = note.content.replace(/\n+/g, ' ').trim();

  return (
    <TouchableOpacity style={[s.card, CARD_SHADOW]} onPress={onPress} activeOpacity={0.75}>
      <View style={s.row}>
        <Text style={s.title} numberOfLines={1}>
          {note.title || 'Untitled'}
        </Text>
        <Text style={s.date}>{formatDate(note.updatedAt)}</Text>
      </View>
      {preview ? (
        <Text style={s.preview} numberOfLines={2}>{preview}</Text>
      ) : (
        <Text style={s.empty}>No content</Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 10,
  },
  date: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  preview: {
    fontSize: 13,
    color: COLORS.textSub,
    lineHeight: 19,
  },
  empty: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});
