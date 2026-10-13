"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useTransition } from "react"
import { useSWRConfig } from "swr"
import { isQueryBookingBoardSwrKey, useMutateRemoveBookingWaitlistEntrySwr } from "@/hooks/swr/api/graphql"
import { useGraphQLWithToast } from "@/modules/toast"
import type { BookingWaitView } from "@/modules/types"
import { BookingWaitlistBase } from "./component"

/** What the workbench hands the connected waiting list. */
interface BookingWaitlistProps {
    readonly timezone: string
    readonly items: ReadonlyArray<BookingWaitView>
}

/** The connected waiting list: customers who wait for a free time, removable one by one. */
export const BookingWaitlist = (props: BookingWaitlistProps) => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
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
            timeZone: props.timezone,
        })
    const clock = (ms: number) =>
        format.dateTime(new Date(ms), {
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
            timeZone: props.timezone,
        })
    return (
        <BookingWaitlistBase
            props={{
                label: t("waitLabel"),
                emptyTitle: t("waitEmptyTitle"),
                emptyBody: t("waitEmptyBody"),
                removeLabel: t("waitRemove"),
                rows: props.items.map((item) => ({
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
                        const answer = await withToast(() => remove.trigger({ id }), {
                            successMessage: t("saved"),
                        })
                        if (answer === undefined) return
                        void mutate(isQueryBookingBoardSwrKey)
                    }),
            }}
        />
    )
}
