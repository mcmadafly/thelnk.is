// @ts-check
import { defineConfig } from 'astro/config';
import clerk from '@clerk/astro';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

/** Production D1 in `astro dev` (Wrangler `remote: true`). Off for `astro build` so deploy/CI skip edge-preview auth. */
const remoteBindings = process.argv.includes('dev');

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://thelnk.is',
  integrations: [clerk({ enableEnvSchema: false })],
  adapter: cloudflare({
    remoteBindings,
  }),
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['@clerk/astro/server', '@clerk/astro/components'],
    },
    ssr: {
      optimizeDeps: {
        exclude: ['@clerk/astro/server', '@clerk/astro/components'],
      },
    },
  },
});