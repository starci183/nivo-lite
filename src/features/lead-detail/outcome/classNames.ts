import { cn } from "@heroui/react";

/** Blocks inside one card (GAP-4). */
export const STACK = cn("flex", "flex-col", "gap-4");
/** Record-outcome form, capped to the form measure. */
export const FORM_STACK = cn("flex", "flex-col", "gap-4", "max-w-md");
/** A heading and its content inside the card (GAP-2). */
export const EVIDENCE_STACK = cn("flex", "flex-col", "gap-2");
/** Recorded evidence rows: one parent declaration draws every seam (BOUNDARY-3); List owns the reset. */
export const EVIDENCE_LIST = cn("flex", "flex-col", "divide-y", "divide-separator");
/** One evidence row between separators (PADDING-3 case-3); outer rows meet the band edge (PADDING-0). */
export const EVIDENCE_ITEM = cn("flex", "flex-col", "gap-1", "py-3", "first:pt-0", "last:pb-0");
/** Kind word beside its source line (GAP-2). */
export const EVIDENCE_HEAD = cn("flex", "flex-wrap", "items-center", "gap-2");
/** One history entry: kind, summary and the evidence disclosure (GAP-1: lines of one entry). */
export const ENTRY_STACK = cn("flex", "min-w-0", "flex-col", "gap-1");
/** History section: header, timeline and audit note (GAP-4); leaves room when scrolled to. */
export const HISTORY_ANCHOR = cn("flex", "flex-col", "gap-4", "scroll-mt-6");
