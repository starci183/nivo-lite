"use client"

import { useTranslations } from "next-intl"
import { useQueryLeadGenWorkbenchSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"

/** The prospects, sources, comments and Sales handoffs of one Lead Gen instance, read once through the shared SWR cache. */
export const useLeadGenWorkbench = (installationId: string | null) => {
    const t = useTranslations("workbenchLeadGen")
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQueryLeadGenWorkbenchSwr(activeWorkspaceId, installationId)
    return {
        data: query.data,
        /** The words of a panel that could not be read; null while the read stands. */
        failure:
            query.error === undefined
                ? null
                : { title: t("loadFailedTitle"), description: t("loadFailedBody"), retryLabel: t("retry") },
        retry: () => {
            void query.mutate()
        },
    }
}
