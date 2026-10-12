import { cn } from "@heroui/react";

/** Bands of the one flow card (GAP-4: blocks that each carry their own heading inside one card). */
export const STACK = cn("flex", "flex-col", "gap-4");
/** One band: its Heading over its rows (GAP-2). */
export const SECTION = cn("flex", "flex-col", "gap-2");
/** Rows of one collection inside the card: one parent declaration draws every seam (BOUNDARY-3); List owns the reset. */
export const LIST = cn("flex", "flex-col", "divide-y", "divide-separator");
/** One row: a band between two separators (PADDING-3 case-3); the outer rows meet the band edge, not a seam (PADDING-0). */
export const ITEM = cn("flex", "min-w-0", "flex-col", "gap-1", "py-3", "first:pt-0", "last:pb-0");
/** Row title line: label and its timestamp or status (GAP-2). */
export const ITEM_HEAD = cn("flex", "min-w-0", "flex-wrap", "items-center", "justify-between", "gap-2");
/** Badges row (GAP-2 case-4). */
export const ITEM_META = cn("flex", "flex-wrap", "items-center", "gap-2");
