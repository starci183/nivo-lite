import { cn } from "@heroui/react";

/** The page canvas: one centred column, comfortable on a phone (GAP-5, PADDING-4 / PADDING-6). */
export const CANVAS_CLASS_NAME = cn("mx-auto", "flex", "min-h-dvh", "w-full", "max-w-lg", "flex-col", "justify-center", "gap-6", "px-4", "py-8");
/** Stack inside the page card; the SurfaceCard owns the inset (PADDING-4 case-2), this only stacks (GAP-4). */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");
/** Stacked form fields and the button under them (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3");
/** One reward row inside a SurfaceListCard (BOUNDARY-2 case-1, PADDING-3). */
export const ROW_CLASS_NAME = cn("flex", "items-start", "justify-between", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
/** Name and note of a reward (GAP-1). */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
