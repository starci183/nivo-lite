import { cn } from "@heroui/react";

/** Whole workbench: metrics strip above a three-pane inbox (GAP-4). */
export const WORKBENCH_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");

/* ---------- Inbox frame (inside a joined SurfaceCard, which owns face, corner and edge) ---------- */

/** The three panes, filling the joined card that FillViewport sizes. */
export const INBOX_CLASS_NAME = cn("relative", "flex", "h-full", "min-h-0", "min-w-0", "flex-1", "overflow-hidden");
/** Conversation list pane; one inline seam against the thread from md (BOUNDARY-4 case-3). */
const LIST_PANE_CLASS_NAME = cn("w-full", "min-w-0", "shrink-0", "flex-col", "border-separator", "md:w-80", "md:border-r");
export const LIST_PANE_OPEN_CLASS_NAME = cn(LIST_PANE_CLASS_NAME, "flex");
export const LIST_PANE_WIDE_ONLY_CLASS_NAME = cn(LIST_PANE_CLASS_NAME, "hidden", "md:flex");
/** Thread pane. */
const THREAD_PANE_CLASS_NAME = cn("min-w-0", "flex-1", "flex-col");
export const THREAD_PANE_OPEN_CLASS_NAME = cn(THREAD_PANE_CLASS_NAME, "flex");
export const THREAD_PANE_WIDE_ONLY_CLASS_NAME = cn(THREAD_PANE_CLASS_NAME, "hidden", "md:flex");
/** Customer pane: an overlay on narrow screens, a docked column from xl (SURFACE-2 face of the panel it covers; BOUNDARY-4 case-3 seam). */
const SIDE_PANE_CLASS_NAME = cn("absolute", "inset-0", "z-20", "flex-col", "overflow-y-auto", "bg-surface", "sm:left-auto", "sm:w-80", "sm:border-l", "sm:border-separator", "xl:static", "xl:z-auto", "xl:w-80", "xl:shrink-0");
export const SIDE_PANE_OPEN_CLASS_NAME = cn(SIDE_PANE_CLASS_NAME, "flex");
export const SIDE_PANE_DOCKED_ONLY_CLASS_NAME = cn(SIDE_PANE_CLASS_NAME, "hidden", "xl:flex");
/** Pane head band with its closing seam (BOUNDARY-1 case-2, PADDING-4 inline / PADDING-3 block). */
export const HEAD_CLASS_NAME = cn("flex", "min-h-16", "shrink-0", "items-center", "gap-3", "border-b", "border-separator", "px-4", "py-3");
export const HEAD_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col");
/** The back control, phones only. */
export const PHONE_ONLY_CLASS_NAME = cn("flex", "md:hidden");
/** The close control of the customer pane, until the pane docks at xl. */
export const UNTIL_DOCKED_CLASS_NAME = cn("xl:hidden");
/** A centred empty or waiting region filling its pane (PADDING-5 case-1). */
export const CENTER_CLASS_NAME = cn("flex", "flex-1", "items-center", "justify-center", "p-6");
/** Chips on one line (GAP-1: one identity). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-1");

/* ---------- Conversation list ---------- */

/** Search band (PADDING-3 inline, PADDING-3 top, PADDING-2 towards the filters). */
export const SEARCH_CLASS_NAME = cn("shrink-0", "px-3", "pt-3", "pb-2");
/** Filter band. */
export const FILTERS_CLASS_NAME = cn("shrink-0", "px-3", "pb-2");
/** The scrolling list body. */
export const LIST_BODY_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "overflow-y-auto", "px-2", "pb-2");

/* ---------- Thread ---------- */

/** The message scroll owner (GAP-3 between messages, PADDING-4). */
export const THREAD_SCROLL_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-3", "overflow-y-auto", "p-4");

/* ---------- Composer ---------- */

/** Composer band: its leading seam and inset (BOUNDARY-1 case-3, PADDING-4 inline, PADDING-3 block). */
export const COMPOSER_CLASS_NAME = cn("flex", "shrink-0", "flex-col", "gap-2", "border-t", "border-separator", "bg-surface", "px-4", "py-3");
/** Field and the action that submits it (GAP-2). */
export const COMPOSER_ROW_CLASS_NAME = cn("flex", "items-end", "gap-2");
export const COMPOSER_FIELD_CLASS_NAME = cn("min-w-0", "flex-1");

/* ---------- Side panel ---------- */

/** One side band with its trailing seam (BOUNDARY-2, PADDING-4). */
export const SIDE_SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "p-4");
export const CUSTOMER_HEAD_CLASS_NAME = cn("flex", "items-center", "gap-3");
/** The waiting escalation: a recessed band of its own (SURFACE-3 case-1). */
export const ESCALATION_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "bg-surface-secondary", "p-4");
/** The question and who it is assigned to (GAP-1). */
export const QUESTION_CLASS_NAME = cn("flex", "flex-col", "gap-1");
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
