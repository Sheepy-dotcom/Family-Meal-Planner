import { useEffect } from 'react';

/**
 * Native shell behaviour, all optional.
 *
 * Every import here is dynamic and wrapped, so the identical bundle runs as a
 * plain website with none of this active. That matters: one codebase, and the
 * web version stays the fast way to test a change.
 */

function isNative(): boolean {
  const w = globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!w.Capacitor?.isNativePlatform?.();
}

/**
 * Android's hardware and gesture back.
 *
 * Without this, back exits the app from anywhere — including from an open
 * recipe, which on Android reads as the app crashing. Back should close the
 * topmost sheet, and only leave when there's nothing left to close.
 */
export function useBackButton(onBack: () => boolean) {
  useEffect(() => {
    if (!isNative()) return;
    let remove: (() => void) | undefined;

    void (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('backButton', () => {
          // onBack returns true when it handled the press.
          if (!onBack()) void App.exitApp();
        });
        remove = () => void handle.remove();
      } catch {
        // Plugin missing; browser back behaviour applies.
      }
    })();

    return () => remove?.();
  }, [onBack]);
}

/** Matches the status bar to the app's paper colour rather than stark white. */
export function useStatusBar() {
  useEffect(() => {
    if (!isNative()) return;
    void (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#ECEEE7' });
      } catch {
        /* web, or plugin missing */
      }
    })();
  }, []);
}

/**
 * A short tap for consequential actions only.
 *
 * Confirming a plan or accepting a suggestion is worth a buzz; ticking an
 * ingredient off a list forty times is not. Haptics stop being informative the
 * moment they're constant.
 */
export async function tapFeedback(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* no-op */
  }
}
