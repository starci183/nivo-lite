"use client"

import { useTranslations } from "next-intl"
import { useQueryAccountingWorkbenchSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { useRequireActiveWorkspace } from "@/hooks/workspaces"
import { accountingPlaceholderOf } from "@/modules/utils"

/** The accounting read model of the active workspace, read once through the shared SWR cache for every accounting panel. */
export const useAccountingWorkbench = (isActive = true) => {
    const t = useTranslations("workbenchAccounting")
    const { activeWorkspaceId } = useRequireActiveWorkspace()
    const query = useQueryAccountingWorkbenchSwr(isActive ? activeWorkspaceId : undefined)
    const slot = slotOfSwr(query)
    return {
        read: query,
        slot,
        /** The read model once read, else the placeholder of the same shape the panel hooks draw while it is not there. */
        data: ("items" in slot ? slot.items : undefined) ?? accountingPlaceholderOf(t),
        retry: () => {
            void query.mutate()
        },
    }
}
