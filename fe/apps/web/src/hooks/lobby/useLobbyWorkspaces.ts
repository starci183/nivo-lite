"use client"

import { useLocale } from "next-intl"
import { useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { slotOfReads } from "@/hooks/slot"
import { useLobbyJoinedStore } from "@/hooks/zustand/lobbyJoined"
import type { DataSlot } from "@/modules/types"
import { lobbyWorkspacesOf } from "./lobby.shared"
import type { LobbyWorkspace } from "./lobby.shared"

/** What the lobby list readers get. */
export interface LobbyWorkspaces {
    /** The read as a slot: loading, failed, empty, or the rows. */
    readonly slot: DataSlot<ReadonlyArray<LobbyWorkspace>>
    /** The rows answered so far (empty while loading). */
    readonly rows: ReadonlyArray<LobbyWorkspace>
    /** Reads the list again after a failure. */
    readonly reload: () => void
}

/**
 * Every workspace of the signed-in person as the lobby draws it, read from `myWorkspaces`: active, unpaid and switched-off seats alike,
 * each with its plan, people and last open, the one just joined on top as "new", the one opened last carrying the primary action.
 */
export const useLobbyWorkspaces = (): LobbyWorkspaces => {
    const locale = useLocale()
    const joinedId = useLobbyJoinedStore((state) => state.joinedId)
    const read = useQueryMyWorkspacesSwr()
    const rows = lobbyWorkspacesOf(read.data ?? [], locale, joinedId)
    return {
        slot: slotOfReads([read], () => (read.data === undefined ? undefined : rows)),
        rows,
        reload: () => void read.mutate(),
    }
}
