import { cn } from "@heroui/react";

/** Page regions (GAP-5). */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-6");
/** Blocks inside one card (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-4");
/** A named section: header above its collection (GAP-4). */
export const SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-4");
/** Renew action beside its hint (GAP-3 case-1). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");
/** The renew button over its failure notice (GAP-3). */
export const RENEW_CLASS_NAME = cn("flex", "flex-col", "items-start", "gap-3");
/** A sub-section of the usage card: heading over its content (GAP-3). */
export const USAGE_BLOCK_CLASS_NAME = cn("flex", "flex-col", "gap-3");
/** Usage-by-module rows inside the card: one parent declaration draws every seam (BOUNDARY-3); List owns the reset. */
export const MODULE_LIST_CLASS_NAME = cn("flex", "flex-col", "divide-y", "divide-separator");
/** One module row between separators (PADDING-3 case-3); outer rows meet the band edge (PADDING-0). */
export const MODULE_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2", "py-3", "first:pt-0", "last:pb-0");
/** One order / transfer row of a SurfaceListCard: trailing seam dropped on the last row (BOUNDARY-2 case-1), row inset PADDING-4 / PADDING-3. */
export const ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
/** Amount over its facts line inside a row (GAP-1). */
export const ROW_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");
// grammar gap: Common publishes no bar chart; the daily token chart stays an app-owned figure (role="img" with a text name) on semantic tokens only.
/** Chart track: bars side by side on the axis. */
export const CHART_CLASS_NAME = cn("flex", "h-24", "items-end", "gap-1");
/** One day's slot. */
export const BAR_SLOT_CLASS_NAME = cn("flex", "h-full", "min-w-0", "flex-1", "items-end");
/** A bar: block start rounded at the smallest ramp step because its end runs into the axis (RADIUS-2 corner variant). */
export const BAR_CLASS_NAME = cn("w-full", "rounded-t-sm", "bg-accent");
/** First and last day under the chart. */
export const CHART_AXIS_CLASS_NAME = cn("flex", "justify-between");
