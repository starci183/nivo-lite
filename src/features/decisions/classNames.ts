import { cn } from "@heroui/react";

/** Vertical rhythm: header, filters, list. */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-4");
/** A tab strip that scrolls sideways on phones instead of widening the page. */
export const TABS_CLASS_NAME = cn("max-w-full", "overflow-x-auto");
/** Filter block: kind tabs over department tabs. */
export const FILTERS_CLASS_NAME = cn("flex", "flex-col", "gap-2");
/** List of decision rows. */
export const LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "p-0");
/** One row: divided. */
export const ROW_CLASS_NAME = cn("flex", "flex-col", "gap-1", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
/** Head line: action + outcome on the left, time on the right. */
export const ROW_HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-x-3", "gap-y-1");
/** Chips line. */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
/** Footer line under a row: lead link. */
export const ROW_FOOT_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1");
