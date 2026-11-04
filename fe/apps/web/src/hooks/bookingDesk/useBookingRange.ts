"use client"

import { useFeatureReset } from "@/hooks/reuseables"

import { useState } from "react"
import { useQueryBookingBoardSwr } from "@/hooks/swr"
import { shiftDate, weekStartOf } from "@/modules/i18n"
import { toBookingBoard, type BookingBoardWire } from "@/hooks/bookingBoard"
import { readError } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"
import type { BookingBoard } from "@/modules/types"

/** One week of the desk, in local dates; `null` asks the back end for the week of today. */
interface Week {
    readonly from: string
    readonly to: string
}

/** The view `useBookingRange` returns. */
export interface BookingRangeView {
    read: SWRResponse<BookingBoardWire, Error>
    board: BookingBoard | undefined
    anchor: string
    failed: boolean
    isLoading: boolean
    isValidating: boolean
    goto: (date: string) => void
    reload: () => Promise<BookingBoardWire | undefined>
}

/** The board of the week the owner is looking at, and the moves between weeks; SWR owns caching and keeps the last week while the next loads. */
export const useBookingRange = (isActive = true, scope = ""): BookingRangeView => {
    const [week, setWeek] = useState<Week | null>(null)
    const [anchor, setAnchor] = useState<string | null>(null)
    const swrRead = useQueryBookingBoardSwr(week ?? {}, { keepPreviousData: true }, isActive)
    useFeatureReset({
        isActive: isActive,
        isReady: true,
        scope: scope,
        onReset: () => {
            setWeek(null)
            setAnchor(null)
        },
    })
    const { data, isValidating, mutate } = swrRead
    const error = readError(swrRead)
    const board = data === undefined ? undefined : toBookingBoard(data)
    return {
        read: swrRead,
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
