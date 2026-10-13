import { useMemo } from "react"
import type { InventoryResult } from "@/hooks/inventoryCommands"

/** The decisions the owner takes on the inventory screens. */
export interface InventoryDecisions {
    /** Approves a waiting decision; an edited draft replaces the drafted message. */
    readonly approve: (workItemId: string, editedDraft: string | null) => Promise<InventoryResult<null>>
    /** Rejects a waiting decision with the note the screen names. */
    readonly reject: (workItemId: string, note: string) => Promise<InventoryResult<null>>
}

/** The Server Actions the connected block entry hands in: each takes one decision object. */
export interface DecisionActions {
    readonly approveWork: (decision: {
        readonly workItemId: string
        readonly note: string | null
    }) => Promise<InventoryResult<null>>
    readonly rejectWork: (decision: {
        readonly workItemId: string
        readonly note: string | null
    }) => Promise<InventoryResult<null>>
}

/** The approve and reject calls of the waiting decisions. */
export const useInventoryDecisions = (actions: DecisionActions): InventoryDecisions =>
    useMemo<InventoryDecisions>(
        () => ({
            approve: (workItemId, editedDraft) => actions.approveWork({ workItemId, note: editedDraft }),
            reject: (workItemId, note) => actions.rejectWork({ workItemId, note }),
        }),
        [actions],
    )
