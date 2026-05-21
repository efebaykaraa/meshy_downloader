import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Meshy Downloader',
    description: 'Downloads meshy models.',
    permissions: ['tabs', 'storage', 'activeTab'],
    host_permissions: ['https://www.meshy.ai/*'],
    web_accessible_resources: [
      {
        resources: ['meshy-main-world.js'],
        matches: ['https://www.meshy.ai/*'],
      },
    ],
  },
});
