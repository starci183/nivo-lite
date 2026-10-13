import { useState, useTransition } from "react"
import { shiftDate, weekStartOf } from "@/modules/i18n"
import type { BookingBoard } from "@/modules/types"

/** The server action that reads the board of another week. */
export type ReadBookingRange = (
    workspaceId: string,
    from: string,
    to: string,
) => Promise<{ readonly kind: "ok"; readonly value: BookingBoard } | { readonly kind: string }>

/** The board of the week the owner is looking at, and the moves between weeks; each week is read on demand. */
export const useBookingRange = (workspaceId: string, initial: BookingBoard, read: ReadBookingRange) => {
    const [board, setBoard] = useState(initial)
    const [anchor, setAnchor] = useState(initial.today)
    const [failed, setFailed] = useState(false)
    const [seen, setSeen] = useState(initial)
    const [isLoading, startTransition] = useTransition()

    if (seen !== initial) {
        setSeen(initial)
        if (initial.from === board.from) setBoard(initial)
    }

    const load = (from: string) =>
        startTransition(async () => {
            const answer = await read(workspaceId, from, shiftDate(from, 6))
            if (answer.kind === "ok" && "value" in answer) setBoard(answer.value)
            setFailed(answer.kind !== "ok")
        })

    return {
        board,
        anchor,
        failed,
        isLoading,
        goto: (date: string) => {
            setAnchor(date)
            if (weekStartOf(date) !== board.from) load(weekStartOf(date))
        },
        reload: () => load(board.from),
    }
}
