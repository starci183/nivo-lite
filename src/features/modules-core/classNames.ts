import { cn } from "@heroui/react";

/** Page regions under the page heading (GAP-5). */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");
/** The module switcher: a horizontal strip on narrow widths, a sticky column from lg (GAP-2). */
export const RAIL_CLASS_NAME = cn("flex", "min-w-0", "gap-2", "overflow-x-auto", "lg:sticky", "lg:top-0", "lg:flex-col", "lg:overflow-visible");
export const RAIL_HEAD_CLASS_NAME = cn("hidden", "lg:block");
export const RAIL_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "items-start", "gap-1");
export const MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");
export const HEADER_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-4");
export const HEADER_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-60", "flex-col", "gap-1");
export const HEADER_TITLE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
export const HEADER_META_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1");

export const CATALOG_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-3");
export const CATEGORY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
export const CARD_CLASS_NAME = cn("flex", "h-full", "min-w-0", "flex-col", "gap-4");
export const CARD_HEAD_CLASS_NAME = cn("flex", "items-start", "justify-between", "gap-3");
/** A row of badges (GAP-2 case-4). */
export const BADGES_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-end", "gap-2");
/** Selling points of one module (GAP-1: a short list of facts under the description). */
export const CARD_POINTS_CLASS_NAME = cn("flex", "flex-col", "gap-1");
export const CARD_FOOT_CLASS_NAME = cn("mt-auto", "flex", "items-center", "justify-between", "gap-2", "pt-2");

/** Breadcrumb trail above the page heading: one heading block (GAP-2). */
export const HEAD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2");
