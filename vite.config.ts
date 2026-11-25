import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { functionsDevPlugin } from './netlify/dev/functions-dev-plugin.ts';

// Multi-page build (ADR 0001). In `npm run dev` the plugin serves netlify/functions at /api/* on this origin.
export default defineConfig({
  plugins: [functionsDevPlugin()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        policies: resolve(import.meta.dirname, 'policies.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
        passwordTool: resolve(import.meta.dirname, 'admin/password-tool.html'),
      },
    },
  },
});
