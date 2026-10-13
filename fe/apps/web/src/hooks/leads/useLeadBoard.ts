import { useQueryLeadBoardSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { DataSlot, LeadListItem } from "@/modules/types"
import { leadRecordOf } from "./leads.shared"

/** The browser query mapped to the lead-board display model. */
export const useLeadBoard = () => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQueryLeadBoardSwr(activeWorkspaceId)
    const items: ReadonlyArray<LeadListItem> | undefined = query.data?.map((lead) => ({
        ...leadRecordOf(lead),
        owner_name: lead.ownerName ?? null,
        next_action: lead.nextAction ?? null,
    }))
    const slot: DataSlot<ReadonlyArray<LeadListItem>> = {
        isLoading: query.isLoading,
        isError: query.error !== undefined,
        items,
    }
    return { ...query, slot }
}
