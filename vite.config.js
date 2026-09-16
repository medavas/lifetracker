import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest (not the default generateSW) because push needs a
      // custom 'push' listener in the service worker -- see src/sw.js.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        injectionPoint: 'self.__WB_MANIFEST',
      },
      // Push needs a real service worker registration, and VitePWA doesn't
      // register one under `vite dev` by default. Stoa is used day to day
      // via `pnpm run dev` tunneled over Tailscale, not a production build,
      // so without this the push toggle would silently have nothing to
      // subscribe to.
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Stoa',
        short_name: 'Stoa',
        description: 'Personal life dashboard — habits, journal, progress, everything.',
        theme_color: '#12141c',
        background_color: '#12141c',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
