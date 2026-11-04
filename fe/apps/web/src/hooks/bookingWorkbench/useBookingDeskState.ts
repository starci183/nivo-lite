"use client"

import { useFeatureReset } from "@/hooks/reuseables"
import { useState, type Dispatch, type SetStateAction } from "react"
import type { useTranslations, useFormatter } from "next-intl"
import {
    actionsOf,
    blankPlacementOf,
    useBookingRange,
    useBookingActions,
    useBookingPlacement,
} from "@/hooks/bookingDesk"
import { EMPTY_BOOKING_BOARD } from "@/hooks/bookingBoard"
import { buildBookingDeskDisplay, type BuildBookingDeskDisplayResult } from "@/hooks/bookingDeskView"

/** Inputs owned by this display/state mapping. */
interface BuildBookingDeskStateInput {
    readonly range: ReturnType<typeof useBookingRange> & {
        readonly board: NonNullable<ReturnType<typeof useBookingRange>["board"]>
    }
    readonly mode: "week" | "today"
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly format: ReturnType<typeof useFormatter>
    readonly showCancelled: boolean
    readonly openId: string | null
    readonly cancelId: string | null
    readonly desk: ReturnType<typeof useBookingActions>
    readonly place: ReturnType<typeof useBookingPlacement>
    readonly setCancelId: Dispatch<SetStateAction<string | null>>
    readonly setOpenId: Dispatch<SetStateAction<string | null>>
    readonly setShowCancelled: Dispatch<SetStateAction<boolean>>
}

/** Connects booking data, placement state and agenda commands. */
const buildBookingDeskState = ({
    range,
    mode,
    t,
    format,
    showCancelled,
    openId,
    cancelId,
    desk,
    place,
    setCancelId,
    setOpenId,
    setShowCancelled,
}: BuildBookingDeskStateInput): BookingDeskStateView => {
    const { board } = range
    const isToday = mode === "today"
    const display = buildBookingDeskDisplay({
        board,
        anchorValue: range.anchor,
        t,
        format,
        isToday,
        showCancelled,
        openId,
        cancelId,
        placement: blankPlacementOf,
        loadingSuffix: range.isValidating ? ` · ${t("loadingRange")}` : "",
    })
    const openAdd = () => {
        if (display.activeServices.length === 0) return desk.announce("addNoServices", "negative")
        place.open({ kind: "add" }, display.blank)
    }
    const openMove = (id: string) => {
        const booking = board.bookings.find((candidate) => candidate.id === id)
        if (booking === undefined) return
        place.open(
            { kind: "move", id },
            {
                ...display.blank,
                serviceId: booking.serviceId,
                date: booking.date,
                time: booking.startClock,
                resourceId: booking.resourceId,
            },
        )
    }
    const act = (id: string, action: string) => {
        const booking = board.bookings.find((candidate) => candidate.id === id)
        const chosen = booking && actionsOf(booking.status, booking.checkedIn).find((candidate) => candidate === action)
        if (chosen === "cancel") setCancelId(id)
        else if (chosen !== undefined) desk.act(id, chosen, () => setOpenId(null))
    }
    return {
        ...display,
        t,
        place,
        isToday,
        desk,
        range,
        openAdd,
        board,
        setShowCancelled,
        setOpenId,
        act,
        cancelId,
        setCancelId,
        openMove,
    }
}
/** The active calendar/today desk identity and its already resolved locale readers. */
interface BookingDeskStateInput {
    readonly mode: BuildBookingDeskStateInput["mode"]
    readonly isActive: boolean
    readonly scope: string
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly format: ReturnType<typeof useFormatter>
}
/** The view `useBookingDeskState` returns: the display, the placement and the commands the desk is drawn and driven from. */
export interface BookingDeskStateView extends BuildBookingDeskDisplayResult {
    t: ReturnType<typeof useTranslations<"workbenchBooking">>
    place: ReturnType<typeof useBookingPlacement>
    isToday: boolean
    desk: ReturnType<typeof useBookingActions>
    range: BuildBookingDeskStateInput["range"]
    openAdd: () => unknown
    board: BuildBookingDeskStateInput["range"]["board"]
    setShowCancelled: Dispatch<SetStateAction<boolean>>
    setOpenId: Dispatch<SetStateAction<string | null>>
    act: (id: string, action: string) => void
    cancelId: string | null
    setCancelId: Dispatch<SetStateAction<string | null>>
    openMove: (id: string) => void
}

/** Owns the desk's actual range, selection, placement and command lifetime across Calendar and Today. */
export const useBookingDeskState = (input: BookingDeskStateInput): BookingDeskStateView => {
    const { t, format } = input
    const range = useBookingRange(input.isActive, input.scope)

    const desk = useBookingActions(() => range.reload(), input.isActive, input.scope)

    const [openId, setOpenId] = useState<string | null>(null)

    const place = useBookingPlacement(
        range.board?.timezone ?? "",
        () => {
            setOpenId(null)
            return range.reload()
        },
        input.isActive,
        input.scope,
    )

    const [cancelId, setCancelId] = useState<string | null>(null)

    const [showCancelled, setShowCancelled] = useState(false)

    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setOpenId(null)
            setCancelId(null)
            setShowCancelled(false)
        },
    })

    const connected = buildBookingDeskState({
        range: { ...range, board: range.board ?? EMPTY_BOOKING_BOARD },
        mode: input.mode,
        t,
        format,
        showCancelled,
        openId,
        cancelId,
        desk,
        place,
        setCancelId,
        setOpenId,
        setShowCancelled,
    })
    return connected
}
