import { useQueryLeadWaitSwr } from "@/hooks/swr/api/graphql/queries/useQueryLeadWaitSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"

/** How long a website lead waits for a reply and whether the Chatbot note is worth showing for it. */
export const useLeadWait = (leadId: string) => {
    const { activeWorkspaceId } = useActiveWorkspace()
    return useQueryLeadWaitSwr(activeWorkspaceId, leadId)
}
