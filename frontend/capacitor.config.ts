import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.securechat.app',
  appName: 'Zagel',
  webDir: 'out',
  plugins: {
    Keyboard: {
      resize: 'body',
    },
  },
};

export default config;
