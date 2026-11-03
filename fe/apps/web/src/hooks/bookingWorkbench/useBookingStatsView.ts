"use client"

import type { useBookingBoard } from "@/hooks/bookingBoard"
import { useFormatter, useTranslations } from "next-intl"

/** The view `useBookingStatsView` returns. */
export interface BookingStatsViewShape {
    readonly props: {
        readonly rangeText: string
        readonly label: string
        readonly stats: readonly [
            {
                readonly id: "total"
                readonly term: string
                readonly value: string
            },
            {
                readonly id: "done"
                readonly term: string
                readonly value: string
            },
            {
                readonly id: "no_show"
                readonly term: string
                readonly value: string
                readonly unit: `(${number}%)`
            },
            {
                readonly id: "revenue"
                readonly term: string
                readonly value: string
            },
        ]
        readonly utilisationLabel: string
        readonly utilisationEmpty: string
        readonly resources: {
            id: string
            name: string
            pct: number
            valueLabel: string
            hoursText: string
        }[]
    }
    readonly on: {}
}

/** The statistics of the week: bookings by outcome, revenue of the finished ones, and utilisation per resource. */
export const useBookingStatsView = (boardRead: ReturnType<typeof useBookingBoard>): BookingStatsViewShape => {
    const { board } = boardRead
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const day = (date: string) =>
        format.dateTime(new Date(`${date}T12:00:00Z`), {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            timeZone: "UTC",
        })
    const hours = (minutes: number) => format.number(Math.round(minutes / 6) / 10)
    return {
        props: {
            rangeText: t("statsRange", { from: day(board.from), to: day(board.to) }),
            label: t("statsLabel"),
            stats: [
                { id: "total", term: t("statTotal"), value: String(board.stats.total) },
                { id: "done", term: t("statDone"), value: String(board.stats.byStatus.done ?? 0) },
                {
                    id: "no_show",
                    term: t("statNoShow"),
                    value: String(board.stats.byStatus.no_show ?? 0),
                    unit: `(${board.stats.noShowPct}%)`,
                },
                {
                    id: "revenue",
                    term: t("statRevenue"),
                    value: format.number(board.stats.doneRevenueVnd, {
                        style: "currency",
                        currency: "VND",
                        maximumFractionDigits: 0,
                    }),
                },
            ],
            utilisationLabel: t("utilTitle"),
            utilisationEmpty: t("utilEmpty"),
            resources: board.stats.byResource.map((resource) => ({
                id: resource.resourceId,
                name: resource.name,
                pct: resource.pct,
                valueLabel: `${resource.pct}%`,
                hoursText: t("utilHours", { booked: hours(resource.bookedMin), open: hours(resource.openMin) }),
            })),
        },
        on: {},
    } as const
}
