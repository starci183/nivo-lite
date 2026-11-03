import { useQueryLeadBoardSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { slotOfSwr } from "@/hooks/slot"
import type { DataSlot, LeadListItem } from "@/modules/types"
import { leadRecordOf } from "./leads.shared"

/** The view `useLeadBoard` returns. */
export interface LeadBoardView extends ReturnType<typeof useQueryLeadBoardSwr> {
    slot: DataSlot<readonly LeadListItem[]>
}

/** The browser query mapped to the lead-board display model. */
export const useLeadBoard = (): LeadBoardView => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQueryLeadBoardSwr(activeWorkspaceId)
    const items: ReadonlyArray<LeadListItem> | undefined = query.data?.map((lead) => ({
        ...leadRecordOf(lead),
        owner_name: lead.ownerName ?? null,
        next_action: lead.nextAction ?? null,
    }))
    const slot: DataSlot<ReadonlyArray<LeadListItem>> = slotOfSwr({
        data: items,
        error: query.error,
        isLoading: query.isLoading,
        isValidating: query.isValidating,
    })
    return { ...query, slot }
}
