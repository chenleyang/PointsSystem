const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5174', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true },
  webServer: { command: 'node scripts/serve.cjs', url: 'http://127.0.0.1:5174', reuseExistingServer: false, env: {PORT:'5174',BACKUP_DATA_DIR:'test-results/cloud',SYNC_TOKEN:'test-only-shared-key-2026'} },
});
