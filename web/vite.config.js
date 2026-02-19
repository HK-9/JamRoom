import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'JamRoom',
        short_name: 'JamRoom',
        description: 'Listen to music together in real-time',
        theme_color: '#1677ff',
        background_color: '#141414',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache JS/CSS/HTML for offline shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache API or socket calls
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket.io/, /^\/health/],
        runtimeCaching: [
          {
            // SoundCloud artwork — cache for 7 days
            urlPattern: /^https:\/\/i1\.sndcdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'soundcloud-artwork',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
