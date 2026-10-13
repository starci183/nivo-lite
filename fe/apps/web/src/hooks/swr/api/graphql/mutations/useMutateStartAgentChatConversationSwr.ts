import useSWRMutation from "swr/mutation"
import { mutateStartAgentChatConversation } from "@/modules/api/graphql/mutations/mutation-start-agent-chat-conversation"
import type { MutateStartAgentChatConversationRequest } from "@/modules/api/graphql/mutations/mutation-start-agent-chat-conversation"

/** What the StartAgentChatConversation mutation is triggered with. */
interface StartAgentChatConversationArg {
    readonly arg: MutateStartAgentChatConversationRequest
}

/** SWR identity for starting an agent conversation. */
export const MUTATE_START_AGENT_CHAT_CONVERSATION_SWR_KEY = "MUTATE_START_AGENT_CHAT_CONVERSATION_SWR"

/** Starts a conversation with the generated mutation input. */
export const useMutateStartAgentChatConversationSwr = (workspaceId: string) =>
    useSWRMutation(
        [MUTATE_START_AGENT_CHAT_CONVERSATION_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: StartAgentChatConversationArg) => {
            const result = await mutateStartAgentChatConversation({
                request: arg,
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("startAgentChatConversation answered no data")
            return result.data.startAgentChatConversation
        },
    )
