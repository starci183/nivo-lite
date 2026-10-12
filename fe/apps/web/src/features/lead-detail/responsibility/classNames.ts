import { cn } from "@heroui/react";

/** Vertical stack of the panel: the card and the earlier-steps section (GAP-4). */
export const PANEL_CLASS_NAME = cn("flex", "flex-col", "gap-4");

/** Bands inside the responsibility card (GAP-5: blocks with distinct jobs). */
export const BODY_CLASS_NAME = cn("flex", "flex-col", "gap-6");

/** Title row: title on the left, status badge on the right (GAP-3). */
export const TITLE_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3");

/** Owner identity beside the due fact inside the nested owner card (GAP-4). */
export const OWNER_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-4");

/** Owner identity: mark beside name and kind (GAP-3). */
export const OWNER_CLASS_NAME = cn("flex", "items-center", "gap-3");

/** Name over its kind label: two lines of one identity (GAP-1). */
export const OWNER_COPY_CLASS_NAME = cn("flex", "flex-col", "gap-1");

/** Due date beside the overdue badge (GAP-2). */
export const DUE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");

/** Action row under the facts (GAP-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");

/** Inline form, capped to the form measure. */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-4", "max-w-xl");

/** Earlier-steps section: header above its timeline (GAP-4). */
export const PREVIOUS_CLASS_NAME = cn("flex", "flex-col", "gap-4");

/** Next action focal block: eyebrow over the action (GAP-1). */
export const FOCAL_CLASS_NAME = cn("flex", "flex-col", "gap-1");
