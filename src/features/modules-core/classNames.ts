import { cn } from "@heroui/react";

export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");
export const FRAME_CLASS_NAME = cn("grid", "min-w-0", "grid-cols-1", "items-start", "gap-6", "lg:grid-cols-[14rem_minmax(0,1fr)]");
export const RAIL_CLASS_NAME = cn("flex", "min-w-0", "gap-2", "overflow-x-auto", "lg:sticky", "lg:top-6", "lg:flex-col", "lg:overflow-visible");
export const RAIL_HEAD_CLASS_NAME = cn("hidden", "px-2", "pb-1", "lg:block");
export const RAIL_ITEM_CLASS_NAME = cn("flex", "min-h-14", "min-w-44", "shrink-0", "items-center", "gap-3", "rounded-lg", "border", "border-transparent", "p-2", "hover:bg-surface-tertiary", "focus-visible:outline-2", "focus-visible:outline-focus", "lg:min-w-0");
export const RAIL_ITEM_ACTIVE_CLASS_NAME = cn("border-separator", "bg-surface");
export const RAIL_ART_CLASS_NAME = cn("h-10", "w-10", "shrink-0", "rounded-lg", "bg-accent-soft", "object-contain", "p-0.5");
export const RAIL_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col");
export const MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-5");
export const HEADER_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-4");
export const HEADER_ART_CLASS_NAME = cn("h-16", "w-auto", "shrink-0", "object-contain");
export const HEADER_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-60", "flex-col", "gap-1");
export const HEADER_TITLE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
export const HEADER_META_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1");

export const CATALOG_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-3");
export const CARD_CLASS_NAME = cn("flex", "h-full", "min-w-0", "flex-col", "gap-4");
export const CARD_ART_WRAP_CLASS_NAME = cn("flex", "h-36", "items-center", "justify-center", "rounded-lg", "bg-accent-soft");
export const CARD_ART_CLASS_NAME = cn("h-32", "w-auto", "object-contain");
export const CARD_HEAD_CLASS_NAME = cn("flex", "items-start", "justify-between", "gap-3");
export const CARD_POINTS_CLASS_NAME = cn("flex", "flex-col", "gap-1", "text-sm", "text-muted");
export const CARD_POINT_CLASS_NAME = cn("flex", "items-start", "gap-2");
export const CARD_POINT_DOT_CLASS_NAME = cn("mt-2", "h-1.5", "w-1.5", "shrink-0", "rounded-full", "bg-separator");
export const CARD_FOOT_CLASS_NAME = cn("mt-auto", "flex", "items-center", "justify-between", "gap-2", "pt-2");
