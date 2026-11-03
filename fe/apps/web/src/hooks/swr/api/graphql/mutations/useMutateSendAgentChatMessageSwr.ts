"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSendAgentChatMessage,
    type MutateSendAgentChatMessageRequest,
} from "@/modules/api/graphql/mutations/mutation-send-agent-chat-message"
import type { SWRMutationResponse } from "swr/mutation"
import type { SendAgentChatMessageMutation } from "@/modules/api"

/** What the SendAgentChatMessage mutation is triggered with. */
interface SendAgentChatMessageArg {
    readonly arg: MutateSendAgentChatMessageRequest
}

/** SWR identity for queued messages and deliveries. */
export const MUTATE_SEND_AGENT_CHAT_MESSAGE_SWR_KEY = "MUTATE_SEND_AGENT_CHAT_MESSAGE_SWR"

/** Queues a message without waiting for the engine or delivery provider. */
export const useMutateSendAgentChatMessageSwr = (
    workspaceId: string,
): SWRMutationResponse<
    SendAgentChatMessageMutation["sendAgentChatMessage"],
    Error,
    [string, string],
    SendAgentChatMessageArg["arg"]
> =>
    useSWRMutation(
        [MUTATE_SEND_AGENT_CHAT_MESSAGE_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: SendAgentChatMessageArg) => {
            const result = await mutateSendAgentChatMessage({ request: arg, headers: { "X-Workspace-Id": scope } })
            if (!result.data) throw new Error("sendAgentChatMessage answered no data")
            return result.data.sendAgentChatMessage
        },
    )
