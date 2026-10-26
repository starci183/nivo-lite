"use client"

import { useMemo } from "react"
import { useMember } from "@/hooks/member"
import { contextOf } from "@/hooks/office"
import type { OfficeBoard } from "@/hooks/office"
import {
    infoViewOf,
    officeListTimeOf,
    officeListViewOf,
    mentionOptionsOf,
    pendingCardRowsOf,
    roomChannelsOf,
    roomPinsOf,
    roomRowsOf,
    staffHandlesOf,
    taskViewsOf,
} from "@/modules/office"
import type {
    OfficeAgent,
    OfficeChannelWire,
    OfficeConversationUnread,
    OfficeMessage,
    OfficeRoom,
    OfficeWords,
} from "@/modules/office"

/** The room on screen and the Hub around it. */
export interface PanelRoom {
    /** The room shown; null is the Office room. */
    readonly current: OfficeRoom | null
    readonly key: string | null
    readonly rooms: ReadonlyArray<OfficeRoom>
    readonly channels: ReadonlyArray<OfficeChannelWire>
    /** The agents seated in the room (every agent in the Office room). */
    readonly agents: ReadonlyArray<OfficeAgent>
    /** The caller's direct conversations: every agent conversation, and the unread customer ones. */
    readonly unread: OfficeConversationUnread
}

/** The side columns and the composer's mention list, with their words; `board` is already scoped to the room. */
export const useOfficePanels = (
    messages: ReadonlyArray<OfficeMessage>,
    board: OfficeBoard,
    words: OfficeWords,
    waitingCount: number,
    room: PanelRoom,
) => {
    const me = useMember()
    const { current, key, rooms, channels, agents, unread } = room
    return useMemo(() => {
        const context = contextOf(me, board, null, [])
        const handles = staffHandlesOf(
            board.staff,
            board.agents.map((agent) => agent.handle),
        )
        const people =
            current === null || current.userIds.length === 0
                ? board.people.filter((person) => current === null || person.role !== "staff")
                : board.people.filter((person) => current.userIds.includes(person.userId))
        return {
            list: officeListViewOf(messages, waitingCount, words, context, {
                rows: roomRowsOf(rooms, words, (iso) => officeListTimeOf(iso, words, context), context.meName),
                selected: key ?? "office",
                unread,
            }),
            info: infoViewOf(
                { pending: board.pending, openWork: board.exceptions, people, handles, tasks: board.tasks },
                words,
                context,
                {
                    isOffice: current === null,
                    agents,
                    cards: pendingCardRowsOf(messages, context),
                    channels: roomChannelsOf(current, channels, board.agents, words),
                    pins: roomPinsOf(current),
                },
            ),
            tasks: taskViewsOf(board.tasks, words),
            mentions: mentionOptionsOf(board.agents, board.staff, handles, words),
        }
    }, [messages, board, waitingCount, words, me, current, key, rooms, channels, agents, unread])
}
