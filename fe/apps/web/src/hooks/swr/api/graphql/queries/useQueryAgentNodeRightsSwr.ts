"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import { queryAgentNodeRights } from "@/modules/api/graphql/queries/query-agent-node-rights"
import type { AgentNodeRightsQuery } from "@/modules/api"

/** The SWR key of one agent's node rights; revalidate it after an attach, a detach or a publish that changed rights. */
export const QUERY_AGENT_NODE_RIGHTS_SWR_KEY = "QUERY_AGENT_NODE_RIGHTS_SWR"

/** One agent's node rights (the back end `agentNodeRights` query). Pass `null` while the agent is not known. */
export const useQueryAgentNodeRightsSwr = (agentId: string | null): ReadResponse<AgentNodeRightsQuery["agentNodeRights"]> =>
    useSWR(
        useWorkspaceKey(QUERY_AGENT_NODE_RIGHTS_SWR_KEY, [agentId], agentId !== null && agentId !== ""),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryAgentNodeRights({ request: { agentId: agentId ?? "" }, signal }), "agentNodeRights")
                .agentNodeRights,
        { errorRetryCount: 1 },
    )
