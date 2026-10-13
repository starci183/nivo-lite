import { useTranslations } from "next-intl"
import { useQueryMyWorkspacesSwr } from "@/hooks/swr/api/graphql/queries/useQueryMyWorkspacesSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { FAILED_DASHBOARD, errorOf, figuresOf } from "./chatbotWorkbench.shared"
import { useChatbotDashboard } from "./useChatbotDashboard"
import { useChatbotOverview } from "./useChatbotOverview"

/** The workbench frame of one Chatbot instance: inbox snapshot, dashboard regions, figures and who is looking. */
export const useChatbotWorkbench = (installationId: string | undefined, focus: string | null) => {
    const t = useTranslations("workbenchChatbot")
    const { activeWorkspaceId } = useActiveWorkspace()
    const memberships = useQueryMyWorkspacesSwr()
    const member = memberships.data?.find((membership) => membership.workspace.id === activeWorkspaceId)?.member
    const overview = useChatbotOverview(activeWorkspaceId, installationId)
    const dashboard = useChatbotDashboard(activeWorkspaceId, installationId, overview.data)
    const isLoading =
        activeWorkspaceId === undefined || overview.isLoading || dashboard.isLoading || memberships.isLoading
    const selected = overview.data?.conversations.find((item) => item.id === focus) ?? overview.data?.conversations[0]
    const isRegionFailed =
        dashboard.data !== undefined &&
        [dashboard.data.waiting, dashboard.data.done, dashboard.data.connections, dashboard.data.knowledge].some(
            (region) => !region.ok,
        )
    const failure = overview.error ?? dashboard.error ?? memberships.error
    return {
        workspaceId: activeWorkspaceId,
        isLoading,
        overview: overview.data,
        selectedId: selected?.id ?? null,
        userName: member?.displayName ?? "",
        userId: member?.userId ?? "",
        canFillGaps: member?.role === "owner" || member?.role === "manager",
        dashboard: isLoading ? undefined : (dashboard.data ?? FAILED_DASHBOARD),
        figures: figuresOf(t, overview.data?.metrics),
        figuresFailed: !isLoading && overview.data === undefined,
        error: errorOf(failure, isRegionFailed, t("loadError")),
        reload: () => {
            void Promise.allSettled([overview.mutate(), dashboard.mutate(), memberships.mutate()])
        },
    }
}
