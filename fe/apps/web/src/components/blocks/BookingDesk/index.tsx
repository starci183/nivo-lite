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
    placementLabelsOf,
    bookingRowOf,
    useBookingActions,
    useBookingPlacement,
    useBookingRange,
} from "@/hooks/bookingDesk"
import { AUTO_RESOURCE } from "@/components/composites/BookingPlacementDialog"
import {
    BookingDeskBase,
    buildBookingDeskEvents,
    buildBookingDeskDisplay,
    buildBookingCancel,
    buildBookingLegend,
} from "./component"

/** What the workbench hands the connected desk. */
interface BookingDeskProps {
    /** The week list (calendar tab) or only today (today tab). */
    readonly mode: "week" | "today"
}

/** The connected desk: the agenda of a week or of today, with the owner's commands on each booking. The board comes from the `bookingBoard` query through SWR. */
/** Connects the state and commands used by BookingDesk. */
const buildBookingDeskState = (
    range: ReturnType<typeof useBookingRange>,
    props: BookingDeskProps,
    t: ReturnType<typeof useTranslations<"workbenchBooking">>,
    format: ReturnType<typeof useFormatter>,
    showCancelled: boolean,
    openId: string | null,
    cancelId: string | null,
    desk: ReturnType<typeof useBookingActions>,
    place: ReturnType<typeof useBookingPlacement>,
    setCancelId: import("react").Dispatch<import("react").SetStateAction<string | null>>,
    setOpenId: import("react").Dispatch<import("react").SetStateAction<string | null>>,
    setShowCancelled: import("react").Dispatch<import("react").SetStateAction<boolean>>,
) => {
    const { board } = range
    if (board === undefined) return null
    const isToday = props.mode === "today"
    const display = buildBookingDeskDisplay(
        board,
        range.anchor,
        t,
        format,
        isToday,
        showCancelled,
        openId,
        cancelId,
        blankPlacementOf,
        range.isValidating ? ` · ${t("loadingRange")}` : "",
    )
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
    const desk = useBookingActions(range.reload)
    const [openId, setOpenId] = useState<string | null>(null)
    const place = useBookingPlacement(range.board?.timezone ?? "", () => {
        setOpenId(null)
        range.reload()
    })
    const [cancelId, setCancelId] = useState<string | null>(null)
    const [showCancelled, setShowCancelled] = useState(false)

    const connected = buildBookingDeskState(
        range,
        props,
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
    )
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
        ...(connected.place.draft === null || connected.place.fields === null
            ? {}
            : {
                  placement: {
                      mode: connected.place.draft.kind,
                      title: connected.t(connected.place.draft.kind === "add" ? "addBooking" : "moveTitle"),
                      fields: connected.place.fields,
                      serviceOptions: connected.activeServices.map((service) => ({
                          id: service.id,
                          label: service.name,
                      })),
                      resourceOptions:
                          connected.place.draft.kind === "add"
                              ? [
                                    { id: AUTO_RESOURCE, label: connected.t("autoResource") },
                                    ...connected.resourceOptions,
                                ]
                              : connected.resourceOptions,
                      labels: placementLabelsOf(connected.t, connected.place.draft.kind),
                      ...(connected.place.reason === null
                          ? {}
                          : { refusal: connected.t(`reason_${connected.place.reason}`) }),
                      canForce: connected.place.canForce,
                      isPending: connected.place.isBusy,
                  },
              }),
        ...buildBookingCancel(connected.cancelling, connected.t),
    }
}
