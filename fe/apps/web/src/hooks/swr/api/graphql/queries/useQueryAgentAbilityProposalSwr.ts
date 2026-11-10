"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryAgentAbilityProposal } from "@/modules/api/graphql/queries/query-agent-ability-proposal"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { AgentAbilityProposalQuery } from "@/modules/api"

/** The SWR key of the agentAbilityProposal query. */
export const QUERY_AGENT_ABILITY_PROPOSAL_SWR_KEY = "QUERY_AGENT_ABILITY_PROPOSAL_SWR"

/** The connected providers a template names, pre-ticked. Pass `null` to wait for the template. */
export const useQueryAgentAbilityProposalSwr = (moduleKey: string | null): ReadResponse<AgentAbilityProposalQuery["agentAbilityProposal"]> =>
    useSWR(
        useWorkspaceKey(QUERY_AGENT_ABILITY_PROPOSAL_SWR_KEY, [moduleKey], moduleKey !== null && moduleKey !== ""),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(
                await queryAgentAbilityProposal({ request: { moduleKey: moduleKey ?? "" }, signal }),
                "agentAbilityProposal",
            ).agentAbilityProposal,
    )
