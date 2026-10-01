import { cn } from "@heroui/react";

/** Stable classes for the floating microchip artwork. */
export const MICROCHIP_ARTWORK_CLASS_NAME = cn("inline-flex", "h-28", "w-40", "shrink-0", "items-center", "justify-center");
/** The loading surface keeps the artwork's rounded silhouette. */
export const MICROCHIP_ARTWORK_RESTING_CLASS_NAME = cn("rounded-3xl");
/** The SVG fills the fixed artwork box without adding layout space. */
export const MICROCHIP_ARTWORK_SVG_CLASS_NAME = cn("h-full", "w-full", "overflow-visible");
