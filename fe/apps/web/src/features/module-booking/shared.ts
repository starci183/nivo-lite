import { cn } from "@heroui/react";
import type { BadgeTone } from "@starci/grammar/common";
import { localHhmm } from "@/lib/module-booking-availability";

/** Badge tone per booking status (one place): the agenda, the detail dialog and the legend all read it. */
export const STATUS_TONE: Readonly<Record<string, BadgeTone>> = {
  requested: "warning",
  confirmed: "accent",
  rescheduled: "accent",
  done: "success",
  no_show: "danger",
  cancelled: "neutral",
};

/** Vertical rhythm of the workbench (GAP-4; PADDING-9 block inset at the compact step). */
export const PAGE = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
/** A stack of blocks inside one tab or surface (GAP-3). */
export const STACK = cn("flex", "min-w-0", "flex-col", "gap-3");
/** Regions of the setup tab, each with its own heading (GAP-4). */
export const REGIONS = cn("flex", "min-w-0", "flex-col", "gap-4");
/** A toolbar or an action line that wraps (GAP-2 case-3). */
export const ROW = cn("flex", "flex-wrap", "items-center", "gap-2");
/** A heading line with its peer content on the right (GAP-2). */
export const ROW_SPREAD = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2");
/** Form fields in two or three columns (GAP-3). */
export const GRID2 = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-3");
/** Form fields in two columns (GAP-3). */
export const GRID_PAIR = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2");
/** A field spanning the whole grid row. */
export const WIDE = cn("sm:col-span-2", "lg:col-span-3");
/** A field spanning two columns. */
export const WIDE2 = cn("sm:col-span-2");
/** One row of a collection inside a SurfaceListCard (BOUNDARY-2 case-1, PADDING-4 inline / PADDING-3 block). */
export const LIST_ROW = cn("flex", "flex-col", "gap-2", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "md:flex-row", "md:items-center", "md:justify-between");
/** The text column of a row (GAP-1). */
export const LIST_ROW_MAIN = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
/** A utilisation row: name with its meter, then the hours behind it (BOUNDARY-2 case-1, GAP-1). */
export const METER_ROW = cn("flex", "flex-col", "gap-1", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
/** One row of a list inside a surface that already owns its inset (BOUNDARY-1 case-2 leading seam, PADDING-2 block). */
export const PLAIN_ROW = cn("flex", "items-center", "justify-between", "gap-2", "border-t", "border-separator", "py-2");
/** Shown only on wide screens. */
export const WIDE_ONLY = cn("hidden", "md:flex");
/** Shown only on wide screens, as a block. */
export const WIDE_ONLY_BLOCK = cn("hidden", "md:flex", "md:flex-col", "md:gap-2");
/** Shown only on phones. */
export const PHONE_ONLY = cn("flex", "flex-col", "gap-3", "md:hidden");

export const hm = (ms: number, tz: string): string => localHhmm(ms, tz);
export const minutesOfDay = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const vnd = (n: number | null | undefined): string => (n === null || n === undefined ? "" : `${new Intl.NumberFormat("vi-VN").format(n)} ₫`);
export const WEEKDAY_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
/** "09:30" from a TimeValue-like object. */
export const hhmmOf = (v: { readonly hour: number; readonly minute: number }): string => `${String(v.hour).padStart(2, "0")}:${String(v.minute).padStart(2, "0")}`;

/* ---------- Calendar time grid ---------- */
// grammar gap: Common has no scheduler time grid (resource columns, hour rows, draggable positioned blocks). The grid stays
// app-owned on semantic tokens; its frame is a joined SurfaceCard and its sideways overflow a HorizontalScrollRegion.

/** The grid: at least 40rem wide so five columns stay readable. */
export const CAL_GRID = cn("flex", "min-w-160");
/** The sticky hour gutter (BOUNDARY-4 case-3 seam; SURFACE-2 face so it covers what scrolls under it). */
export const CAL_GUTTER = cn("sticky", "left-0", "z-20", "w-12", "shrink-0", "border-r", "border-separator", "bg-surface");
/** The empty corner above the gutter. */
export const CAL_CORNER = cn("h-12", "border-b", "border-separator");
/** A positioned box (hour labels, the body of a column). */
export const CAL_RELATIVE = cn("relative");
/** One hour label in the gutter. */
export const CAL_HOUR_LABEL = cn("absolute", "right-1", "-translate-y-2");
/** One column; columns are separated by a trailing inline seam (BOUNDARY-4, last drops it). */
export const CAL_COLUMN = cn("min-w-36", "flex-1", "border-r", "border-separator", "last:border-r-0");
/** A column head (BOUNDARY-1 case-2, PADDING-2 inline). */
export const CAL_HEAD = cn("flex", "h-12", "flex-col", "justify-center", "border-b", "border-separator", "px-2");
/** Today's head in the week view: the raised band (SURFACE-4 case-1). */
export const CAL_HEAD_TODAY = cn(CAL_HEAD, "bg-accent-soft", "text-accent-soft-foreground");
/** One hour line across a column. */
export const CAL_HOUR_LINE = cn("absolute", "inset-x-0", "border-t", "border-separator");
/** The now line. */
export const CAL_NOW_LINE = cn("pointer-events-none", "absolute", "inset-x-0", "z-10", "border-t-2", "border-danger");
/** A booking block: a recessed face with a status edge (RADIUS-4, PADDING-2 inline / PADDING-1 block). */
const CAL_BLOCK = ["absolute", "overflow-hidden", "rounded-lg", "border-l-4", "bg-surface-secondary", "px-2", "py-1", "text-left", "focus-visible:outline-2", "focus-visible:outline-focus"] as const;
/** The status edge of a block, on the same semantic tokens the badges use. */
export const CAL_BLOCK_BY_STATUS: Readonly<Record<string, ReturnType<typeof cn>>> = {
  requested: cn(...CAL_BLOCK, "border-warning"),
  confirmed: cn(...CAL_BLOCK, "border-accent"),
  rescheduled: cn(...CAL_BLOCK, "border-accent"),
  done: cn(...CAL_BLOCK, "border-success"),
  no_show: cn(...CAL_BLOCK, "border-danger"),
  cancelled: cn(...CAL_BLOCK, "border-separator", "line-through"),
};
export const CAL_BLOCK_FALLBACK = cn(...CAL_BLOCK, "border-separator");
/** A block that can be dragged. */
export const CAL_BLOCK_MOVABLE = cn("cursor-grab", "active:cursor-grabbing");
/** A request that does not hold its slot (stacked on another booking). */
export const CAL_BLOCK_TENTATIVE = cn("border-dashed", "opacity-80");

/* ---------- Public booking page ---------- */

/** The customer's form: one surface per step (GAP-4 case-3). */
export const PUBLIC_FORM = cn("flex", "min-w-0", "flex-col", "gap-4");
// grammar gap: no Common honeypot field; the bot trap stays a raw input, visually hidden and aria-hidden.
/** Hidden from people, present for bots. */
export const HONEYPOT = cn("sr-only");
