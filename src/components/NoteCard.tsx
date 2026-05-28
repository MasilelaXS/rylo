import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Note } from '../types';
import { CARD_SHADOW, COLORS } from '../utils/constants';

interface Props {
  note: Note;
  onPress: () => void;
  layout?: 'list' | 'gallery';
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

// Strip markdown syntax for preview text
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^[-*+]\s/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
}

export default function NoteCard({ note, onPress, layout = 'list' }: Props) {
  const preview = stripMarkdown(note.content);

  if (layout === 'gallery') {
    return (
      <TouchableOpacity style={[s.galleryCard, CARD_SHADOW]} onPress={onPress} activeOpacity={0.75}>
        {note.pinned && (
          <Ionicons name="pin" size={12} color={COLORS.primary} style={s.galleryPin} />
        )}
        <Text style={s.galleryTitle} numberOfLines={2}>
          {note.title || 'Untitled'}
        </Text>
        {preview ? (
          <Text style={s.galleryPreview} numberOfLines={4}>{preview}</Text>
        ) : null}
        {note.tags.length > 0 && (
          <View style={s.tagRow}>
            {note.tags.slice(0, 2).map((tag) => (
              <View key={tag} style={s.tag}>
                <Text style={s.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={s.galleryDate}>{formatDate(note.updatedAt)}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[s.card, CARD_SHADOW]} onPress={onPress} activeOpacity={0.75}>
      <View style={s.row}>
        <View style={s.titleWrap}>
          {note.pinned && (
            <Ionicons name="pin" size={13} color={COLORS.primary} style={{ marginRight: 4, marginTop: 1 }} />
          )}
          <Text style={s.title} numberOfLines={1}>
            {note.title || 'Untitled'}
          </Text>
        </View>
        <Text style={s.date}>{formatDate(note.updatedAt)}</Text>
      </View>
      {preview ? (
        <Text style={s.preview} numberOfLines={2}>{preview}</Text>
      ) : (
        <Text style={s.empty}>No content</Text>
      )}
      {note.tags.length > 0 && (
        <View style={[s.tagRow, { marginTop: 8 }]}>
          {note.tags.slice(0, 4).map((tag) => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>#{tag}</Text>
            </View>
          ))}
          {note.tags.length > 4 && (
            <Text style={s.tagMore}>+{note.tags.length - 4}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  // ─── List layout ────────────────────────────────────────────────────────────
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
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
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

  // ─── Tags ──────────────────────────────────────────────────────────────────
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  tagMore: {
    fontSize: 11,
    color: COLORS.textMuted,
    alignSelf: 'center',
  },

  // ─── Gallery layout ──────────────────────────────────────────────────────────
  galleryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    flex: 1,
    minHeight: 130,
    margin: 5,
  },
  galleryPin: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  galleryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
    marginRight: 18,
  },
  galleryPreview: {
    fontSize: 12,
    color: COLORS.textSub,
    lineHeight: 17,
    flex: 1,
  },
  galleryDate: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 8,
  },
});
