# Shipping this as an iOS and Android app

The app is a React web build wrapped in [Capacitor](https://capacitorjs.com).
One codebase: the same `dist/` runs as a website and inside both native shells.
That was the deciding factor — a React Native rewrite would have meant
maintaining two versions of every screen for no user-visible gain.

## Setup, once

```bash
npm install
npx cap add ios
npx cap add android
```

`ios/` and `android/` are generated native projects. Commit them — they hold
signing config, icons and permissions.

## Every time you change the app

```bash
npm run ios       # build, sync, open Xcode
npm run android   # build, sync, open Android Studio
```

Then Run from the IDE. `npm run dev` in a browser is still the fast loop for
anything that isn't native-specific.

## Requirements

- **iOS**: a Mac with Xcode. An Apple Developer account (£79/year) to ship.
- **Android**: Android Studio. A one-off £20 Play Console fee.

## What was changed for mobile

### Storage — the one that would have bitten

`localStorage` inside an iOS WebView is treated as **cache, and the OS can purge
it when the device is low on space.** A household silently losing its recipes,
history and learned preferences would be unexplainable and unrecoverable.

`store/storage.ts` uses Capacitor Preferences on device — which maps to
UserDefaults and SharedPreferences, and is not purged — falling back to
localStorage on the web and to memory when storage is disabled entirely.

Native storage is asynchronous, but every call site in the app reads
synchronously. Rather than thread loading states through the whole app for a few
kilobytes, storage hydrates once into an in-memory cache before the first
render, then serves reads synchronously and writes through in the background. A
failed write can't break the interaction that triggered it.

### Android back button

Without handling, back exits the app from anywhere — including from an open
recipe, which reads as a crash. It now closes the topmost sheet first and only
exits when nothing is left open.

### Safe areas

The app draws edge to edge and insets its own content with `env(safe-area-inset-*)`.
Letting the OS letterbox it instead wastes the two most valuable strips of a
phone screen.

### Input font size

Anything under 16px makes iOS zoom the page on focus, and it doesn't zoom back.
All fields are 16px on touch devices.

### Hover and selection

Hover states can stick after a tap on touch browsers, so they're neutralised
under `@media (hover: none)` and replaced with pressed states. Long-press
selection is suppressed on controls but kept on recipe steps and shopping lines,
which people may genuinely want to copy.

### Haptics

Deliberately sparse. Confirming a plan is worth a tap; ticking forty ingredients
off a list is not — constant haptics stop being informative.

## Still to do before submitting

- **App icons and splash screens** — `@capacitor/assets` generates every size
  from one source image.
- **Privacy policy URL** — both stores require one. This app collects nothing
  and sends nothing anywhere, which makes the policy short but not optional.
- **App Store data disclosure** — answer "no data collected"; it's accurate.
- **Test on a real device**, particularly the keyboard in the recipe editor and
  scrolling inside sheets. The simulator does not reproduce either faithfully.
- **Deep-link handling** if the retailer handoff should open the retailer's own
  app rather than a browser tab.
