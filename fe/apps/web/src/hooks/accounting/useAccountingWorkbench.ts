"use client"

import { useTranslations } from "next-intl"
import { useQueryAccountingWorkbenchSwr } from "@/hooks/swr"
import { useRequireActiveWorkspace } from "@/hooks/workspaces"

/** The accounting read model of the active workspace, read once through the shared SWR cache for every accounting panel. */
export const useAccountingWorkbench = () => {
    const t = useTranslations("workbenchAccounting")
    const frame = useTranslations("agentDashboard")
    const { activeWorkspaceId } = useRequireActiveWorkspace()
    const query = useQueryAccountingWorkbenchSwr(activeWorkspaceId)
    return {
        data: query.data,
        /** The words of a panel that could not be read; null while the read stands. */
        failure:
            query.error === undefined
                ? null
                : { title: t("loadFailedTitle"), description: t("loadFailedBody"), retryLabel: frame("retry") },
        retry: () => {
            void query.mutate()
        },
    }
}
