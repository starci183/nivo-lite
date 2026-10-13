import { useFormatter, useTranslations } from "next-intl"
import type { BookingStatsView } from "@/modules/types"
import { BookingStatsBase } from "./component"

/** What the page hands the statistics block. */
interface BookingStatsProps {
    readonly stats: BookingStatsView
    /** The first and last local date of the range, `YYYY-MM-DD`. */
    readonly from: string
    readonly to: string
}

/** The statistics of the week: bookings by outcome, revenue of the finished ones, and utilisation per resource. */
export const BookingStats = (props: BookingStatsProps) => {
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
    return (
        <BookingStatsBase
            props={{
                rangeText: t("statsRange", { from: day(props.from), to: day(props.to) }),
                label: t("statsLabel"),
                stats: [
                    { id: "total", term: t("statTotal"), description: String(props.stats.total) },
                    { id: "done", term: t("statDone"), description: String(props.stats.byStatus.done ?? 0) },
                    {
                        id: "no_show",
                        term: t("statNoShow"),
                        description: String(props.stats.byStatus.no_show ?? 0),
                        unit: `(${props.stats.noShowPct}%)`,
                    },
                    {
                        id: "revenue",
                        term: t("statRevenue"),
                        description: format.number(props.stats.doneRevenueVnd, {
                            style: "currency",
                            currency: "VND",
                            maximumFractionDigits: 0,
                        }),
                    },
                ],
                utilisationLabel: t("utilTitle"),
                utilisationEmpty: t("utilEmpty"),
                resources: props.stats.byResource.map((resource) => ({
                    id: resource.resourceId,
                    name: resource.name,
                    pct: resource.pct,
                    valueLabel: `${resource.pct}%`,
                    hoursText: t("utilHours", { booked: hours(resource.bookedMin), open: hours(resource.openMin) }),
                })),
            }}
        />
    )
}
