import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { functionsDevPlugin } from './netlify/dev/functions-dev-plugin';

// Multi-page build (ADR 0001). In `npm run dev` the plugin serves netlify/functions at /api/* on this origin.
export default defineConfig({
  plugins: [functionsDevPlugin()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        policies: resolve(__dirname, 'policies.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        passwordTool: resolve(__dirname, 'admin/password-tool.html'),
      },
    },
  },
});
