import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    // Only process __tests__ directory files, skip the rest of src/
    exclude: [
      '**/node_modules/**',
      'src/pages/**',
      'src/components/**',
    ],
    environment: 'node',
  },
})
