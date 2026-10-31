"use client"

import { useCallback, useMemo } from "react"
import { isManager, useMember } from "@/hooks/member"
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
import type { OfficeBoard } from "@/hooks/office"
import {
    NIVO_AVATAR,
    acceptsCommands,
    mentionsOf,
    roomAgentsOf,
    roomApprovalsOf,
    roomOf,
    roomWorksOf,
    staffHandlesOf,
    waitingOf,
    withReceipt,
} from "@/modules/office"
import type { OfficeRoom, OfficeWaiting } from "@/modules/office"
import { useOfficePanels } from "./useOfficePanels"
import { useOfficeThreadView } from "./useOfficeThreadView"

/** Where the header chip jumps: the oldest thing that waits for a person's decision; none when nothing waits. */
const firstJumpOf = (waiting: ReadonlyArray<OfficeWaiting>): OfficeWaiting | null => waiting[0] ?? null

/** The board scoped to a room: the approvals of its agents and the exceptions of their departments. */
const scopedBoard = (full: OfficeBoard, current: OfficeRoom | null): OfficeBoard => ({
    ...full,
    pending: roomApprovalsOf(current, full.pending),
    decided: roomApprovalsOf(current, full.decided),
    exceptions: roomWorksOf(current, full.exceptions, full.agents),
    decidedCards: roomWorksOf(current, full.decidedCards, full.agents),
})

/** The lines the sender needs about a body: the agents it calls and, for an owner or manager, the one command the server reads. */
const useSendLine = (
    agents: OfficeBoard["agents"],
    sender: ReturnType<typeof useOfficeSend>,
    roomKey: string | null,
) => {
    const me = useMember()
    return useCallback(
        (body: string): Promise<boolean> => {
            const called = mentionsOf(body)
            const active = agents.filter((agent) => agent.isActive)
            const target = called.length === 1 ? active.find((agent) => agent.handle === called[0]) : undefined
            const canRead = isManager(me)
            return sender.send({
                body,
                room: roomKey,
                callNames: active.filter((agent) => called.includes(agent.handle)).map((agent) => agent.name),
                reading:
                    canRead && target !== undefined && acceptsCommands(target.module)
                        ? { handle: target.handle, module: target.module }
                        : null,
            })
        },
        [agents, me, sender, roomKey],
    )
}

/** The whole Office messenger for one Hub room (null = the Office room): its data, its words and its commands. */
export const useOfficeMessenger = (focusedId: string | null, roomKey: string | null, isThreadVisible: boolean) => {
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
    const knownIds = useMemo(() => new Set((thread.slot.items ?? []).map((line) => line.id)), [thread.slot.items])
    const sender = useOfficeSend(knownIds)
    const decisions = useOfficeDecisions()
    const current = roomOf(hub.rooms, roomKey)
    const roomAgents = roomAgentsOf(current, fullBoard.agents)
    const board = useMemo(() => scopedBoard(fullBoard, current), [fullBoard, current])
    const marker = hub.markers.get(roomKey ?? "")
    const fetched = thread.slot.items
    const messages = useMemo(
        () => (fetched === undefined ? undefined : withReceipt(fetched, marker)),
        [fetched, marker],
    )
    // One definition for the header chip and the "Needs your approval" column: approval cards and work items waiting for a decision.
    // A pending result card names one of them, so it is not counted again; a failed item is an exception, not a decision.
    const waiting = useMemo(() => waitingOf(board.pending, board.exceptions), [board.pending, board.exceptions])
    const waitingCount = waiting.length
    const items = useOfficeThreadView(messages, board, words, focusedId, decisions.alreadyIds, sender.outbox.length > 0)
    const panelRoom = useMemo(
        () => ({
            current,
            key: roomKey,
            rooms: hub.rooms,
            channels: hub.channels,
            agents: roomAgents,
            unread: hub.unread,
        }),
        [current, roomKey, hub.rooms, hub.channels, roomAgents, hub.unread],
    )
    const panels = useOfficePanels(messages ?? [], board, words, waitingCount, panelRoom)

    const send = useSendLine(board.agents, sender, roomKey)

    return {
        slot: thread.slot,
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
        setMuted: (muted: boolean) => hub.setMute(roomKey, muted),
        peersTyping: hub.peers.names,
        onDraft: hub.peers.onDraft,
        onDutyCount: roomAgents.filter((agent) => agent.isActive).length,
        reading:
            sender.reading === null
                ? null
                : {
                      avatar: NIVO_AVATAR,
                      ask: words.t("cmdAskReading", { handle: sender.reading.handle }),
                      agent: words.moduleName(sender.reading.module),
                  },
        chatbotHandle: board.agents.find((agent) => agent.module === "chatbot" && agent.isActive)?.handle ?? null,
        text: words.t,
        send,
        markConversationRead: hub.markConversationRead,
    }
}
