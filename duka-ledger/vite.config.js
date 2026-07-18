import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      workbox: {
        // Cache all static assets (JS, CSS, HTML, local SQLite database files)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        
        // Fixes endless offline loading: Increase file size cache limit to 5MB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        
        // Ensure PowerSync schema/DB setup scripts are always available offline
        navigateFallback: '/index.html',
        
        // Fixes offline refresh/cold boot loops: Match any sub-route without a file extension
        navigateFallbackAllowlist: [/[^\/\.]+/],
        
        // Prevent cold boots from waiting on old network workers
        clientsClaim: true,
        skipWaiting: true
      },
      manifest: {
        name: 'NeemaGen Shop Digital Ledger',
        short_name: 'NeemaGen Ledger',
        description: 'Offline-first retail ledger and cash checkout manager',
        theme_color: '#0f172a', 
        background_color: '#f8fafc', 
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: 'neema_x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'neema_x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'neema_x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});