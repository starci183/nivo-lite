"use client"

import { useBookingBoard } from "@/hooks/bookingBoard"
import { useFormatter, useTranslations } from "next-intl"
import { useTransition } from "react"
import { useMutateRemoveBookingWaitlistEntrySwr } from "@/hooks/swr/api/graphql"
import { useBookingSetupSave } from "@/hooks/bookingSetup"
import { BookingWaitlistBase } from "./component"

/** The connected waiting list: customers who wait for a free time, removable one by one. */
export const BookingWaitlist = () => {
    const { board } = useBookingBoard()
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const persist = useBookingSetupSave()
    const remove = useMutateRemoveBookingWaitlistEntrySwr()
    const [isPending, startTransition] = useTransition()
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
    return (
        <BookingWaitlistBase
            props={{
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
                isPending,
            }}
            on={{
                remove: (id) =>
                    startTransition(async () => {
                        const answer = await persist(() => remove.trigger({ id }))
                        if (answer === undefined) return
                    }),
            }}
        />
    )
}
