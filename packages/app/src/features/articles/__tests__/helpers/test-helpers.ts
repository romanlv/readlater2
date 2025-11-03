import { vi } from 'vitest';
import type { SyncState, SyncStatus } from '../../sync-service';

/**
 * Sets up fake timers for testing time-dependent behavior.
 * Remember to call cleanup() after your test.
 *
 * @example
 * const time = setupFakeTimers();
 * // ... test code
 * time.advanceTime(120000); // Advance 2 minutes
 * time.cleanup();
 */
export function setupFakeTimers() {
  vi.useFakeTimers();

  return {
    /**
     * Advances time by the specified number of milliseconds.
     */
    advanceTime: (ms: number) => vi.advanceTimersByTime(ms),

    /**
     * Runs all pending timers to completion.
     */
    runAllTimers: () => vi.runAllTimers(),

    /**
     * Runs only currently pending timers (not new ones created during execution).
     */
    runOnlyPendingTimers: () => vi.runOnlyPendingTimers(),

    /**
     * Cleans up fake timers and restores real timers.
     */
    cleanup: () => vi.useRealTimers(),
  };
}

/**
 * Waits for a sync state to match the expected status.
 * Useful for testing async state changes.
 *
 * @param getState - Function that returns the current sync state
 * @param expectedStatus - The status to wait for
 * @param timeoutMs - Maximum time to wait (default: 1000ms)
 *
 * @example
 * await waitForSyncStatus(() => service.getState(), 'idle');
 */
export async function waitForSyncStatus(
  getState: () => SyncState,
  expectedStatus: SyncStatus,
  timeoutMs = 1000
): Promise<void> {
  const startTime = Date.now();

  while (getState().status !== expectedStatus) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Timeout waiting for sync status '${expectedStatus}'. Current status: '${getState().status}'`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Creates a promise that resolves when the sync state matches the expected status.
 * Works with the SyncService subscribe mechanism.
 *
 * @param service - The sync service instance
 * @param expectedStatus - The status to wait for
 * @param timeoutMs - Maximum time to wait (default: 1000ms)
 *
 * @example
 * const statePromise = waitForSyncState(service, 'idle');
 * service.syncNow();
 * await statePromise;
 */
export function waitForSyncState(
  service: { subscribe: (listener: (state: SyncState) => void) => () => void },
  expectedStatus: SyncStatus,
  timeoutMs = 1000
): Promise<SyncState> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timeout waiting for sync status '${expectedStatus}'`));
    }, timeoutMs);

    const unsubscribe = service.subscribe((state) => {
      if (state.status === expectedStatus) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(state);
      }
    });
  });
}

/**
 * Asserts that a sync state has the expected properties.
 *
 * @example
 * assertSyncState(service.getState(), {
 *   status: 'idle',
 *   pendingCount: 0,
 *   error: undefined,
 * });
 */
export function assertSyncState(
  actual: SyncState,
  expected: Partial<SyncState>
): void {
  if (expected.status !== undefined && actual.status !== expected.status) {
    throw new Error(`Expected status '${expected.status}', got '${actual.status}'`);
  }
  if (expected.pendingCount !== undefined && actual.pendingCount !== expected.pendingCount) {
    throw new Error(
      `Expected pendingCount ${expected.pendingCount}, got ${actual.pendingCount}`
    );
  }
  if (expected.error !== undefined && actual.error !== expected.error) {
    throw new Error(`Expected error '${expected.error}', got '${actual.error}'`);
  }
  if (expected.lastSyncTime !== undefined && actual.lastSyncTime !== expected.lastSyncTime) {
    throw new Error(
      `Expected lastSyncTime ${expected.lastSyncTime}, got ${actual.lastSyncTime}`
    );
  }
}

/**
 * Creates a function that tracks all state changes for assertions.
 *
 * @example
 * const stateTracker = createStateTracker();
 * service.subscribe(stateTracker.track);
 * // ... perform actions
 * expect(stateTracker.states).toHaveLength(3);
 * expect(stateTracker.states[0].status).toBe('syncing');
 */
export function createStateTracker() {
  const states: SyncState[] = [];

  return {
    /**
     * Call this from subscribe to track state changes.
     */
    track: (state: SyncState) => {
      states.push({ ...state });
    },

    /**
     * All tracked states in order.
     */
    get states() {
      return states;
    },

    /**
     * Clear all tracked states.
     */
    clear: () => {
      states.length = 0;
    },
  };
}
