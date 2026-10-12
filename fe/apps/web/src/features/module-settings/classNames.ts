import { cn } from "@heroui/react";

/** Two columns of settings cards from lg (GAP-5). */
export const GRID_CLASS_NAME = cn("grid", "min-w-0", "grid-cols-1", "items-start", "gap-6", "lg:grid-cols-2");
/** Blocks inside one card, and cards in one column (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");
/** The avatar beside the name field (GAP-3). */
export const ROW_CLASS_NAME = cn("flex", "min-w-0", "items-end", "gap-3");
/** The field takes the free width beside the avatar. */
export const GROW_CLASS_NAME = cn("min-w-0", "flex-1");
/** An action beside its companion action or status (GAP-3 case-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");
