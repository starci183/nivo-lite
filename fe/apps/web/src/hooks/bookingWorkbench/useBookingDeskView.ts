"use client"

import { useBookingDeskState } from "./useBookingDeskState"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"

import { useFormatter, useTranslations } from "next-intl"
import { BOOKING_STATUS_TONE, MOVE_ACTION, dayGroups, detailOf, bookingRowOf } from "@/hooks/bookingDesk"
import { AUTO_RESOURCE } from "@/modules/booking-desk"

import {
    buildBookingCancel,
    buildBookingLegend,
    buildBookingDeskEvents,
    bookingPlacementView,
} from "@/hooks/bookingDeskView"

/** The desk remains one lifetime across Calendar and Today; leaving both or changing real identity retires its edits. */
interface BookingDeskViewInput {
    readonly mode: Parameters<typeof useBookingDeskState>[0]["mode"]
    readonly isActive: boolean
    readonly scope: string
}
/** Draws the connected view from its current state. */
export const useBookingDeskView = (input: BookingDeskViewInput) => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const connected = useBookingDeskState({ ...input, t, format })
    return {
        props: {
            slot: mapSlot(slotOfSwr(connected.range.read), () => bookingDeskProps(connected)),
            placeholder: bookingDeskProps(connected),
            labels: slotLabels(t("loadFailedTitle")),
        },
        on: {
            ...buildBookingDeskEvents(connected, MOVE_ACTION),
            retry: () => connected.range.reload(),
        },
    } as const
}

/** Builds the props supplied to BookingDeskBase. */
const bookingDeskProps = (connected: NonNullable<ReturnType<typeof useBookingDeskState>>) => {
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
        isPending: connected.desk.isBusy || connected.place.isBusy || connected.range.isLoading,
        ...(connected.open === undefined
            ? {}
            : { detail: { ...detailOf(connected.open, connected.words), isPending: connected.desk.isBusy } }),
        ...bookingPlacementView(connected, AUTO_RESOURCE),
        ...buildBookingCancel(connected.cancelling, connected.t),
    } as const
}
