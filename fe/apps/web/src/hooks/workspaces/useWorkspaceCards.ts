"use client"

import { useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import { workspaceRoleOf, workspaceStateOf, type WorkspaceCardView } from "./workspaces.shared"

/** What the workspaces list readers get. */
interface WorkspaceCards {
    readonly read: ReturnType<typeof useQueryMyWorkspacesSwr>
    /** The status of the read with the usable workspaces once they arrived (`isEmpty` when the person has none). */
    readonly slot: DataSlot<ReadonlyArray<WorkspaceCardView>>
    readonly cards: ReadonlyArray<WorkspaceCardView>
    /** Reads the list again after a failure. */
    readonly reload: () => void
}

/** The signed-in person's usable workspaces as the screens draw them, read from the back end GraphQL API through SWR. */
export const useWorkspaceCards = (): WorkspaceCards => {
    const read = useQueryMyWorkspacesSwr()
    const cardsOf = (memberships: NonNullable<typeof read.data>): ReadonlyArray<WorkspaceCardView> =>
        memberships
            .filter((membership) => membership.member.status === "active")
            .map((membership): WorkspaceCardView => ({
                id: membership.workspace.id,
                name: membership.workspace.name,
                role: workspaceRoleOf(membership.member.role),
                state: workspaceStateOf(membership.workspace.status),
            }))
    const slot = mapSlot(slotOfSwr(read), cardsOf)
    const reload = () => void read.mutate()
    return { read, slot, cards: "items" in slot ? slot.items : [], reload }
}
