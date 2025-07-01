// Test setup for vitest
import { vi } from 'vitest'

// Mock window.close
Object.defineProperty(window, 'close', {
  value: vi.fn(),
  writable: true
})