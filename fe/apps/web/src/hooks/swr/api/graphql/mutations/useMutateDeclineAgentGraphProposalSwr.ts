"use client"

import { mutateDeclineAgentGraphProposal } from "@/modules/api/graphql/mutations/mutation-decline-agent-graph-proposal"
import type { mutateDeclineAgentGraphProposal as MutateDeclineAgentGraphProposalOperation } from "@/modules/api/graphql/mutations/mutation-decline-agent-graph-proposal"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the declineAgentGraphProposal mutation. */
export const MUTATE_DECLINE_AGENT_GRAPH_PROPOSAL_SWR_KEY = "MUTATE_DECLINE_AGENT_GRAPH_PROPOSAL_SWR"

/** SWR mutation for {@link mutateDeclineAgentGraphProposal}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDeclineAgentGraphProposalSwr = () =>
    useSWRMutation(
        MUTATE_DECLINE_AGENT_GRAPH_PROPOSAL_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateDeclineAgentGraphProposal({ request: arg }),
                MUTATE_DECLINE_AGENT_GRAPH_PROPOSAL_SWR_KEY,
            ).declineAgentGraphProposal,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateDeclineAgentGraphProposalOperation>[0]["request"]
}
