import { defineConfig } from 'wxt';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  manifestVersion: 3,

  vite: () => ({
    plugins: [
      svelte({
        configFile: false,
        preprocess: vitePreprocess(),
        compilerOptions: {
          fragments: 'tree',
        },
        dynamicCompileOptions() {
          return {
            fragments: 'tree',
          };
        },
      }),
    ],
  }),
  
  manifest: {
    name: 'Meshy Downloader',
    description: 'Downloads meshy models.',
    permissions: ['tabs', 'storage', 'activeTab'],
    host_permissions: ['https://www.meshy.ai/*'],
    browser_specific_settings: {
      gecko: {
        id: 'meshy-downloader@efebaykaraa.github.io',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
});
