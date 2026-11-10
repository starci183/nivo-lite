"use client"

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useNow } from "next-intl"
import { useMutateMarkChatRoomReadSwr, useQueryChatMessagesSwr, useSubscribeChatTypingSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { PendingTaps } from "@/modules/teamChat"
import type { DataSlot, TeamChatMessageRow, TeamChatReactionView } from "@/modules/types"
import { messageRowsOf } from "./teamChat.messages"
import { useChatRowWords } from "./useChatRowWords"
import { useTeamChatReportHref } from "./useTeamChatReportHref"

/** What the thread needs to know about the open room. */
interface TeamChatThreadInput {
    readonly roomId: string | null
    readonly viewerId: string
    /** How many messages of the room the viewer has not read: while it is above zero the newest page is marked read. */
    readonly unreadCount: number
    /** Reads the rooms and the unread counts again (after a room was marked read). */
    readonly onRead: () => void
    /** The taps of the viewer the door has not confirmed yet: laid over the reactions the thread read. */
    readonly pending: PendingTaps
}

/** The view `useTeamChatThread` returns. */
export interface TeamChatThreadView {
    readonly slot: DataSlot<ReadonlyArray<TeamChatMessageRow>>
    /** The rows once read, for what is done with a row (the reply quotes one). */
    readonly rows: ReadonlyArray<TeamChatMessageRow>
    readonly hasOlder: boolean
    readonly isLoadingOlder: boolean
    /** The names of the people typing in the room now. */
    readonly typing: ReadonlyArray<string>
    readonly loadOlder: () => void
    readonly refresh: () => void
    /** Writes the reactions the door answered for one message into the pages read, without reading them again. */
    readonly setReactions: (messageId: string, reactions: ReadonlyArray<TeamChatReactionView>) => void
}

/** How often a typing hint is checked for having lapsed (milliseconds). */
const LAPSE_CHECK_MS = 1000

/** A message with the reactions the door answered written in. */
const withReactions = <N extends object>(node: N, reactions: ReadonlyArray<TeamChatReactionView>): N => ({
    ...node,
    reactions: reactions.map((reaction) => ({
        emoji: reaction.emoji,
        count: reaction.count,
        mine: reaction.mine > 0,
        mineCount: reaction.mine,
    })),
})

/** The newest page of messages a read hands over: only its newest message matters to the marking as read. */
interface NewestPage {
    readonly nodes: ReadonlyArray<{ readonly id: string }>
}

/** The thread of the open room: its pages (the newest follows the room by polling), the marking of it as read, and who is typing. */
export const useTeamChatThread = (input: TeamChatThreadInput): TeamChatThreadView => {
    const workspaceId = useWorkspaceId()
    const words = useChatRowWords()
    const workHref = useTeamChatReportHref()
    const markRead = useMutateMarkChatRoomReadSwr(workspaceId ?? "")
    const hints = useSubscribeChatTypingSwr(input.roomId)
    const now = useNow({ updateInterval: LAPSE_CHECK_MS })
    const marked = useRef("")
    const taps = useSyncExternalStore(input.pending.subscribe, input.pending.snapshot, input.pending.snapshot)
    const { roomId, unreadCount, onRead } = input
    const { trigger } = markRead
    const onNewestPage = useCallback(
        (page: NewestPage): void => {
            const newest = page.nodes[0]
            if (roomId === null || newest === undefined || unreadCount === 0) return
            const key = `${roomId}:${newest.id}:${unreadCount}`
            if (marked.current === key) return
            marked.current = key
            void trigger({ roomId, messageId: newest.id }).then(onRead)
        },
        [onRead, roomId, trigger, unreadCount],
    )
    const pages = useQueryChatMessagesSwr(
        workspaceId,
        roomId === null ? undefined : { roomId, pinnedOnly: false },
        { onNewestPage },
    )
    const { data, size, setSize, mutate } = pages
    const nodes = useMemo(() => (data ?? []).flatMap((page) => page.nodes), [data])
    const rows = useMemo(
        () => messageRowsOf(nodes, input.viewerId, words, workHref, taps),
        [nodes, input.viewerId, words, workHref, taps],
    )
    const last = data?.at(-1)
    return {
        slot: mapSlot(slotOfSwr(pages), () => rows),
        rows,
        hasOlder: last?.pageInfo.hasNextPage === true,
        isLoadingOlder: pages.isValidating && size > (data?.length ?? 0),
        typing: Object.values(hints.data ?? {})
            .filter((hint) => new Date(hint.expiresAt).getTime() > now.getTime())
            .map((hint) => hint.name),
        loadOlder: () => void setSize(size + 1),
        refresh: () => void mutate(),
        setReactions: (messageId, reactions) =>
            void mutate(
                (pagesRead) =>
                    pagesRead?.map((page) => ({
                        ...page,
                        nodes: page.nodes.map((node) => (node.id === messageId ? withReactions(node, reactions) : node)),
                    })),
                { revalidate: false },
            ),
    }
}
