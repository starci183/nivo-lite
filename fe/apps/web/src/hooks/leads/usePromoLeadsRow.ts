import { useQueryLeadBoardSwr } from "@/hooks/swr/api/graphql/queries/useQueryLeadBoardSwr"
import { useQueryPromoChatbotStateSwr } from "@/hooks/swr/api/graphql/queries/useQueryPromoChatbotStateSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"

/**
 * Whether the Chatbot promo row of the leads board may show: only once the workspace has leads and no Chatbot. `hasChatbot` is
 * true while either read is pending, so the promo stays hidden until both answered.
 */
export const usePromoLeadsRow = (isEnabled: boolean) => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const workspaceId = isEnabled ? activeWorkspaceId : undefined
    const { data: chatbot } = useQueryPromoChatbotStateSwr(workspaceId)
    const { data: leads } = useQueryLeadBoardSwr(workspaceId)
    const isReady = chatbot !== undefined && leads !== undefined && leads.length > 0
    return { hasChatbot: !isReady || chatbot.hasChatbot }
}
