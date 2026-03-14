import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Life is short',
    description:
      'Track daily YouTube completions and block access when your daily threshold is reached.',
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
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
      default_title: 'Life is short',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        96: 'icon/96.png',
        128: 'icon/128.png',
      },
    },
  },
});
