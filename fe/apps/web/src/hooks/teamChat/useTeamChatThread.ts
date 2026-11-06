"use client"

import { useCallback, useMemo, useRef } from "react"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useNow } from "next-intl"
import { useMutateMarkChatRoomReadSwr, useQueryChatMessagesSwr, useSubscribeChatTypingSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { DataSlot, TeamChatMessageRow } from "@/modules/types"
import { messageRowsOf } from "./teamChat.shared"
import { useChatRowWords } from "./useChatRowWords"
import { useTeamChatReportHref } from "./useTeamChatReportHref"

/** Which messages the open room shows. */
export type TeamChatTab = "all" | "pinned"

/** What the thread needs to know about the open room. */
interface TeamChatThreadInput {
    readonly roomId: string | null
    readonly viewerId: string
    readonly tab: TeamChatTab
    /** How many messages of the room the viewer has not read: while it is above zero the newest page is marked read. */
    readonly unreadCount: number
    /** Reads the rooms and the unread counts again (after a room was marked read). */
    readonly onRead: () => void
}

/** The view `useTeamChatThread` returns. */
export interface TeamChatThreadView {
    readonly slot: DataSlot<ReadonlyArray<TeamChatMessageRow>>
    readonly hasOlder: boolean
    readonly isLoadingOlder: boolean
    /** The names of the people typing in the room now. */
    readonly typing: ReadonlyArray<string>
    readonly loadOlder: () => void
    readonly refresh: () => void
}

/** How often a typing hint is checked for having lapsed (milliseconds). */
const LAPSE_CHECK_MS = 1000

/** The newest page of messages a read hands over: only its newest message matters to the marking as read. */
interface NewestPage {
    readonly nodes: ReadonlyArray<{ readonly id: string }>
}

/** The thread of the open room: its pages (the newest follows the room by polling), the marking of it as read, and who is typing. */
export const useTeamChatThread = (input: TeamChatThreadInput): TeamChatThreadView => {
    const workspaceId = useWorkspaceId()
    const words = useChatRowWords()
    const reportHref = useTeamChatReportHref()
    const markRead = useMutateMarkChatRoomReadSwr(workspaceId ?? "")
    const hints = useSubscribeChatTypingSwr(input.roomId)
    const now = useNow({ updateInterval: LAPSE_CHECK_MS })
    const marked = useRef("")
    const { roomId, unreadCount, onRead, tab } = input
    const { trigger } = markRead
    const onNewestPage = useCallback(
        (page: NewestPage): void => {
            const newest = page.nodes[0]
            if (roomId === null || newest === undefined || unreadCount === 0 || tab !== "all") return
            const key = `${roomId}:${newest.id}:${unreadCount}`
            if (marked.current === key) return
            marked.current = key
            void trigger({ roomId, messageId: newest.id }).then(onRead)
        },
        [onRead, roomId, tab, trigger, unreadCount],
    )
    const pages = useQueryChatMessagesSwr(
        workspaceId,
        roomId === null ? undefined : { roomId, pinnedOnly: tab === "pinned" },
        { onNewestPage },
    )
    const { data, size, setSize, mutate } = pages
    const nodes = useMemo(() => (data ?? []).flatMap((page) => page.nodes), [data])
    const rows = useMemo(
        () => messageRowsOf(nodes, input.viewerId, words, reportHref),
        [nodes, input.viewerId, words, reportHref],
    )
    const last = data?.at(-1)
    return {
        slot: mapSlot(slotOfSwr(pages), () => rows),
        hasOlder: last?.pageInfo.hasNextPage === true,
        isLoadingOlder: pages.isValidating && size > (data?.length ?? 0),
        typing: Object.values(hints.data ?? {})
            .filter((hint) => new Date(hint.expiresAt).getTime() > now.getTime())
            .map((hint) => hint.name),
        loadOlder: () => void setSize(size + 1),
        refresh: () => void mutate(),
    }
}
