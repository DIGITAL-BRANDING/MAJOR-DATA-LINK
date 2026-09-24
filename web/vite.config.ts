import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Without this, index.html only ships a `<script type="module">` -
    // nothing else. Any browser that predates ES modules (Safari <11,
    // Android's stock/old-WebView-based browsers, browsers on Android
    // phones whose system WebView was never updated - not rare among the
    // budget devices this app's own users are on) can't run ANY of the
    // site's JS at all: no error, no console message a user would ever
    // see, just a permanently blank white page, because the app never
    // mounts to <div id="root">. Modern syntax the source already uses
    // throughout (optional chaining `?.`, nullish coalescing `??` - 120+
    // call sites) has the same failure mode one browser generation later
    // (pre-Chrome-80-ish): the script parses far enough to hit a
    // SyntaxError and stops, same blank-page symptom. This plugin builds a
    // SECOND, transpiled+polyfilled bundle behind a `<script nomodule>`
    // tag, which only those older browsers ever load - modern browsers
    // are unaffected and keep loading the normal modern bundle.
    legacy({
      targets: ['defaults', 'not dead', 'Android >= 6', 'iOS >= 10']
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8787',
        changeOrigin: true,
      },
      // K-Tech Live Chat's Socket.IO connection (ChatWidget.tsx) - needs
      // `ws: true` so Vite's dev proxy upgrades the HTTP connection instead
      // of treating it as a normal request. Only needed in dev; in
      // production the web build and backend are the same origin.
      '/socket.io': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
