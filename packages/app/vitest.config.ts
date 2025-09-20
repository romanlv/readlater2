import { defineConfig } from 'vitest/config'
import path from "path"

export default defineConfig({
  plugins: [
    // Mock virtual:pwa-register/react for testing
    {
      name: 'mock-virtual-pwa',
      resolveId(id) {
        if (id === 'virtual:pwa-register/react') return id
      },
      load(id) {
        if (id === 'virtual:pwa-register/react') {
          return `export const useRegisterSW = () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: () => {} })`
        }
      },
    }
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})