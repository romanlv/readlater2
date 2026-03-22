import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from './use-debounce';

interface UseAutoSaveNotesOptions {
  initialNotes: string | undefined;
  articleUrl: string;
  onSave: (notes: string) => void;
  debounceMs?: number;
}

export function useAutoSaveNotes({
  initialNotes,
  articleUrl,
  onSave,
  debounceMs = 1000,
}: UseAutoSaveNotesOptions) {
  // null = user hasn't edited yet, show initialNotes from query
  const [edited, setEdited] = useState<string | null>(null);
  const notes = edited ?? initialNotes ?? '';
  const debouncedEdited = useDebounce(edited, debounceMs);

  // Track last-saved value to avoid duplicate saves
  const savedRef = useRef('');
  if (edited === null) savedRef.current = initialNotes ?? '';

  // Ref for accessing current state in callbacks without stale closures
  const stateRef = useRef({ edited, onSave });
  stateRef.current = { edited, onSave };

  // Reset when navigating to a different article
  const prevUrlRef = useRef(articleUrl);
  if (prevUrlRef.current !== articleUrl) {
    prevUrlRef.current = articleUrl;
    setEdited(null);
  }

  // Debounced auto-save
  useEffect(() => {
    if (debouncedEdited !== null && debouncedEdited !== savedRef.current) {
      savedRef.current = debouncedEdited;
      stateRef.current.onSave(debouncedEdited);
    }
  }, [debouncedEdited]);

  // Flush unsaved changes immediately (blur, unmount, page unload)
  const flush = useCallback(() => {
    const { edited, onSave } = stateRef.current;
    if (edited !== null && edited !== savedRef.current) {
      savedRef.current = edited;
      onSave(edited);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [flush]);

  const setNotes = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === 'function') {
      setEdited(prev => value(prev ?? savedRef.current));
    } else {
      setEdited(value);
    }
  }, []);

  return { notes, setNotes, handleBlur: flush };
}
