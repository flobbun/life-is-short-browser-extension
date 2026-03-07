import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Life Is Short',
    description:
      'Track daily YouTube completions and block access when your daily threshold is reached.',
    permissions: ['storage'],
    host_permissions: [
      '*://youtube.com/*',
      '*://*.youtube.com/*',
      '*://m.youtube.com/*',
      '*://youtu.be/*',
      '*://linkedin.com/*',
      '*://*.linkedin.com/*',
    ],
    action: {
      default_title: 'Life Is Short',
    },
  },
});
