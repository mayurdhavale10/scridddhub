// Palette source updated 2026-09-16: the user shared a black/white/neutral mockup for the Land
// Parcels screen (Tailwind neutral scale, black as the one primary/action color) and asked to
// adopt its colors, keeping our existing layout, labels, and stage model as-is. Superseded the
// earlier green "Stitch design system" palette below.
//
// Mapping: primary shifts from green to black (buttons, active chip, highlighted-card border in
// the mockup). The mockup's own status-pill colors for "Good buy"/"Screened" — bg rgb(229,240,232)
// text rgb(63,107,74) — already closely matched our old secondary/secondaryContainer greens, so
// those are kept as the semantic "success" accent, now the only remaining color besides black/
// white/gray. error/onError/errorContainer are UNCHANGED — the mockup has no error/destructive
// state (its "Rejected" tag is plain black-on-white, a different semantic than a genuine error),
// so there's nothing to adopt there; changing them would be guessing, not following the mockup.
export const colors = {
  // Flagged 2026-09-19: the real Stitch screen (4 — Land Pipeline) uses a plain white page
  // background, not the light-gray f5f5f5 this was carrying — changed to match, app-wide (this
  // is a shared token, not scoped to one screen).
  background: '#ffffff',
  surface: '#ffffff',
  surfaceContainer: '#f5f5f5',
  surfaceContainerLow: '#fafafa',
  surfaceContainerLowest: '#ffffff',

  primary: '#000000',
  onPrimary: '#ffffff',
  primaryContainer: '#e5e5e5',
  onPrimaryContainer: '#404040',

  secondary: '#3f6b4a',
  secondaryContainer: '#e5f0e8',
  onSecondaryContainer: '#3f6b4a',

  error: '#a73b21',
  onError: '#fff7f6',
  errorContainer: '#fd795a',

  onSurface: '#171717',
  onSurfaceVariant: '#6b7280',
  outline: '#a3a3a3',
  outlineVariant: '#d4d4d4',
} as const;
