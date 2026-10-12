import { cn } from "@heroui/react";

/** Vertical rhythm of the workbench (GAP-4). */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
/** Stacked fields and blocks inside a card (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");
/** Tight stack (label over value, GAP-1). */
export const STACK_SM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");
/** A wrapping row of actions or chips (GAP-2). */
export const ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
/** Actions at the bottom of a step: back left, next right, wrapping on phones. */
export const FOOTER_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2", "pt-2");
/** The step's next action when there is no back action: kept at the inline end. */
export const FOOTER_END_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-end", "gap-2", "pt-2");

/** The library grid: one card per video, one column on phones, more as the room grows (GAP-4 case-2). */
export const GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-2", "xl:grid-cols-3");
/** One grid cell holding one card. */
export const GRID_ITEM_CLASS_NAME = cn("min-w-0");

/** The media picker: square tiles that wrap, not scroll sideways. */
export const MEDIA_GRID_CLASS_NAME = cn("grid", "grid-cols-3", "gap-2", "sm:grid-cols-4", "lg:grid-cols-6");

/** The storyboard: scenes side by side inside a HorizontalScrollRegion (which owns the overflow). */
export const STORYBOARD_CLASS_NAME = cn("flex", "gap-3", "pb-2");
/** One storyboard frame: a fixed width so the frames line up in the strip. */
export const STORY_ITEM_CLASS_NAME = cn("flex", "w-40", "shrink-0", "flex-col", "gap-1");
export const STORY_ITEM_WIDE_CLASS_NAME = cn("flex", "w-56", "shrink-0", "flex-col", "gap-1");
/** grammar gap: a brand-coloured preview of a scene without media (MediaFrame has no fill slot); the colours are the workspace brand kit. */
export const FRAME_FILL_CLASS_NAME = cn("size-full");

/** grammar gap: Common has no colour picker, so the native colour input stays the smallest app-owned control. */
export const COLOR_CLASS_NAME = cn("h-10", "w-14", "cursor-pointer", "rounded-lg", "border", "border-separator", "bg-surface", "p-1");
export const FIELD_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-end", "gap-4");
/** The logo preview: a small square MediaFrame. */
export const LOGO_CLASS_NAME = cn("w-16", "shrink-0");
