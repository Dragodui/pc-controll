import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Web build: PWA wiring. Expo's Metro web export has no HTML template hook, so
// the manifest link and service worker are attached at runtime.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = '/manifest.json';
  document.head.appendChild(link);

  const theme = document.createElement('meta');
  theme.name = 'theme-color';
  theme.content = '#2b6cf0';
  document.head.appendChild(theme);

  const apple = document.createElement('link');
  apple.rel = 'apple-touch-icon';
  apple.href = '/icon-192.png';
  document.head.appendChild(apple);

  // Service workers need a secure context (https or localhost); on a plain
  // http LAN address this is skipped and the page still works as a web app.
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}
