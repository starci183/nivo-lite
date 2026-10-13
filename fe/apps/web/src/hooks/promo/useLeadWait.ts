import { useQueryLeadWaitSwr } from "@/hooks/swr/api/graphql/queries/useQueryLeadWaitSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"

/** How long a website lead waited for its first reply, when the back end says the note is worth showing. */
export const useLeadWait = (leadId: string) => {
    const { activeWorkspaceId } = useActiveWorkspace()
    return useQueryLeadWaitSwr(activeWorkspaceId, leadId)
}
