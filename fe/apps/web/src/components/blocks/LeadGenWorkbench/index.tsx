"use client"

import { useTranslations } from "next-intl"
import { useAgentDashboard } from "@/hooks/agentDashboard"
import { leadGenFiguresOf, useLeadGenWorkbench } from "@/hooks/leadgen"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import { navigation } from "@/modules/i18n"
import { LeadGenWorkbenchBase } from "./component"

/** The selected tab, already resolved by the page, and the agent; the page draws the area of that tab under the frame. */
interface LeadGenWorkbenchProps {
    readonly tab: string
    /** The agent the dashboard is read for. */
    readonly installationId?: string | null
    /** The agent the workbench is read for: set only when the workspace runs several. */
    readonly workbenchInstallationId?: string | null
}

const PROVIDER_LABEL_KEYS: Readonly<Record<string, string>> = {
    telegram: "providerTelegram",
    sepay: "providerSepay",
    zalo_oa: "providerZalo",
}

/** The text a failed read shows: the failure's own message, else the generic region text. */
const errorTextOf = (error: unknown, fallback: string): string | null => {
    if (error instanceof Error) return error.message
    return error ? fallback : null
}

/** The Lead Gen workbench frame: the agent dashboard, the figures and the tabs, read from the GraphQL client. */
export const LeadGenWorkbench = (props: LeadGenWorkbenchProps) => {
    const t = useTranslations("workbenchLeadGen")
    const dashboardWords = useTranslations("agentDashboard")
    const connectionWords = useTranslations("connections")
    const governanceWords = useTranslations("governance")
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const workbench = useLeadGenWorkbench(props.workbenchInstallationId)
    const dashboard = useAgentDashboard(
        { module: "lead_gen", installationId: props.installationId },
        {
            decisionHref: (item) =>
                workbenchHref("lead_gen", { tab: "comments", focus: item.id, installationId: props.installationId }),
            completedHref: (item) =>
                item.resultHref || (item.leadId ? `/leads/${item.leadId}` : "/decisions?kind=policy&dept=lead_gen"),
            actionLabel: (action) =>
                governanceWords.has(`action_${action}`) ? governanceWords(`action_${action}`) : action,
            providerLabel: (provider) =>
                PROVIDER_LABEL_KEYS[provider] ? connectionWords(PROVIDER_LABEL_KEYS[provider]) : provider,
        },
    )
    const figures = workbench.data
        ? leadGenFiguresOf(workbench.data.metrics, t)
        : [
              { id: "newToday", term: t("figNewToday"), description: "" },
              { id: "hotWaiting", term: t("figHotWaiting"), description: "" },
              { id: "firstReply", term: t("figFirstReply"), description: "" },
              { id: "conversion", term: t("figConversion"), description: "" },
          ]
    const commentCount = workbench.data?.comments.length ?? 0
    return (
        <LeadGenWorkbenchBase
            props={{
                dashboard: dashboard.view,
                figures,
                tab: props.tab,
                isLoading: workbench.isLoading || dashboard.isLoading,
                error: errorTextOf(workbench.error ?? dashboard.error, dashboardWords("regionFailedText")),
                errorTitle: dashboardWords("regionFailed"),
                retryLabel: dashboardWords("retry"),
                labels: {
                    leads: t("tabLeads"),
                    sources: t("tabSources"),
                    comments: `${t("tabComments")}${commentCount > 0 ? ` (${commentCount})` : ""}`,
                    handoffs: t("tabHandoffs"),
                },
            }}
            on={{
                tab: (id) => router.replace(`${pathname}?tab=${id}`),
                retry: () => {
                    workbench.retry()
                    dashboard.retry()
                },
            }}
        />
    )
}
