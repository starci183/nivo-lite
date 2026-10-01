import { cn } from "@heroui/react";

/** Vertical stack of the panel sections. */
export const EXECUTION_PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");

/** Content of the Execution card. */
export const EXECUTION_CARD_BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");

/** Stack of earlier settled executions. */
export const EXECUTION_EARLIER_LIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6", "px-4", "py-4");
