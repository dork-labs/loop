import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/stdio.ts', 'src/http.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  splitting: false,
})
