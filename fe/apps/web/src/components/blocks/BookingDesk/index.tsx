"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import {
    BOOKING_STATUS_TONE,
    actionsOf,
    dayGroups,
    detailOf,
    rowOf,
    useBookingActions,
    useBookingRange,
} from "@/hooks/bookingDesk"
import { writeBookingRange } from "@/modules/db/booking/write-booking-range"
import { writeBookingStatus } from "@/modules/db/booking/write-booking-status"
import { navigation, shiftDate } from "@/modules/i18n"
import type { BookingBoard } from "@/modules/types"
import { BookingDeskBase } from "./component"

const { useRouter } = navigation

/** What the page hands the connected desk. */
interface BookingDeskProps {
    readonly workspaceId: string
    readonly initial: BookingBoard
    /** The week list (calendar tab) or only today (today tab). */
    readonly mode: "week" | "today"
}

/** The connected desk: the agenda of a week or of today, with the owner's commands on each booking. */
export const BookingDesk = (props: BookingDeskProps) => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const router = useRouter()
    const range = useBookingRange(props.workspaceId, props.initial, writeBookingRange)
    const desk = useBookingActions(props.workspaceId, { act: writeBookingStatus }, () => {
        range.reload()
        router.refresh()
    })
    const [openId, setOpenId] = useState<string | null>(null)
    const [cancelId, setCancelId] = useState<string | null>(null)
    const [showCancelled, setShowCancelled] = useState(false)
    const { board } = range
    const isToday = props.mode === "today"
    const words = {
        say: t,
        resourceName: (id: string) => board.resources.find((resource) => resource.id === id)?.name ?? "",
        money: (value: number) =>
            format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
    }
    const dayText = (date: string) =>
        format.dateTime(new Date(`${date}T12:00:00Z`), {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            timeZone: "UTC",
        })
    const visible = board.bookings.filter(
        (booking) => (!isToday || booking.date === board.today) && (showCancelled || booking.status !== "cancelled"),
    )
    const open = board.bookings.find((booking) => booking.id === openId)
    const cancelling = board.bookings.find((booking) => booking.id === cancelId)
    const act = (id: string, action: string) => {
        const booking = board.bookings.find((candidate) => candidate.id === id)
        const chosen = booking && actionsOf(booking.status, booking.checkedIn).find((candidate) => candidate === action)
        if (chosen === "cancel") setCancelId(id)
        else if (chosen !== undefined) desk.act(id, chosen, () => setOpenId(null))
    }
    const nav = {
        prevLabel: t("prev"),
        nextLabel: t("next"),
        thisWeekLabel: t("today"),
        dateLabel: t("pickDate"),
        date: range.anchor,
        showCancelledLabel: t("showCancelled"),
        showCancelled,
        rangeText: `${dayText(board.from)} - ${dayText(board.to)}${range.isLoading ? ` · ${t("loadingRange")}` : ""}`,
    }
    return (
        <BookingDeskBase
            props={{
                label: t("calendarLabel"),
                legend: Object.entries(BOOKING_STATUS_TONE).map(([status, tone]) => ({
                    text: t(`status_${status}`),
                    tone,
                })),
                ...(isToday ? {} : { nav }),
                ...(desk.notice === null
                    ? {}
                    : {
                          notice: {
                              tone: desk.notice.tone,
                              text: t(desk.notice.code),
                              dismissLabel: t("dismiss"),
                          },
                      }),
                days: dayGroups(visible).map((day) => ({
                    id: day.id,
                    label: dayText(day.id),
                    rows: day.rows.map((booking) => rowOf(booking, words, isToday)),
                })),
                empty: {
                    title: t(isToday ? "todayEmptyTitle" : "emptyWeekTitle"),
                    body: t(isToday ? "todayEmptyBody" : "emptyWeekBody"),
                },
                isPending: desk.isBusy || range.isLoading,
                ...(open === undefined ? {} : { detail: { ...detailOf(open, words), isPending: desk.isBusy } }),
                ...(cancelling === undefined
                    ? {}
                    : {
                          cancel: {
                              title: t("confirmCancelTitle", {
                                  name: cancelling.customer === "" ? t("customerFallback") : cancelling.customer,
                              }),
                              confirmLabel: t("confirmCancelYes"),
                              keepLabel: t("confirmCancelKeep"),
                          },
                      }),
            }}
            on={{
                prev: () => range.goto(shiftDate(range.anchor, -7)),
                next: () => range.goto(shiftDate(range.anchor, 7)),
                thisWeek: () => range.goto(board.today),
                pickDate: range.goto,
                toggleCancelled: setShowCancelled,
                dismissNotice: desk.dismiss,
                open: setOpenId,
                act,
                confirmCancel: () => {
                    if (cancelId === null) return
                    desk.act(cancelId, "cancel", () => {
                        setCancelId(null)
                        setOpenId(null)
                    })
                },
                keepBooking: () => setCancelId(null),
                detailAction: (action) => open !== undefined && act(open.id, action),
                closeDetail: () => setOpenId(null),
            }}
        />
    )
}
