import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from './use-settings';

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('returns default settings when nothing stored', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual({
      autoSync: true,
      openInPreview: false,
      backendEnabled: false,
      backendUrl: 'http://localhost:4080',
    });
  });

  test('returns stored settings merged with defaults', () => {
    localStorage.setItem('app-settings', JSON.stringify({ autoSync: false }));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.autoSync).toBe(false);
    expect(result.current.settings.openInPreview).toBe(false);
  });

  test('updateSettings persists to localStorage', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ openInPreview: true });
    });

    expect(result.current.settings.openInPreview).toBe(true);

    const stored = JSON.parse(localStorage.getItem('app-settings')!);
    expect(stored.openInPreview).toBe(true);
  });

  test('updateSettings merges partial updates', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ autoSync: false });
    });

    expect(result.current.settings.autoSync).toBe(false);
    expect(result.current.settings.openInPreview).toBe(false);
  });

  test('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('app-settings', 'not-valid-json');

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual({
      autoSync: true,
      openInPreview: false,
      backendEnabled: false,
      backendUrl: 'http://localhost:4080',
    });
  });

  test('responds to storage events from other tabs', () => {
    const { result } = renderHook(() => useSettings());

    const newSettings = JSON.stringify({ autoSync: false, openInPreview: true });
    localStorage.setItem('app-settings', newSettings);

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'app-settings',
          newValue: newSettings,
        })
      );
    });

    expect(result.current.settings.autoSync).toBe(false);
    expect(result.current.settings.openInPreview).toBe(true);
  });

  test('ignores storage events for other keys', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'other-key',
          newValue: '{}',
        })
      );
    });

    expect(result.current.settings).toEqual({
      autoSync: true,
      openInPreview: false,
      backendEnabled: false,
      backendUrl: 'http://localhost:4080',
    });
  });
});
