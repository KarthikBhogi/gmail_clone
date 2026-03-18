import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const groqApiKey = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || '';
  const groqApiKeys = [
    env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || '',
    env.GROQ_API_KEY_2 || env.VITE_GROQ_API_KEY_2 || '',
    env.GROQ_API_KEY_3 || env.VITE_GROQ_API_KEY_3 || '',
  ].filter(Boolean);
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_GROQ_API_KEY__: JSON.stringify(groqApiKey),
      __APP_GROQ_API_KEYS__: JSON.stringify(groqApiKeys),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
