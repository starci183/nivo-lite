"use client"

import { useCallback, useMemo } from "react"
import { isManager, useMember } from "@/hooks/member"
import {
    useOfficeBoard,
    useOfficeDecisions,
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
} from "@/modules/office"
import type { OfficeRoom } from "@/modules/office"
import { useOfficePanels } from "./useOfficePanels"
import { useOfficeThreadView } from "./useOfficeThreadView"

/** Where the header chip jumps: the oldest thing that waits for a person. */
interface FirstJump {
    readonly kind: "approval" | "exception"
    readonly id: string
}

interface Waiting {
    readonly id: string
    readonly createdAt: string
}

const firstJumpOf = (approval: Waiting | undefined, exception: Waiting | undefined): FirstJump | null => {
    if (approval !== undefined && (exception === undefined || approval.createdAt <= exception.createdAt)) {
        return { kind: "approval", id: approval.id }
    }
    return exception === undefined ? null : { kind: "exception", id: exception.id }
}

/** The board scoped to a room: the approvals of its agents and the exceptions of their departments. */
const scopedBoard = (full: OfficeBoard, current: OfficeRoom | null): OfficeBoard => ({
    ...full,
    pending: roomApprovalsOf(current, full.pending),
    decided: roomApprovalsOf(current, full.decided),
    exceptions: roomWorksOf(current, full.exceptions, full.agents),
    decidedCards: roomWorksOf(current, full.decidedCards, full.agents),
})

/** The whole Office messenger for one Hub room (null = the Office room): its data, its words and its commands. */
export const useOfficeMessenger = (focusedId: string | null, roomKey: string | null) => {
    const words = useOfficeWords()
    const me = useMember()
    const thread = useOfficeThread(roomKey)
    const hub = useOfficeRooms(roomKey)
    const fullBoard = useOfficeBoard()
    const sender = useOfficeSend()
    const decisions = useOfficeDecisions()
    const current = roomOf(hub.rooms, roomKey)
    const roomAgents = roomAgentsOf(current, fullBoard.agents)
    const board = useMemo(() => scopedBoard(fullBoard, current), [fullBoard, current])
    const messages = thread.slot.items
    const pendingCards = (messages ?? []).filter((line) => line.card !== null && line.cardState === "pending").length
    const waitingCount = board.pending.length + board.exceptions.length + pendingCards
    const items = useOfficeThreadView(messages, board, words, focusedId, decisions.alreadyIds)
    const panelRoom = useMemo(
        () => ({ current, key: roomKey, rooms: hub.rooms, channels: hub.channels, agents: roomAgents }),
        [current, roomKey, hub.rooms, hub.channels, roomAgents],
    )
    const panels = useOfficePanels(messages ?? [], board, words, waitingCount, panelRoom)

    const send = useCallback(
        (body: string): Promise<boolean> => {
            const called = mentionsOf(body)
            const active = board.agents.filter((agent) => agent.isActive)
            const target = called.length === 1 ? active.find((agent) => agent.handle === called[0]) : undefined
            const canRead = isManager(me)
            return sender.send({
                body,
                room: roomKey,
                shouldPropose: canRead && called.length > 0,
                callNames: active.filter((agent) => called.includes(agent.handle)).map((agent) => agent.name),
                reading:
                    canRead && target !== undefined && acceptsCommands(target.module)
                        ? { handle: target.handle, module: target.module }
                        : null,
            })
        },
        [board.agents, me, sender, roomKey],
    )

    const oldestPending = [...board.pending].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
    return {
        slot: thread.slot,
        items,
        thread,
        sender,
        decisions,
        panels,
        waitingCount,
        firstJump: firstJumpOf(oldestPending, board.exceptions[0]),
        taskCount: board.tasks.length,
        memberCount: panels.info.members.length,
        agentCount: roomAgents.length,
        roomTitle: current === null ? null : current.name,
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
        markRead: hub.markRead,
    }
}
