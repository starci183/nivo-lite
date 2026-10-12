import { cn } from "@heroui/react";

/** Vertical stack of the panel sections (GAP-5: regions of the column). */
export const EXECUTION_PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");

/** Content of the Execution card (GAP-4: blocks inside one card). */
export const EXECUTION_CARD_BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");

/** Earlier approvals section: its header above the collection (GAP-4). */
export const EXECUTION_EARLIER_SECTION_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");

/** The earlier approval cards, one collection of peer cards (GAP-4 case-2); List owns the reset. */
export const EXECUTION_EARLIER_LIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");
