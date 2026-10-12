import { cn } from "@heroui/react";

/** The frame's regions, top to bottom (GAP-6 between page regions). */
export const FRAME_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");
/** Breadcrumbs above the heading, one heading block (GAP-2). */
export const HEAD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2");
/** The three side regions (done, connections, knowledge) side by side from lg, stacked below (GAP-4 between peer cards). */
export const SIDE_GRID_CLASS_NAME = cn("grid", "min-w-0", "grid-cols-1", "gap-4", "lg:grid-cols-3");
/** One column of the side grid: its cards stacked (GAP-4). */
export const SIDE_COLUMN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");
/** The module's own content under the tab strip (GAP-4). */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");
/** Footer of a card: its lines stacked (GAP-1: qualifiers of one block). */
export const FOOT_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");
