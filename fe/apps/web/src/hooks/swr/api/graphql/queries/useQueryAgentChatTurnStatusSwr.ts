"use client"

import { workspaceArgumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { AgentChatTurnStatusType } from "@/modules/api"
import { queryAgentChatTurnStatus } from "@/modules/api/graphql/queries/query-agent-chat-turn-status"

/** SWR identity for the backend job state of an accepted message. */
export const QUERY_AGENT_CHAT_TURN_STATUS_SWR_KEY = "QUERY_AGENT_CHAT_TURN_STATUS_SWR"

/** Whether the turn is final: nothing more will change in it. */
const isFinal = (turn: AgentChatTurnStatusType | undefined): boolean =>
    turn?.status === "succeeded" || turn?.status === "failed"

/** Polls a queued chat turn or delivery until its authoritative terminal state; `onSettled` hears the final one. */
export const useQueryAgentChatTurnStatusSwr = (
    workspaceId: string | undefined,
    id: string | undefined,
    onSettled: (turn: AgentChatTurnStatusType) => void,
) =>
    useSWR(
        workspaceArgumentKey(QUERY_AGENT_CHAT_TURN_STATUS_SWR_KEY, workspaceId, id),
        async ([, scope, messageId]: [string, string, string]) => {
            const result = await queryAgentChatTurnStatus({
                request: { id: messageId },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("agentChatTurnStatus answered no data")
            return result.data.agentChatTurnStatus
        },
        {
            refreshInterval: (data) => (isFinal(data) ? 0 : 2000),
            onSuccess: (data) => {
                if (isFinal(data)) onSettled(data)
            },
        },
    )
