"use client"

import { useCallback } from "react"
import { isManager, useMember } from "@/hooks/member"
import { useOfficeBoard, useOfficeDecisions, useOfficeSend, useOfficeThread, useOfficeWords } from "@/hooks/office"
import { NIVO_AVATAR, acceptsCommands, mentionsOf } from "@/modules/office"
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

/** The whole Office messenger: its data, its words and its commands, ready for the block to draw. */
export const useOfficeMessenger = (focusedId: string | null) => {
    const words = useOfficeWords()
    const me = useMember()
    const thread = useOfficeThread()
    const board = useOfficeBoard()
    const sender = useOfficeSend()
    const decisions = useOfficeDecisions()
    const messages = thread.slot.items
    const waitingCount = board.pending.length + board.exceptions.length
    const items = useOfficeThreadView(messages, board, words, focusedId, decisions.alreadyIds)
    const panels = useOfficePanels(messages ?? [], board, words, waitingCount)

    const send = useCallback(
        (body: string): Promise<boolean> => {
            const called = mentionsOf(body)
            const active = board.agents.filter((agent) => agent.isActive)
            const target = called.length === 1 ? active.find((agent) => agent.handle === called[0]) : undefined
            const canRead = isManager(me)
            return sender.send({
                body,
                shouldPropose: canRead && called.length > 0,
                callNames: active.filter((agent) => called.includes(agent.handle)).map((agent) => agent.name),
                reading:
                    canRead && target !== undefined && acceptsCommands(target.module)
                        ? { handle: target.handle, module: target.module }
                        : null,
            })
        },
        [board.agents, me, sender],
    )

    const oldestPending = [...board.pending].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
    const linked = board.people.filter((person) => person.staffId !== null).length
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
        memberCount: board.agents.length + board.people.length + board.staff.length - linked,
        agentCount: board.agents.length,
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
    }
}
