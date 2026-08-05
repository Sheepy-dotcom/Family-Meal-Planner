import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uk.co.familymealplanner.app',
  appName: 'Meal Plan',
  webDir: 'dist',
  // The status bar area is handled in CSS via safe-area insets rather than by
  // letting the OS letterbox the app, so the week board can run edge to edge.
  ios: {
    contentInset: 'never',
    // Rubber-band scrolling past the top of a sheet looks broken on a fixed
    // layout, and the app has its own scroll containers.
    scrollEnabled: true,
  },
  android: {
    // Keeps the WebView from resizing the whole layout when the keyboard opens
    // in the recipe editor — the fields scroll into view instead.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#ECEEE7',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'none',
    },
  },
};

export default config;
