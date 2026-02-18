import { useState, useCallback } from 'react';
import type { Mention } from '@/lib/mention-types';

export function useMentions() {
  const [mentions, setMentions] = useState<Mention[]>([]);

  const addMention = useCallback((mention: Mention) => {
    setMentions((prev) => {
      if (prev.some((m) => m.id === mention.id && m.type === mention.type)) return prev;
      return [...prev, mention];
    });
  }, []);

  const removeMention = useCallback((id: string, type: 'paper' | 'collection') => {
    setMentions((prev) => prev.filter((m) => !(m.id === id && m.type === type)));
  }, []);

  const clearMentions = useCallback(() => setMentions([]), []);

  return { mentions, addMention, removeMention, clearMentions };
}
