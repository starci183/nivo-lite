import { useMemo } from "react"
import { useMutateDecideWorkItemSwr } from "@/hooks/swr/api/graphql/mutations/useMutateDecideWorkItemSwr"

/** The decisions the owner takes on the inventory screens. */
export interface InventoryDecisions {
    /** Approves a waiting decision; an edited draft replaces the drafted message. */
    readonly approve: (workItemId: string, editedDraft: string | null) => Promise<null>
    /** Rejects a waiting decision with the note the screen names. */
    readonly reject: (workItemId: string, note: string) => Promise<null>
}

/** The approve and reject calls of the waiting decisions through `decideWorkItem`. */
export const useInventoryDecisions = (): InventoryDecisions => {
    const { trigger } = useMutateDecideWorkItemSwr()
    return useMemo<InventoryDecisions>(
        () => ({
            approve: async (workItemId, editedDraft) => {
                await trigger({
                    workItemId,
                    decision: "approved",
                    ...(editedDraft === null ? {} : { edits: { draft: editedDraft } }),
                })
                return null
            },
            reject: async (workItemId, note) => {
                await trigger({ workItemId, decision: "rejected", note })
                return null
            },
        }),
        [trigger],
    )
}
