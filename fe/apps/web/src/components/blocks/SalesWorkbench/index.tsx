"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useAgentDashboardView } from "@/hooks/agentDashboard"
import { decisionHref } from "@/hooks/sales"
import { salesFiguresOf, withSalesWaiting } from "@/hooks/salesfigures"
import { useSalesWorkbench } from "@/hooks/salesworkbench"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"
import { navigation } from "@/modules/i18n"
import { leadPath } from "@/modules/routes"
import { SalesWorkbenchBase } from "./component"

const EMPTY_DASHBOARD: AgentDashboardData = {
    agent: null,
    waiting: { ok: false },
    done: { ok: false },
    connections: { ok: false },
    knowledge: { ok: false },
}
const count = (n: number): string => (n > 0 ? ` (${n})` : "")

/** The selected tab, already resolved by the page; the page draws the area of that tab under the frame. */
interface SalesWorkbenchProps {
    readonly tab: string
}

/** The Sales workbench frame: the agent dashboard, the figures and the tabs, read from the selected workspace's GraphQL queries. */
export const SalesWorkbench = (props: SalesWorkbenchProps) => {
    const t = useTranslations("workbenchSales")
    const governance = useTranslations("governance")
    const connections = useTranslations("connections")
    const frame = useTranslations("agentDashboard")
    const format = useFormatter()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const workbench = useSalesWorkbench()
    const dashboardQuery = useAgentDashboardView(
        { module: "sales" },
        {
            decisionHref: (item) => decisionHref(item.id),
            completedHref: (item) =>
                item.resultHref ?? (item.leadId ? leadPath(item.leadId) : workbenchHref("sales", { tab: "activity" })),
            actionLabel: (action) => (governance.has(`action_${action}`) ? governance(`action_${action}`) : action),
            providerLabel: (provider) =>
                connections.has(`provider_${provider}_title`) ? connections(`provider_${provider}_title`) : provider,
        },
    )
    const data = workbench.data
    const dashboard = dashboardQuery.view ?? EMPTY_DASHBOARD
    const decisions = data?.decisions ?? []
    const money = (amount: number | null): string =>
        amount === null
            ? "—"
            : format.number(amount, {
                  style: "currency",
                  currency: "VND",
                  maximumFractionDigits: 0,
              })
    return (
        <SalesWorkbenchBase
            props={{
                dashboard: data ? withSalesWaiting(dashboard, decisions) : dashboard,
                figures: data ? salesFiguresOf(data.metrics, { t, money }) : [],
                slot: {
                    isLoading: workbench.isLoading,
                    isError: !workbench.isLoading && !data,
                    items: data ? true : undefined,
                },
                tab: props.tab,
                labels: {
                    attention: `${t("tab_attention")}${count(data?.attention.length ?? 0)}`,
                    pipeline: t("tab_pipeline"),
                    decisions: `${t("tab_decisions")}${count(decisions.length)}`,
                    handoff: t("tab_handoff"),
                    contracts: t("tab_contracts"),
                    activity: t("tab_activity"),
                    slot: {
                        empty: t("loadFailedBody"),
                        forbidden: t("loadFailedBody"),
                        error: t("loadFailedTitle"),
                        retry: frame("retry"),
                    },
                },
            }}
            on={{
                tab: (id) => router.replace(`${pathname}?tab=${id}`),
                retry: () => {
                    workbench.retry()
                    dashboardQuery.retry()
                },
            }}
        />
    )
}
