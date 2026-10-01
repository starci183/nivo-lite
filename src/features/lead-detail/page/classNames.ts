import { cn } from "@heroui/react";

/** Header stack wrapper. */
export const HEADER_CLASS_NAME = cn("flex", "flex-col", "gap-3");
/** Title row wrapper. */
export const TITLE_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");
/** Column wrapper for primary panels. */
export const PRIMARY_CLASS_NAME = cn("flex", "flex-col", "gap-6");
/** Page wrapper. */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-6");
/** Title with the stage badge beside it. */
export const TITLE_INLINE_CLASS_NAME = cn("inline-flex", "flex-wrap", "items-center", "gap-3");
/** Action bar: primary, secondary and the menu. */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
/** Stepper strip; scrolls sideways on narrow screens instead of overflowing the page. */
export const JOURNEY_CLASS_NAME = cn("overflow-x-auto", "border-y", "border-separator", "py-4");
/** Minimum width so six steps stay readable inside the scroll strip. */
export const JOURNEY_INNER_CLASS_NAME = cn("min-w-192");
/** Anchor wrapper for a panel; leaves room when scrolled to. */
export const ANCHOR_CLASS_NAME = cn("scroll-mt-6");
/** Sticky rail on desktop. */
export const RAIL_CLASS_NAME = cn("flex", "flex-col", "gap-6");
/** Screen-reader-only text. */
export const SR_ONLY_CLASS_NAME = cn("sr-only");
/** Back link above the identity row. */
export const BACK_CLASS_NAME = cn("inline-flex", "min-h-10", "items-center", "self-start");
/** Avatar + name/actions row. */
export const IDENTITY_CLASS_NAME = cn("flex", "items-start", "gap-4");
/** Text side of the identity row. */
export const IDENTITY_BODY_CLASS_NAME = cn("min-w-0", "flex-1");
