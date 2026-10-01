import { cn } from "@heroui/react";

/** Vertical stack of the panel: the card and the muted previous list. */
export const PANEL_CLASS_NAME = cn("flex", "flex-col", "gap-4");

/** Bands inside the responsibility card. */
export const BODY_CLASS_NAME = cn("flex", "flex-col", "gap-6");

/** Title row: title on the left, status badge on the right. */
export const TITLE_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3");

/** Owner / due facts side by side, wrapping on narrow screens. */
export const FACTS_CLASS_NAME = cn("flex", "flex-wrap", "gap-6");

/** One labelled fact: muted label over its value. */
export const FACT_CLASS_NAME = cn("flex", "flex-col", "gap-2");

/** Owner identity: mark beside name and kind. */
export const OWNER_CLASS_NAME = cn("flex", "items-center", "gap-3");

/** Name over its kind label. */
export const OWNER_COPY_CLASS_NAME = cn("flex", "flex-col");

/** Due date beside the overdue badge. */
export const DUE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");

/** Action row under the facts. */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");

/** Inline form, capped to the form measure. */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-4", "max-w-xl");

/** Previous responsibilities list. */
export const PREVIOUS_CLASS_NAME = cn("flex", "flex-col", "gap-2");

/** Owner block: tinted nested band with identity and accountable label. */
export const OWNER_BAND_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-4", "rounded-xl", "bg-surface-secondary", "px-4", "py-3");

/** Next action focal block. */
export const FOCAL_CLASS_NAME = cn("flex", "flex-col", "gap-2");
