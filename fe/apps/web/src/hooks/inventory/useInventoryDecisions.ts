import { useMemo } from "react"
import type { InventoryResult } from "@/hooks/inventoryCommands"

/** The decisions the owner takes on the inventory screens. */
export interface InventoryDecisions {
    /** Approves a waiting decision; an edited draft replaces the drafted message. */
    readonly approve: (workItemId: string, editedDraft: string | null) => Promise<InventoryResult<null>>
    /** Rejects a waiting decision with the note the screen names. */
    readonly reject: (workItemId: string, note: string) => Promise<InventoryResult<null>>
}

/** The Server Actions the connected block entry hands in. */
export interface DecisionActions {
    readonly approveWork: InventoryDecisions["approve"]
    readonly rejectWork: InventoryDecisions["reject"]
}

/** The approve and reject calls of the waiting decisions. */
export const useInventoryDecisions = (actions: DecisionActions): InventoryDecisions =>
    useMemo<InventoryDecisions>(
        () => ({ approve: actions.approveWork, reject: actions.rejectWork }),
        [actions.approveWork, actions.rejectWork],
    )
