"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import type { OverviewChartMetric } from "@/components/composites/OverviewRevenueCard"
import { useOverview, useOverviewPhone } from "@/hooks/overview"
import { useSlotLabels } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { AGENTS_ROUTE, CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { OverviewDashboardBase } from "./component"
import type { OverviewDashboardCopy } from "./component"

/** The words of the page in the reader's language. */
const useOverviewCopy = (range: { readonly from: string; readonly to: string }): OverviewDashboardCopy => {
    const t = useTranslations("overview")
    return {
        title: t("title"),
        description: t("description", { from: range.from, to: range.to }),
        periodLabel: t("periodLabel"),
        periods: {
            today: t("periodToday"),
            last_7_days: t("period7"),
            last_30_days: t("period30"),
            this_month: t("periodMonth"),
        },
        exportLabel: t("exportReport"),
        kpisLabel: t("kpisLabel"),
        forbiddenBody: t("forbiddenBody"),
        agentsOpen: t("agentsOpen"),
        chart: {
            title: t("chartTitle"),
            note: t("chartNote"),
            switchLabel: t("chartSwitchLabel"),
            revenue: t("chartRevenue"),
            orders: t("chartOrders"),
            revenueLabel: t("chartRevenueLabel"),
            ordersLabel: t("chartOrdersLabel"),
            empty: t("chartEmpty"),
        },
        funnel: { title: t("funnelTitle"), note: t("funnelNote") },
        channels: {
            title: t("channelsTitle"),
            note: t("channelsNote"),
            open: t("channelsOpen"),
            channel: t("channelsColumnChannel"),
            customers: t("channelsColumnCustomers"),
            revenue: t("channelsColumnRevenue"),
            emptyTitle: t("channelsEmptyTitle"),
            emptyBody: t("channelsEmptyBody"),
        },
        approvals: {
            title: t("approvalsTitle"),
            more: t("approvalsMore"),
            emptyTitle: t("approvalsEmptyTitle"),
            emptyBody: t("approvalsEmptyBody"),
        },
        savings: { title: t("savingsTitle"), hoursNote: t("savingsHoursNote"), help: t("savingsHelp") },
        agents: {
            title: t("agentsTitle"),
            note: t("agentsNote"),
            open: t("agentsOpen"),
            agent: t("agentsColumnAgent"),
            tasks: t("agentsColumnTasks"),
            auto: t("agentsColumnAuto"),
            waiting: t("agentsColumnWaiting"),
            errors: t("agentsColumnErrors"),
            response: t("agentsColumnResponse"),
            saved: t("agentsColumnSaved"),
            credits: t("agentsColumnCredits"),
            emptyTitle: t("agentsEmptyTitle"),
            emptyBody: t("agentsEmptyBody"),
        },
    }
}

/** Connects the owner's overview: the period in the address, the figures read for it, the chart's measure, and the places its regions lead to. */
export const OverviewDashboard = () => {
    const t = useTranslations("overview")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const overview = useOverview()
    const isPhone = useOverviewPhone()
    const copy = useOverviewCopy(overview.range)
    const [metric, setMetric] = useState<OverviewChartMetric>("revenue")
    return (
        <OverviewDashboardBase
            props={{
                copy,
                period: overview.period,
                slot: overview.slot,
                placeholder: overview.placeholder,
                labels: slotLabels(t("emptyTitle")),
                metric,
                isPhone,
                inboxHref: workspaceHref(workspaceId, CONSOLE_ROUTES.inbox),
                agentsHref: workspaceHref(workspaceId, AGENTS_ROUTE),
            }}
            on={{
                setPeriod: overview.setPeriod,
                exportReport: overview.exportReport,
                selectMetric: setMetric,
                openHref: (href) => router.push(workspaceHref(workspaceId, href)),
                openInbox: () => router.push(workspaceHref(workspaceId, CONSOLE_ROUTES.inbox)),
                openAgents: () => router.push(workspaceHref(workspaceId, AGENTS_ROUTE)),
                retry: overview.refresh,
            }}
        />
    )
}
