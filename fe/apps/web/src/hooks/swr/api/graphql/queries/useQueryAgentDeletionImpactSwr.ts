"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryAgentDeletionImpact } from "@/modules/api/graphql/queries/query-agent-deletion-impact"
import type { AgentDeletionImpactQuery } from "@/modules/api"

/** The SWR key of what removing one agent erases. */
export const QUERY_AGENT_DELETION_IMPACT_SWR_KEY = "QUERY_AGENT_DELETION_IMPACT_SWR"

/** What removing an agent erases (the back end `agentDeletionImpact` query); `undefined` installation waits (the dialog is closed). */
export const useQueryAgentDeletionImpactSwr = (
    installationId: string | undefined,
): ReadResponse<AgentDeletionImpactQuery["agentDeletionImpact"]> => {
    const key = useWorkspaceKey(QUERY_AGENT_DELETION_IMPACT_SWR_KEY, [installationId ?? ""], installationId !== undefined)
    return useSWR(
        key,
        async ([, , id]: WorkspaceReadKey<string>) =>
            answeredData(await queryAgentDeletionImpact({ request: { installationId: id } }), "agentDeletionImpact")
                .agentDeletionImpact,
        { revalidateOnFocus: false, revalidateIfStale: true, dedupingInterval: 0 },
    )
}
