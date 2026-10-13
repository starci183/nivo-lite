"use client"

import { useState } from "react"
import { useQueryBookingBoardSwr } from "@/hooks/swr/api/graphql"
import { shiftDate, weekStartOf } from "@/modules/i18n"
import { toBookingBoard } from "@/hooks/bookingBoard"

/** One week of the desk, in local dates; `null` asks the back end for the week of today. */
interface Week {
    readonly from: string
    readonly to: string
}

/** The board of the week the owner is looking at, and the moves between weeks; SWR owns caching and keeps the last week while the next loads. */
export const useBookingRange = () => {
    const [week, setWeek] = useState<Week | null>(null)
    const [anchor, setAnchor] = useState<string | null>(null)
    const { data, error, isValidating, mutate } = useQueryBookingBoardSwr(week ?? {}, { keepPreviousData: true })
    const board = data === undefined ? undefined : toBookingBoard(data)
    return {
        board,
        anchor: anchor ?? board?.today ?? "",
        failed: error !== undefined,
        isLoading: board === undefined,
        isValidating,
        goto: (date: string) => {
            setAnchor(date)
            const from = weekStartOf(date)
            if (from !== board?.from) setWeek({ from, to: shiftDate(from, 6) })
        },
        reload: () => mutate(),
    }
}
