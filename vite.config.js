import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replace(/\\\\/g, '/');
          if (path.includes('/node_modules/three/examples/jsm/')) return 'three-addons';
          if (path.includes('/node_modules/three/')) return 'three-vendor';
        },
      },
    },
  },
});
