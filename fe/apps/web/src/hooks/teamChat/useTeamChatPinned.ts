"use client"

import { useMemo, useSyncExternalStore } from "react"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryChatMessagesSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { PendingTaps } from "@/modules/teamChat"
import type { DataSlot, TeamChatMessageRow } from "@/modules/types"
import { messageRowsOf } from "./teamChat.messages"
import { useChatRowWords } from "./useChatRowWords"
import { useTeamChatReportHref } from "./useTeamChatReportHref"

/** The view `useTeamChatPinned` returns. */
export interface TeamChatPinnedView {
    readonly slot: DataSlot<ReadonlyArray<TeamChatMessageRow>>
    /** The rows once read, for what is done with a row (the reply quotes one). */
    readonly rows: ReadonlyArray<TeamChatMessageRow>
    readonly refresh: () => void
}

/** The pinned messages of the open room, read only while the panel that lists them is open. */
export const useTeamChatPinned = (
    roomId: string | null,
    viewerId: string,
    isOpen: boolean,
    pending: PendingTaps,
): TeamChatPinnedView => {
    const workspaceId = useWorkspaceId()
    const words = useChatRowWords()
    const workHref = useTeamChatReportHref()
    const pages = useQueryChatMessagesSwr(
        workspaceId,
        roomId === null || !isOpen ? undefined : { roomId, pinnedOnly: true },
        {},
    )
    const taps = useSyncExternalStore(pending.subscribe, pending.snapshot, pending.snapshot)
    const { data, mutate } = pages
    const rows = useMemo(
        () => messageRowsOf((data ?? []).flatMap((page) => page.nodes), viewerId, words, workHref, taps),
        [data, viewerId, words, workHref, taps],
    )
    return { slot: mapSlot(slotOfSwr(pages), () => rows), rows, refresh: () => void mutate() }
}
