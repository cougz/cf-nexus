import cloudflare from '@astrojs/cloudflare'
import tailwind from '@astrojs/tailwind'
import { defineConfig } from 'astro/config'

export default defineConfig({
  adapter: cloudflare(),
  integrations: [tailwind()],
})
