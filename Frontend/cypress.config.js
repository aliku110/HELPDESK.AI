import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // Configure environment-specific settings
      config.env.apiBaseUrl = process.env.CYPRESS_API_BASE_URL || 'http://localhost:4000/api';
      return config;
    },
  },
});
