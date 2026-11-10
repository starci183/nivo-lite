import { defineConfig } from 'vite'

// Images are many and copied in bulk; watching them crashed the dev server with EBUSY on Windows.
// Only source/markdown is watched; reload the page after adding PNGs.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    watch: {
      ignored: ['**/*.png', '**/shots/**', '**/node_modules/**'],
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    },
  },
})
