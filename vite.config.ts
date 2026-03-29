import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Suppress the default 500 kB warning; the 3D-engine chunk is intentionally
    // large and is loaded lazily, so the initial download is not affected.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        // Group large third-party libraries into predictable vendor chunks so
        // that cache busting is scoped to the code that actually changed.
        // three is grouped with r3f because it is always co-loaded with R3F/Drei.
        manualChunks(id: string) {
          if (
            id.includes('node_modules/three') ||
            id.includes('node_modules/@react-three/fiber') ||
            id.includes('node_modules/@react-three/drei')
          )
            return 'vendor-r3f'
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/')
          )
            return 'vendor-react'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx'],
    },
  },
})
