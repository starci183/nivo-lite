"use client"

import { useMemo } from "react"
import { useMember } from "@/hooks/member"
import { contextOf } from "@/hooks/office"
import type { OfficeBoard } from "@/hooks/office"
import { buildThreadEntries, threadViewsOf } from "@/modules/office"
import type { OfficeMessage, OfficeWords } from "@/modules/office"
import type { OfficeThreadItem } from "@/modules/types"

/** The thread with its words: lines, approval cards, exception cards and command cards, in time order. */
export const useOfficeThreadView = (
    messages: ReadonlyArray<OfficeMessage> | undefined,
    board: OfficeBoard,
    words: OfficeWords,
    focusedId: string | null,
    alreadyIds: ReadonlyArray<string>,
): ReadonlyArray<OfficeThreadItem> => {
    const me = useMember()
    return useMemo(() => {
        if (messages === undefined) return []
        const entries = buildThreadEntries(
            messages,
            [...board.pending, ...board.decided],
            [...board.exceptions, ...board.decidedCards],
            board.candidates,
        )
        return threadViewsOf(entries, words, contextOf(me, board, focusedId, alreadyIds))
    }, [messages, board, words, me, focusedId, alreadyIds])
}
