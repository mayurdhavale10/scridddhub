# 0003. Bare React Native (community CLI), with react-native-web for the shared web target

## Context

Two things needed deciding together: which React Native tooling to build on, and how `web-app`
gets its UI without duplicating `mobile-app`'s components.

Expo's managed workflow gives web support and a fast dev loop (Expo Go) for free, at the cost of
an abstraction layer over native code and some constraints on native modules. Bare React Native
(scaffolded via `@react-native-community/cli`) gives full, direct native module access with no
Expo layer in between, at the cost of web support not being included — it has to be added and
configured by hand via `react-native-web`.

## Decision

- `mobile-app` is a bare React Native project, scaffolded with `@react-native-community/cli`.
- Web support is added on top via `react-native-web`, with our own Metro/webpack config — not an
  Expo web build.
- `web-app`'s UI comes from the same component tree as `mobile-app` (mobile-shaped layout first);
  desktop-specific breakpoints/layouts are added later as responsive variants of the same
  components, not a separate implementation.

## Consequences

- Full native module access from day one; no Expo eject ever needed.
- Local Android Studio / Xcode setup is required to build and run on device/emulator — no
  Expo Go shortcut.
- Someone has to own the `react-native-web` + bundler config; this is real setup work, not
  automatic. Tracked as a concrete task, not assumed to "just work."
- `web-app` stays a thin deploy target (bundler config + entry point) rather than a second
  codebase, as long as this holds.
