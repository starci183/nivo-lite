import { useQueryPromoChatbotStateSwr } from "@/hooks/swr/api/graphql/queries/useQueryPromoChatbotStateSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"

/** Whether the selected workspace owns a Chatbot; idle unless `enabled`, so a caller that already knows it does not ask. */
export const useChatbotPromo = (enabled: boolean) => {
    const { activeWorkspaceId } = useActiveWorkspace()
    return useQueryPromoChatbotStateSwr(enabled ? activeWorkspaceId : undefined)
}
