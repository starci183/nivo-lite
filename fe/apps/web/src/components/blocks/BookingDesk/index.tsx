"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import {
    BOOKING_STATUS_TONE,
    MOVE_ACTION,
    actionsOf,
    dayGroups,
    detailOf,
    rowOf,
    useBookingActions,
    useBookingPlacement,
    useBookingRange,
} from "@/hooks/bookingDesk"
import type { PlacementFields } from "@/hooks/bookingDesk"
import { AUTO_RESOURCE } from "@/components/composites/BookingPlacementDialog"
import { writeBookingAdd, writeBookingMove } from "@/modules/db/booking/write-booking-desk"
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
    const place = useBookingPlacement(
        props.workspaceId,
        range.board.timezone,
        { add: writeBookingAdd, move: writeBookingMove },
        (kind) => {
            desk.announce(kind === "add" ? "did_add" : "did_move")
            setOpenId(null)
            range.reload()
            router.refresh()
        },
    )
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
    const activeServices = board.services.filter((service) => service.active)
    const blank: PlacementFields = {
        serviceId: activeServices[0]?.id ?? "",
        date: board.today,
        time: "09:00",
        resourceId: "",
        name: "",
        phone: "",
        party: 1,
        note: "",
        force: false,
    }
    const openAdd = () => {
        if (activeServices.length === 0) return desk.announce("addNoServices", "negative")
        place.open({ kind: "add" }, blank)
    }
    const openMove = (id: string) => {
        const booking = board.bookings.find((candidate) => candidate.id === id)
        if (booking === undefined) return
        place.open(
            { kind: "move", id },
            {
                ...blank,
                serviceId: booking.serviceId,
                date: booking.date,
                time: booking.startClock,
                resourceId: booking.resourceId,
            },
        )
    }
    const resourceOptions = board.resources
        .filter((resource) => resource.active)
        .map((resource) => ({ id: resource.id, label: resource.name }))
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
                add: { label: t("addBooking"), isDisabled: place.isBusy },
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
                ...(place.draft === null || place.fields === null
                    ? {}
                    : {
                          placement: {
                              mode: place.draft.kind,
                              title: t(place.draft.kind === "add" ? "addBooking" : "moveTitle"),
                              fields: place.fields,
                              serviceOptions: activeServices.map((service) => ({
                                  id: service.id,
                                  label: service.name,
                              })),
                              resourceOptions:
                                  place.draft.kind === "add"
                                      ? [{ id: AUTO_RESOURCE, label: t("autoResource") }, ...resourceOptions]
                                      : resourceOptions,
                              labels: {
                                  name: t("fCustomer"),
                                  phone: t("fPhone"),
                                  service: t("fService"),
                                  date: t("fDate"),
                                  time: t("fTime"),
                                  resource: t("fResource"),
                                  party: t("fParty"),
                                  note: t("fNote"),
                                  notePlaceholder: t("notePlaceholder"),
                                  force: t("stackAnyway"),
                                  save: t(place.draft.kind === "add" ? "add" : "save"),
                                  cancel: t("cancel"),
                                  close: t("close"),
                              },
                              ...(place.reason === null ? {} : { refusal: t(`reason_${place.reason}`) }),
                              canForce: place.canForce,
                              isPending: place.isBusy,
                          },
                      }),
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
                add: openAdd,
                placementChange: place.change,
                placementSubmit: place.submit,
                placementClose: place.close,
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
                detailAction: (action) => {
                    if (open === undefined) return
                    if (action === MOVE_ACTION) openMove(open.id)
                    else act(open.id, action)
                },
                closeDetail: () => setOpenId(null),
            }}
        />
    )
}
