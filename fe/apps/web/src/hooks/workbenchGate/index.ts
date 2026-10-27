import type { DataSlot } from "@/modules/types"

/** Where a workbench gate stands: its blocks can draw, their data is being read, the read failed, or the blocks are not for this reader. */
export type WorkbenchGateState = "ready" | "pending" | "failed" | "hidden"

/**
 * Folds a gate's state into the slot its block draws through SlotView. A gate that holds a primary panel says a failed read in place;
 * a gate around a secondary card hides on failure, as the card has no panel to put the notice in.
 */
export const workbenchGateSlot = (state: WorkbenchGateState, isPrimary: boolean): DataSlot<true> => {
    if (state === "ready") return { items: true }
    if (state === "pending") return { isLoading: true }
    if (state === "failed" && isPrimary) return { isError: true }
    return { isForbidden: true }
}
