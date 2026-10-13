import { useQueryLeadFlowSwr } from "@/hooks/swr/api/graphql/queries/useQueryLeadFlowSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"

/** The work flow of one lead (steps, decisions, orders, invoices, transactions) read through the shared SWR cache; `undefined` pauses it. */
export const useLeadFlow = (leadId: string | undefined) => {
    const { activeWorkspaceId } = useActiveWorkspace()
    return useQueryLeadFlowSwr(activeWorkspaceId, leadId)
}
