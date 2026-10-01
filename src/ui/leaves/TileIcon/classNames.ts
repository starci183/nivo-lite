import { cn } from "@heroui/react";

/** Stable classes for the tile mark and its state signal. */
export const TILE_ICON_CLASS_NAME = cn("relative", "inline-flex", "size-10", "shrink-0", "items-center", "justify-center", "rounded-xl");
/** The normal mark uses the semantic accent surface and foreground pair. */
export const TILE_ICON_RESTING_CLASS_NAME = cn("bg-accent-soft", "text-accent-soft-foreground");
/** Signal recipes make the status dot meaningful without exposing styling to callers. */
export const TILE_ICON_SIGNAL_CLASS_NAMES = {
  none: cn("hidden"),
  active: cn("bg-success"),
  attention: cn("bg-warning")
} as const;
/** The signal dot is positioned consistently over the tile mark. */
export const TILE_ICON_SIGNAL_CLASS_NAME = cn("absolute", "-right-0.5", "-top-0.5", "size-2.5", "rounded-full", "ring-2", "ring-background");
