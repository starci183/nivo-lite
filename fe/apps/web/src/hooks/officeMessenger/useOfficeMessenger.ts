"use client"

import { useMemo } from "react"
import { useMember } from "@/hooks/member"
import { useSubscribeOfficeActivitySwr } from "@/hooks/swr"
import {
    useOfficeBoard,
    useOfficeDecisions,
    useOfficeReceipts,
    useOfficeRooms,
    useOfficeSend,
    useOfficeThread,
    useOfficeWords,
} from "@/hooks/office"
import { roomAgentsOf, roomOf, staffHandlesOf, withReceipt } from "@/modules/office"
import type { ChatFileAddress, ChatFileProblem, UploadedChatFile } from "@/hooks/chatFile"
import type { OfficeRead, ReadingAgent, SendPlan } from "@/hooks/office"
import type { OfficeMessage, OfficeWaiting } from "@/modules/office"
import type {
    OfficeThreadItem,
    DataSlot,
    OfficeOutboxView,
    OfficeWorkDecision,
    OfficeListView,
    OfficeInfoView,
    OfficeTaskView,
    OfficeMentionView,
    OfficeAvatarView,
    OfficeText,
} from "@/modules/types"
import { useOfficeThreadView } from "./useOfficeThreadView"
import { officeReadSlots, readingOf, scopedBoard } from "./officeMessenger.shared"
import { useOfficePanelBundle } from "./useOfficePanelBundle"
import { useOfficeSendLine } from "./useOfficeSendLine"

/** The loading command as the thread draws it: who is reading, in which words. */
export interface OfficeMessengerReading {
    readonly avatar: OfficeAvatarView
    readonly ask: string
    readonly agent: string
    readonly label: string
    readonly gateNote: string
}

/** What `useOfficeMessenger` returns. */
type UseOfficeMessengerResult = {
    items: readonly OfficeThreadItem[]
    thread: {
        readonly slot: DataSlot<ReadonlyArray<OfficeMessage>>
        readonly read: OfficeRead<ReadonlyArray<OfficeMessage>>
        readonly reload: () => void
        readonly hasEarlier: boolean
        readonly isLoadingEarlier: boolean
        readonly loadEarlier: () => void
    }
    sender: {
        send: (plan: SendPlan) => Promise<boolean>
        dismissFailed: () => void
        outbox: readonly OfficeOutboxView[]
        typing: string | null
        reading: ReadingAgent | null
        isSending: boolean
        fileControl: {
            accept: string
            file: File | null
            problem: ChatFileProblem | null
            choose: (chosen: File) => void
            clear: () => void
            upload: (
                addressOf: (chosen: File) => Promise<ChatFileAddress | undefined>,
            ) => Promise<UploadedChatFile | null | undefined>
        }
    }
    decisions: {
        busyId: string | null
        alreadyIds: readonly string[]
        decideApproval: (
            executionId: string,
            decision: "approved" | "rejected",
            editedDraft: string | null,
        ) => Promise<void>
        decideWork: (workItemId: string, choice: OfficeWorkDecision) => Promise<void>
        confirmCommand: (candidateId: string) => Promise<void>
        cancelCommand: (candidateId: string) => Promise<void>
    }
    panels: {
        list: OfficeListView
        info: OfficeInfoView
        tasks: readonly OfficeTaskView[]
        mentions: readonly OfficeMentionView[]
    }
    waitingCount: number
    firstJump: OfficeWaiting | null
    taskCount: number
    memberCount: number
    agentCount: number
    roomTitle: string | null
    isMuted: boolean
    setMuted: (muted: boolean) => Promise<void>
    peersTyping: string[]
    onDraft: (draft: string) => void
    onDutyCount: number
    reading: OfficeMessengerReading | null
    chatbotHandle: string | null
    text: OfficeText
    send: (body: string) => Promise<boolean>
    markConversationRead: (kind: "agent" | "lead", id: string) => Promise<void>
    slot: DataSlot<readonly OfficeMessage[]>
    listSlot: DataSlot<OfficeListView>
    threadSlot: DataSlot<boolean>
    composerSlot: DataSlot<boolean>
    retryList: () => void
    retryThread: () => void
    retryComposer: () => void
}

/** Where the header chip jumps: the oldest thing that waits for a person's decision; none when nothing waits. */
const firstJumpOf = (waiting: ReadonlyArray<OfficeWaiting>): OfficeWaiting | null => waiting[0] ?? null

/** The whole Office messenger for one Hub room (null = the Office room): its data, its words and its commands. */
export const useOfficeMessenger = (
    focusedId: string | null,
    roomKey: string | null,
    isThreadVisible: boolean,
): UseOfficeMessengerResult => {
    const me = useMember()
    useSubscribeOfficeActivitySwr()
    const words = useOfficeWords()
    const fullBoard = useOfficeBoard()
    const handles = staffHandlesOf(
        fullBoard.staff,
        fullBoard.agents.map((agent) => agent.handle),
    )
    const hub = useOfficeRooms(roomKey, {
        name: me?.name ?? null,
        handle: me?.staffId == null ? null : (handles.get(me.staffId) ?? null),
    })
    const receipts = useOfficeReceipts(roomKey, isThreadVisible, hub.refreshRooms)
    const thread = useOfficeThread(roomKey, receipts.onFetched)
    const knownIds = useMemo(() => new Set(thread.read.data?.map((line) => line.id)), [thread.read.data])
    const sender = useOfficeSend(knownIds)
    const decisions = useOfficeDecisions()
    const current = roomOf(hub.rooms, roomKey)
    const roomAgents = roomAgentsOf(current, fullBoard.agents)
    const board = useMemo(() => scopedBoard(fullBoard, current), [fullBoard, current])
    const marker = hub.markers.get(roomKey ?? "")
    const fetched = thread.read.data
    const messages = useMemo(
        () => (fetched === undefined ? undefined : withReceipt(fetched, marker)),
        [fetched, marker],
    )
    const { waiting, panels } = useOfficePanelBundle(messages, board, words, current, roomKey, hub, roomAgents)
    const waitingCount = waiting.length
    const items = useOfficeThreadView(messages, board, words, focusedId, decisions.alreadyIds, sender.outbox.length > 0)

    const send = useOfficeSendLine(board.agents, sender, roomKey)

    return {
        ...officeReadSlots({ board: fullBoard, hub, thread, list: panels.list }),
        items,
        thread,
        sender,
        decisions,
        panels,
        waitingCount,
        firstJump: firstJumpOf(waiting),
        taskCount: board.tasks.length,
        memberCount: panels.info.members.length,
        agentCount: roomAgents.length,
        roomTitle: current === null ? null : current.name,
        isMuted: marker?.muted ?? false,
        setMuted: (muted: boolean): Promise<void> => hub.setMute(roomKey, muted),
        peersTyping: hub.peers.names,
        onDraft: hub.peers.onDraft,
        onDutyCount: roomAgents.filter((agent) => agent.isActive).length,
        reading: readingOf(sender.reading, words),
        chatbotHandle: board.agents.find((agent) => agent.module === "chatbot" && agent.isActive)?.handle ?? null,
        text: words.t,
        send,
        markConversationRead: hub.markConversationRead,
    }
}
