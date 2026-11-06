"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFormatter, useNow, useTranslations } from "next-intl"
import { isWaitingOf, mapSlot, slotOfReads, slotOfSwr } from "@/hooks/slot"
import { useMember } from "@/hooks/member"
import { useQueryChatMessagesSwr, useQueryChatRoomsSwr, useQueryChatUnreadSwr } from "@/hooks/swr"
import type { ChatRoomsFilter } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { mutateCreateChatRoom } from "@/modules/api/graphql/mutations/mutation-create-chat-room"
import { mutateDecideChatApproval } from "@/modules/api/graphql/mutations/mutation-decide-chat-approval"
import { mutateMarkChatRoomRead } from "@/modules/api/graphql/mutations/mutation-mark-chat-room-read"
import { mutatePinChatMessage } from "@/modules/api/graphql/mutations/mutation-pin-chat-message"
import { mutateSendChatMessage } from "@/modules/api/graphql/mutations/mutation-send-chat-message"
import { mutateUnpinChatMessage } from "@/modules/api/graphql/mutations/mutation-unpin-chat-message"
import { queryChatMessages } from "@/modules/api/graphql/queries/query-chat-messages"
import type { DataSlot } from "@/modules/types"
import { CHAT_PAGE_SIZE, mentionsOfDraft } from "@/modules/teamChat"
import type { ChatParty, TeamChatMessageRow, TeamChatRoomRow, TeamChatVerdict } from "@/modules/teamChat"
import { messageRowsOf, partiesOf, roomRowsOf } from "./teamChat.shared"
import { useChatMutation } from "./useChatMutation"
import type { ChatMessageNode, ChatRowWords } from "./teamChat.shared"

/** What the chat is for: the whole page (every room of the viewer), or the panel of one agent (the direct room with it). */
export type TeamChatScope =
    | { readonly kind: "page"; readonly initialRoomId?: string }
    | { readonly kind: "agent"; readonly agentId: string }

/** Which messages the open room shows. */
export type TeamChatTab = "all" | "pinned"

/** The view `useTeamChat` returns. */
export interface TeamChatView {
    readonly roomsSlot: DataSlot<ReadonlyArray<TeamChatRoomRow>>
    readonly threadSlot: DataSlot<ReadonlyArray<TeamChatMessageRow>>
    /** Neither the rooms nor the open thread have data yet: every region draws its skeleton together. */
    readonly isWaiting: boolean
    readonly selectedId: string | null
    readonly selectedTitle: string
    /** Who a direct room is with: the mark of its head; null for a group or none open. */
    readonly selectedOther: ChatParty | null
    readonly memberCount: number
    readonly parties: ReadonlyArray<ChatParty>
    readonly tab: TeamChatTab
    readonly unreadTotal: number
    readonly hasOlder: boolean
    readonly isLoadingOlder: boolean
    readonly draft: string
    /** The refusal code of the last send, or "failed" for a transport failure; null when none. */
    readonly sendError: string | null
    readonly isSending: boolean
    readonly select: (roomId: string) => void
    readonly setTab: (tab: TeamChatTab) => void
    readonly setDraft: (value: string) => void
    readonly send: () => Promise<void>
    readonly loadOlder: () => Promise<void>
    readonly togglePin: (messageId: string, pinned: boolean) => Promise<void>
    readonly openDirect: (party: ChatParty) => Promise<string | null>
    readonly openGroup: (name: string, members: ReadonlyArray<ChatParty>) => Promise<string | null>
    readonly refreshAll: () => void
    /** Settles a decision from its card: the reason it was not settled (a refusal code, or "failed"), or null when it was. */
    readonly decide: (decisionId: string, verdict: TeamChatVerdict) => Promise<string | null>
}

/** The room a person asks to open: a direct room with one party, or a named group. */
interface NewRoom {
    readonly kind: "direct" | "group"
    readonly name?: string
    readonly members: ReadonlyArray<ChatParty>
}

/** The older pages of one room: the page cursor chain loaded by "earlier messages". */
interface OlderPages {
    readonly roomId: string
    readonly nodes: ReadonlyArray<ChatMessageNode>
    readonly cursor: string | null
    readonly hasNext: boolean
}

/** The filter of the rooms read for a scope. */
const filterOf = (scope: TeamChatScope): ChatRoomsFilter =>
    scope.kind === "agent" ? { kind: "direct", member: scope.agentId } : {}

/** The clocks and words a row needs, in the viewer's language. */
const useRowWords = (): ChatRowWords => {
    const t = useTranslations("teamChat")
    const format = useFormatter()
    const now = useNow({ updateInterval: 60_000 })
    return useMemo(
        () => ({
            now,
            timeOf: (iso: string) =>
                format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", hour12: false }),
            dateOf: (iso: string) => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" }),
            dateWithYearOf: (iso: string) =>
                format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric" }),
            today: t("dayToday"),
            yesterday: t("dayYesterday"),
            noMessage: t("noMessageYet"),
            attachment: t("attachmentLine"),
        }),
        [format, now, t],
    )
}

/**
 * The team chat of the active workspace: the viewer's rooms, the open room and its thread (newest page by polling, older pages on
 * demand), what the viewer sends, pins, and the rooms the viewer opens. `scope` page lists every room; `scope` agent follows the
 * viewer's direct room with one agent and opens it on the first message, never on a read.
 */
export const useTeamChat = (scope: TeamChatScope): TeamChatView => {
    const workspaceId = useWorkspaceId()
    const member = useMember()
    const viewerId = member?.userId ?? ""
    const words = useRowWords()
    const rooms = useQueryChatRoomsSwr(workspaceId, filterOf(scope))
    const unread = useQueryChatUnreadSwr(workspaceId)
    const [chosen, setChosen] = useState<string | null>(scope.kind === "page" ? (scope.initialRoomId ?? null) : null)
    const [tab, setTabState] = useState<TeamChatTab>("all")
    const [draft, setDraftState] = useState("")
    const [sendError, setSendError] = useState<string | null>(null)
    const [older, setOlder] = useState<OlderPages | null>(null)
    const [isLoadingOlder, setIsLoadingOlder] = useState(false)
    const roomNodes = useMemo(() => rooms.data ?? [], [rooms.data])
    const selected =
        scope.kind === "agent"
            ? roomNodes[0]
            : (roomNodes.find((room) => room.id === chosen) ?? (chosen === null ? roomNodes[0] : undefined))
    const selectedId = selected?.id ?? null
    const newest = useQueryChatMessagesSwr(
        workspaceId,
        selectedId === null ? undefined : { roomId: selectedId, ...(tab === "pinned" ? { pinnedOnly: true } : {}) },
    )
    const scopeId = workspaceId ?? ""
    const send = useChatMutation("chatSend", scopeId, mutateSendChatMessage, (data) => data.sendChatMessage)
    const create = useChatMutation("chatCreateRoom", scopeId, mutateCreateChatRoom, (data) => data.createChatRoom)
    const markRead = useChatMutation("chatMarkRead", scopeId, mutateMarkChatRoomRead, (data) => data.markChatRoomRead)
    const pin = useChatMutation("chatPin", scopeId, mutatePinChatMessage, (data) => data.pinChatMessage)
    const unpin = useChatMutation("chatUnpin", scopeId, mutateUnpinChatMessage, (data) => data.unpinChatMessage)
    const decideApproval = useChatMutation(
        "chatDecide",
        scopeId,
        mutateDecideChatApproval,
        (data) => data.decideChatApproval,
    )
    const { mutate: refreshRooms } = rooms
    const { mutate: refreshNewest } = newest
    const { mutate: refreshUnread } = unread
    const olderOfRoom = older !== null && older.roomId === selectedId && tab === "all" ? older : null
    const nodes = useMemo(
        () => [...(newest.data?.nodes ?? []), ...(olderOfRoom?.nodes ?? [])],
        [newest.data, olderOfRoom],
    )
    const lastMarked = useRef<string>("")
    const newestId = newest.data?.nodes[0]?.id ?? null
    const unreadCount = selected?.unreadCount ?? 0

    useEffect(() => {
        if (selectedId === null || newestId === null || unreadCount === 0 || tab !== "all") return
        const key = `${selectedId}:${newestId}:${unreadCount}`
        if (lastMarked.current === key) return
        lastMarked.current = key
        void markRead.trigger({ roomId: selectedId, messageId: newestId }).then(() => {
            void refreshRooms()
            void refreshUnread()
        })
    }, [markRead, newestId, refreshRooms, refreshUnread, selectedId, tab, unreadCount])

    const refreshAll = useCallback((): void => {
        void refreshRooms()
        void refreshNewest()
        void refreshUnread()
    }, [refreshNewest, refreshRooms, refreshUnread])

    const parties = useMemo(() => partiesOf(selected, viewerId), [selected, viewerId])

    const roomRows = useMemo(
        () => roomRowsOf(roomNodes, selectedId, viewerId, words),
        [roomNodes, selectedId, viewerId, words],
    )
    const threadRows = useMemo(() => messageRowsOf(nodes, viewerId, words), [nodes, viewerId, words])
    const roomsSlot = mapSlot(slotOfSwr(rooms), () => roomRows)
    const threadSlot =
        selectedId === null ? slotOfReads([rooms], () => threadRows) : mapSlot(slotOfSwr(newest), () => threadRows)
    const otherMember =
        selected?.kind === "direct"
            ? selected.members.find((entry) => !(entry.memberKind === "user" && entry.memberId === viewerId))
            : undefined

    const setDraft = useCallback((value: string): void => {
        setDraftState(value)
        setSendError(null)
    }, [])
    const select = useCallback((roomId: string): void => {
        setChosen(roomId)
        setTabState("all")
        setOlder(null)
        setSendError(null)
    }, [])
    const setTab = useCallback((next: TeamChatTab): void => {
        setTabState(next)
        setOlder(null)
    }, [])

    const sendDraft = async (): Promise<void> => {
        const body = draft.trim()
        if (body === "" || send.isMutating) return
        const mentions = mentionsOfDraft(draft, parties).map((party) => ({ memberKind: party.kind, memberId: party.id }))
        const clientId = crypto.randomUUID()
        const target =
            selectedId !== null
                ? { roomId: selectedId }
                : scope.kind === "agent"
                  ? { to: { memberKind: "agent" as const, memberId: scope.agentId } }
                  : null
        if (target === null) return
        try {
            const result = await send.trigger({ ...target, body, mentions, clientId })
            if (result.refusal !== null && result.refusal !== undefined) {
                setSendError(result.refusal)
                return
            }
            setDraftState("")
            setTabState("all")
            if (scope.kind === "page" && result.message !== null && result.message !== undefined)
                setChosen(result.message.roomId)
            refreshAll()
        } catch {
            setSendError("failed")
        }
    }

    const loadOlder = async (): Promise<void> => {
        if (selectedId === null || workspaceId === undefined || isLoadingOlder) return
        const cursor =
            olderOfRoom === null ? (newest.data?.pageInfo.endCursor ?? null) : olderOfRoom.cursor
        if (cursor === null) return
        setIsLoadingOlder(true)
        try {
            const result = await queryChatMessages({
                request: { roomId: selectedId, first: CHAT_PAGE_SIZE, after: cursor },
                headers: { "X-Workspace-Id": workspaceId },
            })
            const page = result.data?.chatMessages
            if (page === undefined) return
            setOlder({
                roomId: selectedId,
                nodes: [...(olderOfRoom?.nodes ?? []), ...page.nodes],
                cursor: page.pageInfo.endCursor ?? null,
                hasNext: page.pageInfo.hasNextPage,
            })
        } finally {
            setIsLoadingOlder(false)
        }
    }

    const togglePin = async (messageId: string, pinned: boolean): Promise<void> => {
        if (selectedId === null) return
        const mutation = pinned ? unpin : pin
        await mutation.trigger({ roomId: selectedId, messageId })
        void refreshNewest()
    }

    const openRoom = async (input: NewRoom): Promise<string | null> => {
        const result = await create.trigger({
            kind: input.kind,
            ...(input.name === undefined ? {} : { name: input.name }),
            members: input.members.map((party) => ({ memberKind: party.kind, memberId: party.id })),
        })
        if (result.room === null || result.room === undefined) return null
        setChosen(result.room.id)
        setTabState("all")
        setOlder(null)
        void refreshRooms()
        return result.room.id
    }

    const hasOlder =
        tab === "all" && selectedId !== null && (olderOfRoom === null ? newest.data?.pageInfo.hasNextPage === true : olderOfRoom.hasNext)

    return {
        roomsSlot,
        threadSlot,
        isWaiting: isWaitingOf(roomsSlot) || (selectedId !== null && isWaitingOf(threadSlot)),
        selectedId,
        selectedTitle: selected?.name ?? "",
        selectedOther:
            otherMember === undefined
                ? null
                : { kind: otherMember.memberKind === "agent" ? "agent" : "user", id: otherMember.memberId, name: otherMember.name },
        memberCount: selected?.members.length ?? 0,
        parties,
        tab,
        unreadTotal: unread.data?.total ?? 0,
        hasOlder,
        isLoadingOlder,
        draft,
        sendError,
        isSending: send.isMutating,
        select,
        setTab,
        setDraft,
        send: sendDraft,
        loadOlder,
        togglePin,
        openDirect: (party) => openRoom({ kind: "direct", members: [party] }),
        openGroup: (name, members) => openRoom({ kind: "group", name, members }),
        refreshAll,
        decide: async (decisionId, verdict) => {
            try {
                const result = await decideApproval.trigger({
                    decisionId,
                    verdict: verdict === "approved" ? "approve" : "reject",
                })
                return result.refusal ?? null
            } catch {
                return "failed"
            } finally {
                refreshAll()
            }
        },
    }
}
