// @ts-check
import { defineConfig } from 'astro/config';
import clerk from '@clerk/astro';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://thelnk.is',
  integrations: [clerk({ enableEnvSchema: false })],
  adapter: cloudflare(),
});