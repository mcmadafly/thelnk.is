// @ts-check
import { defineConfig } from 'astro/config';
import clerk from '@clerk/astro';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://app.thelnk.is',
  integrations: [clerk()],
  adapter: cloudflare(),
});