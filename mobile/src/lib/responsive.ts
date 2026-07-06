import { useWindowDimensions, PixelRatio } from 'react-native';

// Reference device width that the original stylesheet was designed for.
// On a 360dp wide phone this is roughly the smallest mainstream Android we
// want to look "tight"; everything below this we scale down, everything
// between this and 480 we keep the same, and on large phones/tablets we
// scale up modestly.
const REFERENCE_WIDTH = 360;
const REFERENCE_HEIGHT = 720;

// Smallest width that still feels "phone native". Below this we tighten
// paddings, font sizes and tap targets.
export const BREAKPOINTS = {
  // Compact phones (iPhone SE 1st/2nd gen, very narrow Androids)
  xs: 360,
  // Standard phones (most modern Androids, iPhone 12/13/14)
  sm: 400,
  // Large phones / phablets (iPhone Pro Max, Galaxy Note)
  md: 480,
  // Small tablets (iPad mini, portrait 7")
  lg: 720,
  // Large tablets / desktop
  xl: 1024,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export interface SizeClass {
  width: number;
  height: number;
  /** Bucket key used for coarse "what layout should I pick" decisions. */
  size: Breakpoint;
  /** True for phone-like widths (under md). */
  isPhone: boolean;
  /** True for tablet-like widths (md or above). */
  isTablet: boolean;
  /** True for very narrow phones where we should aggressively scale down. */
  isCompact: boolean;
}

const SIZE_BUCKETS: Array<{ key: Breakpoint; min: number }> = [
  { key: 'xl', min: BREAKPOINTS.lg + 1 },
  { key: 'lg', min: BREAKPOINTS.md + 1 },
  { key: 'md', min: BREAKPOINTS.sm + 1 },
  { key: 'sm', min: BREAKPOINTS.xs + 1 },
  { key: 'xs', min: 0 },
];

function classify(width: number): SizeClass['size'] {
  for (const bucket of SIZE_BUCKETS) {
    if (width >= bucket.min) return bucket.key;
  }
  return 'xs';
}

/**
 * Returns a SizeClass for the current window. Components use this to pick
 * between side-by-side vs stacked layouts.
 *
 * Example:
 *   const { isCompact, isTablet } = useSizeClass();
 *   <View style={[styles.row, isCompact && styles.rowStacked]} />
 */
export function useSizeClass(): SizeClass {
  const { width, height } = useWindowDimensions();
  const size = classify(width);
  return {
    width,
    height,
    size,
    isPhone: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md,
    isCompact: width < BREAKPOINTS.sm,
  };
}

/**
 * Returns true when the device is in landscape orientation (width >= height).
 */
export function useIsLandscape(): boolean {
  const { width, height } = useWindowDimensions();
  return width > height;
}

/**
 * Scale a numeric value based on the current screen width relative to the
 * reference design width. Clamped so we never go below 0.8× (compact phones)
 * nor above 1.25× (tablets) — this keeps the design feeling native on both
 * extremes without exploding.
 *
 * Use for paddings, gaps, border radii, font sizes, icon sizes — but prefer
 * `useFlexSpacing` for layout-critical paddings so we get consistent spacing
 * across siblings.
 */
export function useScaledSize(): (size: number) => number {
  const { width } = useWindowDimensions();
  return (size: number) => scaleValue(size, width);
}

export function scaleValue(size: number, width: number = REFERENCE_WIDTH): number {
  const raw = (size * width) / REFERENCE_WIDTH;
  // Clamp scaling to keep UI sensible on extreme sizes.
  const factor = width / REFERENCE_WIDTH;
  const clampedFactor = Math.max(0.82, Math.min(1.25, factor));
  return Math.round(size * clampedFactor);
}

/**
 * Picks a value from a map of breakpoint keys. Falls back to the closest
 * smaller bucket, so xs always has a sane default.
 */
export function pickBySize<T>(width: number, options: Partial<Record<Breakpoint, T>>): T | undefined {
  const ordered: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  for (const key of ordered) {
    if (options[key] !== undefined && width >= BREAKPOINTS[key]) {
      return options[key];
    }
  }
  return options.xs;
}

/**
 * Clamps a font size so we don't shrink or grow text beyond what the OS can
 * render legibly.
 */
export function clampFont(size: number, width: number = REFERENCE_WIDTH): number {
  const scaled = scaleValue(size, width);
  return Math.round(Math.max(10, Math.min(28, scaled)));
}

/**
 * Best-effort font scaling that respects the user's preferred font size
 * setting on the device. Pair this with `useScaledSize` for paddings.
 */
export function scaledFont(size: number): number {
  const { width } = useWindowDimensions();
  const base = scaleValue(size, width);
  const fontScale = PixelRatio.getFontScale();
  return Math.round(base * Math.min(fontScale, 1.3));
}