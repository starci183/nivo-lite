"use client"

import { useBookingTransition } from "@/hooks/bookingDesk"

import type { useBookingBoard } from "@/hooks/bookingBoard"
import { useFormatter, useTranslations } from "next-intl"

import { useBookingSettingsCommands } from "@/hooks/bookingSetup"

/** The view `useBookingWaitlistView` returns. */
export interface BookingWaitlistView {
    readonly props: {
        readonly label: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly removeLabel: string
        readonly rows: {
            id: string
            title: string
            detail: string
        }[]
        readonly isPending: boolean
    }
    readonly on: {
        readonly remove: (id: string) => void
    }
}

/** The connected waiting list: customers who wait for a free time, removable one by one. */
export const useBookingWaitlistView = (
    isActive: boolean,
    scope: string,
    boardRead: ReturnType<typeof useBookingBoard>,
): BookingWaitlistView => {
    const { board } = boardRead
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const commands = useBookingSettingsCommands()
    const { isPending, run: startTransition } = useBookingTransition(isActive, scope)
    const when = (ms: number) =>
        format.dateTime(new Date(ms), {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
            timeZone: board.timezone,
        })
    const clock = (ms: number) =>
        format.dateTime(new Date(ms), {
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
            timeZone: board.timezone,
        })
    return {
        props: {
            label: t("waitLabel"),
            emptyTitle: t("waitEmptyTitle"),
            emptyBody: t("waitEmptyBody"),
            removeLabel: t("waitRemove"),
            rows: board.waitlist.map((item) => ({
                id: item.id,
                title: [item.customer === "" ? t("customerFallback") : item.customer, item.phone ?? ""]
                    .filter((part) => part !== "")
                    .join(" · "),
                detail: [
                    item.service,
                    `${when(item.fromMs)} - ${clock(item.toMs)}`,
                    t("rowParty", { n: item.party }),
                    t(item.status === "notified" ? "waitNotified" : "waitWaiting"),
                ].join(" · "),
            })),
            isPending: isPending,
        },
        on: {
            remove: (id: string) =>
                startTransition(async () => {
                    const answer = await commands.removeWaitlistEntry({ id })
                    if (answer === undefined) return
                }),
        },
    } as const
}
