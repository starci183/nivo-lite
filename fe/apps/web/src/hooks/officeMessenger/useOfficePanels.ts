"use client"

import { useMemo } from "react"
import { useMember } from "@/hooks/member"
import { contextOf } from "@/hooks/office"
import type { OfficeBoard } from "@/hooks/office"
import { infoViewOf, officeListViewOf, mentionOptionsOf, staffHandlesOf, taskViewsOf } from "@/modules/office"
import type { OfficeMessage, OfficeWords } from "@/modules/office"

/** The side columns and the composer's mention list, with their words. */
export const useOfficePanels = (
    messages: ReadonlyArray<OfficeMessage>,
    board: OfficeBoard,
    words: OfficeWords,
    waitingCount: number,
) => {
    const me = useMember()
    return useMemo(() => {
        const context = contextOf(me, board, null, [])
        const handles = staffHandlesOf(
            board.staff,
            board.agents.map((agent) => agent.handle),
        )
        return {
            list: officeListViewOf(messages, waitingCount, words, context),
            info: infoViewOf(board.pending, board.exceptions, board.people, handles, board.tasks, words, context),
            tasks: taskViewsOf(board.tasks, words),
            mentions: mentionOptionsOf(board.agents, board.staff, handles, words),
        }
    }, [messages, board, waitingCount, words, me])
}
