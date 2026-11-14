"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRConfiguration } from "swr"
import { queryAgentKnowledge, type QueryAgentKnowledgeRequest } from "@/modules/api/graphql/queries/query-agent-knowledge"
import type { AgentKnowledgeQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentKnowledgeSwr}. */
export const QUERY_AGENT_KNOWLEDGE_SWR_KEY = "QUERY_AGENT_KNOWLEDGE_SWR"

/** The back end `agentKnowledge` query: what one agent reads of the shared knowledge. Pass `null` to wait for the agent. */
export const useQueryAgentKnowledgeSwr = (
    request: QueryAgentKnowledgeRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentKnowledgeQuery["agentKnowledge"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_KNOWLEDGE_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentKnowledgeRequest>) =>
            answeredData(await queryAgentKnowledge({ request: input }), QUERY_AGENT_KNOWLEDGE_SWR_KEY).agentKnowledge,
        config,
    )
