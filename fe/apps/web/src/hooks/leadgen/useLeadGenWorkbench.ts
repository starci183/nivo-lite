import { useFormatter, useTranslations } from "next-intl"
import { useAuthUser } from "@/hooks/auth"
import { handoffsViewOf, leadsViewOf, sourcesViewOf } from "@/hooks/leadgenView"
import { useQueryLeadGenAgentDashboardSwr, useQueryLeadGenWorkbenchSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"
import type { LeadGenMetrics } from "@/modules/types"
import { leadGenFiguresOf, leadGenTabOf } from "./leadgen.shared"

/** Route identity and initial tab; all data is read by browser hooks. */
interface LeadGenWorkbenchInput {
    readonly tab?: string | null
    readonly focus?: string | null
    readonly installationId?: string | null
    readonly scopeInstallationId?: string | null
}

const LOADING_METRICS: LeadGenMetrics = {
    newToday: 0,
    hotWaiting: 0,
    firstReplyP50Min: null,
    firstReplySample: 0,
    conversionWindowDays: 90,
    conversionLeads: 0,
    conversionWon: 0,
}

const FAILED_DASHBOARD: AgentDashboardData = {
    agent: null,
    waiting: { ok: false },
    done: { ok: false },
    connections: { ok: false },
    knowledge: { ok: false },
}

/** Whether any region of the shared frame could not be read. */
const hasFailedRegion = (dashboard: AgentDashboardData | undefined): boolean =>
    dashboard !== undefined &&
    (!dashboard.waiting.ok || !dashboard.done.ok || !dashboard.connections.ok || !dashboard.knowledge.ok)

/** The Lead Gen frame, its figures, its tabs' words and the retry; the comments tab has its own hook. */
export const useLeadGenWorkbench = (input: LeadGenWorkbenchInput) => {
    const t = useTranslations("workbenchLeadGen")
    const format = useFormatter()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { data: user } = useAuthUser()
    const workbench = useQueryLeadGenWorkbenchSwr(activeWorkspaceId, input.scopeInstallationId ?? null)
    const dashboard = useQueryLeadGenAgentDashboardSwr(activeWorkspaceId, input.installationId ?? null)
    const data = workbench.data
    return {
        scopeKey: `${activeWorkspaceId ?? ""}:${user?.id ?? ""}:${input.installationId ?? ""}`,
        comments: data?.comments ?? [],
        dashboard: dashboard.data ?? (dashboard.error ? FAILED_DASHBOARD : undefined),
        figures: leadGenFiguresOf(data?.metrics ?? LOADING_METRICS, t),
        leads: data ? leadsViewOf(t, format, data.leads, data.leadsHidden) : null,
        sources: data ? sourcesViewOf(t, data.sources) : null,
        handoffs: data ? handoffsViewOf(t, format, data.handoffs) : null,
        initialTab: leadGenTabOf(input.tab) ?? (input.focus ? "comments" : null),
        isLoading: (!data && !workbench.error) || dashboard.isLoading,
        failed: Boolean(workbench.error || dashboard.error || hasFailedRegion(dashboard.data)),
        figuresFailed: Boolean(workbench.error),
        hasData: data !== undefined,
        commentsTabLabel: `${t("tabComments")}${data?.comments.length ? ` (${data.comments.length})` : ""}`,
        labels: {
            leads: t("tabLeads"),
            sources: t("tabSources"),
            handoffs: t("tabHandoffs"),
            failedTitle: t("loadFailedTitle"),
            failedBody: t("loadFailedBody"),
            retry: t("retry"),
        },
        retry: () => {
            void workbench.mutate()
            void dashboard.mutate()
        },
    }
}
