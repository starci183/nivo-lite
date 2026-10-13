"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import {
    BookingWorkbenchFailedBase,
    BookingWorkbenchPageBase,
} from "@/features/pages/BookingWorkbenchPage/component"
import { toBookingBoard } from "@/hooks/bookingDesk"
import { useQueryBookingBoardSwr } from "@/hooks/swr/api/graphql"

/** What the server page hands the connected workbench. */
interface BookingWorkbenchProps {
    readonly installationId: string
    /** `?tab=` of the route; anything unknown opens the first tab. */
    readonly initialTab: string | null
}

/** The connected booking workbench: reads `bookingBoard` through SWR and draws the frame with the calendar, today, the waiting list, the statistics and the setup. */
export const BookingWorkbench = (props: BookingWorkbenchProps) => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const { data, error } = useQueryBookingBoardSwr({}, { keepPreviousData: true })
    const tabs = {
        calendar: t("tabCalendar"),
        today: t("tabToday"),
        waitlist: t("tabWaitlist"),
        stats: t("tabStats"),
        setup: t("tabSetup"),
    }
    if (error !== undefined) {
        return (
            <BookingWorkbenchFailedBase
                props={{
                    loadFailed: { title: t("loadFailedTitle"), body: t("loadFailedBody") },
                    tabLabel: tabs.calendar,
                    installationId: props.installationId,
                }}
            />
        )
    }
    if (data === undefined) {
        return (
            <AgentDashboardFrame
                module="booking"
                installationId={props.installationId}
                isLoading
                figures={[]}
                tabs={Object.entries(tabs).map(([id, label]) => ({ id, label }))}
            />
        )
    }
    const board = toBookingBoard(data)
    const f = board.figures
    const figures: ReadonlyArray<DescriptionListStatItem> = [
        { id: "today", term: t("metricToday"), description: String(f.bookingsToday), meta: t("metricTodayBasis") },
        {
            id: "noShow",
            term: t("metricNoShow"),
            description: f.noShowPct30d === null ? "-" : `${f.noShowPct30d}%`,
            meta: f.noShowPct30d === null ? t("metricNoShowNone") : t("metricNoShowBasis", { n: f.finished30d }),
        },
        {
            id: "utilisation",
            term: t("metricUtilisation"),
            description: f.utilisationPct === null ? "-" : `${f.utilisationPct}%`,
            meta: f.utilisationPct === null ? t("metricUtilisationNone") : t("metricUtilisationBasis"),
        },
        {
            id: "deposits",
            term: t("metricDeposits"),
            description: String(f.depositsPending),
            meta:
                f.depositsPending === 0
                    ? t("metricDepositsNone")
                    : t("metricDepositsBasis", {
                          value: format.number(f.depositsPendingVnd, {
                              style: "currency",
                              currency: "VND",
                              maximumFractionDigits: 0,
                          }),
                      }),
        },
    ]
    return (
        <BookingWorkbenchPageBase
            props={{
                board,
                installationId: props.installationId,
                initialTab: props.initialTab,
                tabs,
                waitingCount: board.waitlist.filter((item) => item.status === "waiting").length,
                waitingRequests: board.bookings.filter((booking) => booking.status === "requested").length,
                figures,
            }}
        />
    )
}
