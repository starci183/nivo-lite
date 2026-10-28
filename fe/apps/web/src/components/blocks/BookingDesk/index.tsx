"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import {
    BOOKING_STATUS_TONE,
    MOVE_ACTION,
    actionsOf,
    blankPlacementOf,
    dayGroups,
    detailOf,
    bookingRowOf,
    useBookingActions,
    useBookingPlacement,
    useBookingRange,
} from "@/hooks/bookingDesk"
import { AUTO_RESOURCE } from "@/components/composites/BookingPlacementDialog"
import { BookingDeskBase } from "./component"

import {
    buildBookingDeskDisplay,
    buildBookingCancel,
    buildBookingLegend,
    buildBookingDeskEvents,
    bookingPlacementView,
} from "@/hooks/bookingDeskView"

/** What the workbench hands the connected desk. */
interface BookingDeskProps {
    /** The week list (calendar tab) or only today (today tab). */
    readonly mode: "week" | "today"
}

/** Inputs owned by this display/state mapping. */
interface BookingDeskStateInput {
    readonly range: ReturnType<typeof useBookingRange>
    readonly mode: BookingDeskProps["mode"]
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly format: ReturnType<typeof useFormatter>
    readonly showCancelled: boolean
    readonly openId: string | null
    readonly cancelId: string | null
    readonly desk: ReturnType<typeof useBookingActions>
    readonly place: ReturnType<typeof useBookingPlacement>
    readonly setCancelId: import("react").Dispatch<import("react").SetStateAction<string | null>>
    readonly setOpenId: import("react").Dispatch<import("react").SetStateAction<string | null>>
    readonly setShowCancelled: import("react").Dispatch<import("react").SetStateAction<boolean>>
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
}: BookingDeskStateInput) => {
    const { board } = range
    if (board === undefined) return null
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

/** Draws the connected view from its current state. */
export const BookingDesk = (props: BookingDeskProps) => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const range = useBookingRange()
    const desk = useBookingActions(() => {
        void range.reload()
    })
    const [openId, setOpenId] = useState<string | null>(null)
    const place = useBookingPlacement(range.board?.timezone ?? "", () => {
        setOpenId(null)
        void range.reload()
    })
    const [cancelId, setCancelId] = useState<string | null>(null)
    const [showCancelled, setShowCancelled] = useState(false)

    const connected = buildBookingDeskState({
        range,
        mode: props.mode,
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
    if (connected === null) return null

    return <BookingDeskBase props={bookingDeskProps(connected)} on={buildBookingDeskEvents(connected, MOVE_ACTION)} />
}

/** Builds the props supplied to BookingDeskBase. */
const bookingDeskProps = (
    connected: NonNullable<ReturnType<typeof buildBookingDeskState>>,
): Parameters<typeof BookingDeskBase>[0]["props"] => {
    return {
        label: connected.t("calendarLabel"),
        legend: buildBookingLegend(BOOKING_STATUS_TONE, connected.t),
        add: { label: connected.t("addBooking"), isDisabled: connected.place.isBusy },
        ...(connected.isToday ? {} : { nav: connected.nav }),
        ...(connected.desk.notice === null
            ? {}
            : {
                  notice: {
                      tone: connected.desk.notice.tone,
                      text: connected.t(connected.desk.notice.code),
                      dismissLabel: connected.t("dismiss"),
                  },
              }),
        days: dayGroups(connected.visible).map((day) => ({
            id: day.id,
            label: connected.dayText(day.id),
            rows: day.rows.map((booking) => bookingRowOf(booking, connected.words, connected.isToday)),
        })),
        empty: {
            title: connected.t(connected.isToday ? "todayEmptyTitle" : "emptyWeekTitle"),
            body: connected.t(connected.isToday ? "todayEmptyBody" : "emptyWeekBody"),
        },
        isPending: connected.desk.isBusy || connected.place.isBusy || connected.range.isValidating,
        ...(connected.open === undefined
            ? {}
            : { detail: { ...detailOf(connected.open, connected.words), isPending: connected.desk.isBusy } }),
        ...bookingPlacementView(connected, AUTO_RESOURCE),
        ...buildBookingCancel(connected.cancelling, connected.t),
    }
}
