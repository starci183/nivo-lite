"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { useBookingBoard } from "@/hooks/bookingBoard"
import { mapSlot, useSlotLabels } from "@/hooks/slot"

/** Resolves the booking ribbon from its authoritative board while its workbench overview is mounted. */
export const useBookingFiguresView = (boardRead: ReturnType<typeof useBookingBoard>) => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { board, boardSlot, reload } = boardRead
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
            value: String(f.bookingsToday),
            meta: t("metricTodayBasis"),
        },
        {
            id: "noShow",
            term: t("metricNoShow"),
            value: noShow,
            meta: f.noShowPct30d === null ? t("metricNoShowNone") : t("metricNoShowBasis", { n: f.finished30d }),
        },
        {
            id: "utilisation",
            term: t("metricUtilisation"),
            value: utilisation,
            meta: f.utilisationPct === null ? t("metricUtilisationNone") : t("metricUtilisationBasis"),
        },
        {
            id: "deposits",
            term: t("metricDeposits"),
            value: String(f.depositsPending),
            meta: f.depositsPending === 0 ? t("metricDepositsNone") : t("metricDepositsBasis", { value: deposits }),
        },
    ]
    return {
        props: {
            label: t("tabCalendar"),
            slot: mapSlot(boardSlot, () => items),
            labels: slotLabels(t("loadFailedTitle")),
            placeholder: items,
        },
        on: { retry: reload },
    } as const
}
