import useSWRMutation from "swr/mutation"
import { mutateTakeOverAgentChatConversation } from "@/modules/api/graphql/mutations/mutation-take-over-agent-chat-conversation"
import type { MutateTakeOverAgentChatConversationRequest } from "@/modules/api/graphql/mutations/mutation-take-over-agent-chat-conversation"

/** What the TakeOverAgentChatConversation mutation is triggered with. */
interface TakeOverAgentChatConversationArg {
    readonly arg: MutateTakeOverAgentChatConversationRequest
}

/** SWR identity for human takeover and handback. */
export const MUTATE_TAKE_OVER_AGENT_CHAT_CONVERSATION_SWR_KEY = "MUTATE_TAKE_OVER_AGENT_CHAT_CONVERSATION_SWR"

/** Gives the selected customer thread to a human or returns it to the agent. */
export const useMutateTakeOverAgentChatConversationSwr = (workspaceId: string) =>
    useSWRMutation(
        [MUTATE_TAKE_OVER_AGENT_CHAT_CONVERSATION_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: TakeOverAgentChatConversationArg) => {
            const result = await mutateTakeOverAgentChatConversation({
                request: arg,
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("takeOverAgentChatConversation answered no data")
            return result.data.takeOverAgentChatConversation
        },
    )
