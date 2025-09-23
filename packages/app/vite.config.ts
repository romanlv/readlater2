import { VitePWA } from 'vite-plugin-pwa';
/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vite'
import vitestConfig from './vitest.config'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from "@tailwindcss/vite"

// https://vitejs.dev/config/
export default mergeConfig(defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss(), VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    registerType: 'autoUpdate',
    injectRegister: false,
    manifest: {
      name: 'Read It Later',
      short_name: 'ReadLater',
      description: 'Save articles to read later with Google Sheets sync',
      id: '/',
      theme_color: '#1976d2',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: process.env.VITE_BASE_PATH || '/',

      icons: [{
        src: 'pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      }, {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      }, {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      }, {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      }],

      share_target: {
        action: process.env.VITE_BASE_PATH || '/',
        method: 'POST',
        enctype: 'multipart/form-data',
        params: {
          title: 'title',
          text: 'text',
          url: 'url'
        }
      },

      screenshots: [{
        src: 'screenshot-wide.png',
        sizes: '640x320',
        type: 'image/png',
        form_factor: 'wide',
      }, {
        src: 'screenshot-320x320.png',
        sizes: '320x320',
        type: 'image/png',
        form_factor: 'narrow',
      }]
    },

    injectManifest: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
    },

    devOptions: {
      enabled: true,
      navigateFallback: 'index.html',
      suppressWarnings: true,
      type: 'module',
    },
  })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3030,
    allowedHosts: ['readitlater-dev.10fold.dev'],
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
  define: {
    'import.meta.env.DEV': true, // Ensure DEV is properly defined for the service worker
    'import.meta.env.VITE_BUILD_SHA': JSON.stringify(process.env.VITE_BUILD_SHA || process.env.GITHUB_SHA?.slice(0, 7) || undefined),
  },
}), vitestConfig)