import { cn } from "@heroui/react";

/** Header stack wrapper (GAP-3). */
export const HEADER_CLASS_NAME = cn("flex", "flex-col", "gap-3");
/** Column wrapper for primary panels (GAP-5: regions). */
export const PRIMARY_CLASS_NAME = cn("flex", "flex-col", "gap-6");
/** Page wrapper (GAP-5: regions). */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-6");
/** Title with the stage badge beside it (GAP-3). */
export const TITLE_INLINE_CLASS_NAME = cn("inline-flex", "flex-wrap", "items-center", "gap-3");
/** Action bar: primary, secondary and the menu (GAP-2 case-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
/** Anchor wrapper for a panel; leaves room when scrolled to. */
export const ANCHOR_CLASS_NAME = cn("scroll-mt-6");
/** Rail column (GAP-5: regions). */
export const RAIL_CLASS_NAME = cn("flex", "flex-col", "gap-6");
/** Keeps the back action at its own width instead of stretching across the header column. */
export const BACK_CLASS_NAME = cn("self-start");
/** Avatar + name/actions row (GAP-4). */
export const IDENTITY_CLASS_NAME = cn("flex", "items-start", "gap-4");
/** Text side of the identity row. */
export const IDENTITY_BODY_CLASS_NAME = cn("min-w-0", "flex-1");
