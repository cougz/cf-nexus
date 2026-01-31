import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'noop',
    mode: 'directory'
  }),
  vite: {
    ssr: {
      external: ['@cloudflare/workers-types']
    }
  },
  experimental: {
    directRenderScript: true
  }
});
