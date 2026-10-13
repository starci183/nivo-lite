import { getFormatter, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { loadAgentDashboard } from "@/lib/agent-dashboard"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import { readBookingBoard } from "@/modules/db"
import { BookingWorkbenchFailedBase, BookingWorkbenchPageBase } from "./component"

/** What the agent workbench route hands the booking workbench. */
interface BookingWorkbenchPageProps {
    /** `?tab=` of the route; anything unknown opens the first tab. */
    readonly tab?: string | null
    /** The Booking agent instance the workbench opens for; one per branch. */
    readonly installation?: {
        readonly id: string
        readonly workspaceId: string
        readonly isMulti: boolean
    } | null
}

/** /agents/booking/workbench: the calendar of a week, today, the waiting list, the statistics and the setup of the shop. */
export const BookingWorkbenchPage = async (props: BookingWorkbenchPageProps) => {
    const t = await getTranslations("workbenchBooking")
    const format = await getFormatter()
    const installation = props.installation
    if (installation === null || installation === undefined) notFound()
    const scope = installation.isMulti ? installation.id : null
    const board = await readBookingBoard(installation.workspaceId, null)
    const dashboard = await loadAgentDashboard("booking", {
        installationId: scope,
        decisionHref: (item) => workbenchHref("booking", { tab: "calendar", focus: item.id, installationId: scope }),
    })
    if (board.kind !== "ok") {
        return (
            <BookingWorkbenchFailedBase
                props={{
                    loadFailed: { title: t("loadFailedTitle"), body: t("loadFailedBody") },
                    tabLabel: t("tabCalendar"),
                    dashboard,
                }}
            />
        )
    }
    const f = board.value.figures
    const figures = [
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
                workspaceId: installation.workspaceId,
                board: board.value,
                dashboard,
                initialTab: props.tab ?? null,
                tabs: {
                    calendar: t("tabCalendar"),
                    today: t("tabToday"),
                    waitlist: t("tabWaitlist"),
                    stats: t("tabStats"),
                    setup: t("tabSetup"),
                },
                waitingCount: board.value.waitlist.filter((item) => item.status === "waiting").length,
                waitingRequests: board.value.bookings.filter((booking) => booking.status === "requested").length,
                figures,
            }}
        />
    )
}
