"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useBookingBoard } from "@/hooks/bookingBoard"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { BookingFiguresBase } from "./component"

/** The connected figures strip of the booking desk: bookings today, no-shows, utilisation and pending deposits. */
export const BookingFigures = () => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { board, isLoaded, isFailed, reload } = useBookingBoard()
    const f = board.figures
    const noShow = f.noShowPct30d === null ? "-" : `${f.noShowPct30d}%`
    const utilisation = f.utilisationPct === null ? "-" : `${f.utilisationPct}%`
    const deposits = format.number(f.depositsPendingVnd, {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    })
    const items = [
        {
            id: "today",
            term: t("metricToday"),
            description: String(f.bookingsToday),
            meta: t("metricTodayBasis"),
        },
        {
            id: "noShow",
            term: t("metricNoShow"),
            description: noShow,
            meta: f.noShowPct30d === null ? t("metricNoShowNone") : t("metricNoShowBasis", { n: f.finished30d }),
        },
        {
            id: "utilisation",
            term: t("metricUtilisation"),
            description: utilisation,
            meta: f.utilisationPct === null ? t("metricUtilisationNone") : t("metricUtilisationBasis"),
        },
        {
            id: "deposits",
            term: t("metricDeposits"),
            description: String(f.depositsPending),
            meta: f.depositsPending === 0 ? t("metricDepositsNone") : t("metricDepositsBasis", { value: deposits }),
        },
    ]
    return (
        <BookingFiguresBase
            props={{
                label: t("tabCalendar"),
                slot: slotOfSwr({
                    data: isLoaded ? items : undefined,
                    error: isFailed ? t("loadFailedBody") : undefined,
                    isLoading: !isLoaded && !isFailed,
                }),
                labels: slotLabels(t("loadFailedTitle")),
                placeholder: items,
            }}
            on={{ retry: reload }}
        />
    )
}
