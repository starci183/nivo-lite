import { useQueryPromoChatbotStateSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"

import type { SWRResponse } from "swr"

type UseChatbotPromoResult = SWRResponse<
    {
        hasChatbot: boolean
        agentId: string | null
        handle: string | null
        name: string | null
    },
    unknown
>

/** Whether the selected workspace owns a Chatbot; idle unless `enabled`, so a caller that already knows it does not ask. */
export const useChatbotPromo = (enabled: boolean): UseChatbotPromoResult => {
    const { activeWorkspaceId } = useActiveWorkspace()
    return useQueryPromoChatbotStateSwr(enabled ? activeWorkspaceId : undefined)
}
