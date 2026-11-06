"use client"

import { useTranslations } from "next-intl"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryLeadGenWorkbenchSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { LeadGenWorkbenchData, DataSlot } from "@/modules/types"

/** The view `useLeadGenWorkbench` returns. */
export interface LeadGenWorkbenchView {
    data: LeadGenWorkbenchData | undefined
    /** The read as a slot: items once read, loading while in flight, error when it failed. */
    slot: DataSlot<LeadGenWorkbenchData>
    /** The words of a panel that could not be read; null while the read stands. */
    failure: {
        title: string
        description: string
        retryLabel: string
    } | null
    retry: () => void
}

/** The prospects, sources, comments and Sales handoffs of one Lead Gen instance, read once through the shared SWR cache. */
export const useLeadGenWorkbench = (installationId: string | null): LeadGenWorkbenchView => {
    const t = useTranslations("workbenchLeadGen")
    const workspaceId = useWorkspaceId()
    const query = useQueryLeadGenWorkbenchSwr(workspaceId, installationId)
    return {
        data: query.data,
        /** The read as a slot: items once read, loading while in flight, error when it failed. */
        slot: slotOfSwr(query),
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
