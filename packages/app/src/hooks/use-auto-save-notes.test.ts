import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSaveNotes } from './use-auto-save-notes';

describe('useAutoSaveNotes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('initializes notes from article data', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutoSaveNotes({
        initialNotes: 'existing notes',
        articleUrl: 'http://example.com',
        onSave,
      })
    );

    expect(result.current.notes).toBe('existing notes');
    expect(onSave).not.toHaveBeenCalled();
  });

  test('initializes empty notes as empty string', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutoSaveNotes({
        initialNotes: undefined,
        articleUrl: 'http://example.com',
        onSave,
      })
    );

    expect(result.current.notes).toBe('');
    expect(onSave).not.toHaveBeenCalled();
  });

  test('auto-saves after debounce when notes change', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutoSaveNotes({
        initialNotes: '',
        articleUrl: 'http://example.com',
        onSave,
        debounceMs: 500,
      })
    );

    act(() => {
      result.current.setNotes('new note');
    });

    // Not saved yet (before debounce)
    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('new note');
  });

  test('does not save when notes match initial value', () => {
    const onSave = vi.fn();
    renderHook(() =>
      useAutoSaveNotes({
        initialNotes: 'hello',
        articleUrl: 'http://example.com',
        onSave,
        debounceMs: 500,
      })
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  test('does not re-save when initialNotes prop changes after mutation refetch', () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ initialNotes }) =>
        useAutoSaveNotes({
          initialNotes,
          articleUrl: 'http://example.com',
          onSave,
          debounceMs: 500,
        }),
      { initialProps: { initialNotes: '' as string | undefined } }
    );

    act(() => {
      result.current.setNotes('user typed this');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('user typed this');
    onSave.mockClear();

    // Simulate mutation refetch: initialNotes prop changes to saved value
    rerender({ initialNotes: 'user typed this' });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should NOT trigger another save — this was the loop bug
    expect(onSave).not.toHaveBeenCalled();
  });

  test('does not loop when initialNotes keeps changing from refetches', () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ initialNotes }) =>
        useAutoSaveNotes({
          initialNotes,
          articleUrl: 'http://example.com',
          onSave,
          debounceMs: 500,
        }),
      { initialProps: { initialNotes: undefined as string | undefined } }
    );

    act(() => {
      result.current.setNotes('hello');
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    onSave.mockClear();

    // Multiple refetches with the same URL should not re-trigger saves
    rerender({ initialNotes: 'hello' });
    act(() => { vi.advanceTimersByTime(500); });

    rerender({ initialNotes: 'hello' });
    act(() => { vi.advanceTimersByTime(500); });

    rerender({ initialNotes: 'hello' });
    act(() => { vi.advanceTimersByTime(500); });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.notes).toBe('hello');
  });

  test('does not overwrite user input when article refetches with stale data', () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ initialNotes }) =>
        useAutoSaveNotes({
          initialNotes,
          articleUrl: 'http://example.com',
          onSave,
          debounceMs: 500,
        }),
      { initialProps: { initialNotes: '' as string | undefined } }
    );

    act(() => {
      result.current.setNotes('my notes');
    });

    // Before debounce fires, article refetches with OLD value (stale)
    rerender({ initialNotes: '' });

    // User's input should be preserved
    expect(result.current.notes).toBe('my notes');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('my notes');
  });

  test('saves on blur even before debounce fires', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutoSaveNotes({
        initialNotes: '',
        articleUrl: 'http://example.com',
        onSave,
        debounceMs: 500,
      })
    );

    act(() => {
      result.current.setNotes('blur test');
    });

    // Blur before debounce fires
    act(() => {
      result.current.handleBlur();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('blur test');

    // Debounce fires later — should NOT double-save
    onSave.mockClear();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  test('saves unsaved changes on unmount', () => {
    const onSave = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAutoSaveNotes({
        initialNotes: '',
        articleUrl: 'http://example.com',
        onSave,
        debounceMs: 500,
      })
    );

    act(() => {
      result.current.setNotes('unsaved work');
    });

    // Unmount before debounce fires
    unmount();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('unsaved work');
  });

  test('does not save on unmount when notes are already saved', () => {
    const onSave = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAutoSaveNotes({
        initialNotes: '',
        articleUrl: 'http://example.com',
        onSave,
        debounceMs: 500,
      })
    );

    act(() => {
      result.current.setNotes('saved work');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    onSave.mockClear();

    unmount();

    expect(onSave).not.toHaveBeenCalled();
  });

  test('saves on beforeunload when there are unsaved changes', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutoSaveNotes({
        initialNotes: '',
        articleUrl: 'http://example.com',
        onSave,
        debounceMs: 500,
      })
    );

    act(() => {
      result.current.setNotes('before reload');
    });

    // Simulate page refresh
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('before reload');
  });

  test('does not save on beforeunload when notes are already saved', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutoSaveNotes({
        initialNotes: 'existing',
        articleUrl: 'http://example.com',
        onSave,
        debounceMs: 500,
      })
    );

    // No edits made
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    expect(onSave).not.toHaveBeenCalled();

    // Edit and wait for debounce to save
    act(() => {
      result.current.setNotes('updated');
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    onSave.mockClear();

    // beforeunload after save should not double-save
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  test('cleans up beforeunload listener on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const onSave = vi.fn();
    const { unmount } = renderHook(() =>
      useAutoSaveNotes({
        initialNotes: '',
        articleUrl: 'http://example.com',
        onSave,
        debounceMs: 500,
      })
    );

    const addedHandler = addSpy.mock.calls.find(c => c[0] === 'beforeunload')?.[1];
    expect(addedHandler).toBeTruthy();

    unmount();

    const removedHandler = removeSpy.mock.calls.find(c => c[0] === 'beforeunload')?.[1];
    expect(removedHandler).toBe(addedHandler);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('populates notes when initialNotes arrives async from query', () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ initialNotes }) =>
        useAutoSaveNotes({
          initialNotes,
          articleUrl: 'http://example.com',
          onSave,
          debounceMs: 500,
        }),
      { initialProps: { initialNotes: undefined as string | undefined } }
    );

    // Initially empty while query is loading
    expect(result.current.notes).toBe('');

    // Query resolves with saved notes
    rerender({ initialNotes: 'my saved notes' });

    expect(result.current.notes).toBe('my saved notes');
    expect(onSave).not.toHaveBeenCalled();
  });

  test('does not overwrite user edits when initialNotes arrives late', () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ initialNotes }) =>
        useAutoSaveNotes({
          initialNotes,
          articleUrl: 'http://example.com',
          onSave,
          debounceMs: 500,
        }),
      { initialProps: { initialNotes: undefined as string | undefined } }
    );

    // User starts typing before query resolves
    act(() => {
      result.current.setNotes('user typing fast');
    });

    // Query resolves with old notes — should NOT overwrite user input
    rerender({ initialNotes: 'old saved notes' });

    expect(result.current.notes).toBe('user typing fast');
  });

  test('re-initializes when articleUrl changes', () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ initialNotes, articleUrl }) =>
        useAutoSaveNotes({
          initialNotes,
          articleUrl,
          onSave,
          debounceMs: 500,
        }),
      { initialProps: { initialNotes: 'first article notes', articleUrl: 'http://one.com' } }
    );

    expect(result.current.notes).toBe('first article notes');

    // Navigate to different article
    rerender({ initialNotes: 'second article notes', articleUrl: 'http://two.com' });

    expect(result.current.notes).toBe('second article notes');
  });
});
