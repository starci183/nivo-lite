"use client"

import { mutateConfirmAgentGraphProposal } from "@/modules/api/graphql/mutations/mutation-confirm-agent-graph-proposal"
import type { mutateConfirmAgentGraphProposal as MutateConfirmAgentGraphProposalOperation } from "@/modules/api/graphql/mutations/mutation-confirm-agent-graph-proposal"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the confirmAgentGraphProposal mutation. */
export const MUTATE_CONFIRM_AGENT_GRAPH_PROPOSAL_SWR_KEY = "MUTATE_CONFIRM_AGENT_GRAPH_PROPOSAL_SWR"

/** SWR mutation for {@link mutateConfirmAgentGraphProposal}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateConfirmAgentGraphProposalSwr = () =>
    useSWRMutation(
        MUTATE_CONFIRM_AGENT_GRAPH_PROPOSAL_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateConfirmAgentGraphProposal({ request: arg }),
                MUTATE_CONFIRM_AGENT_GRAPH_PROPOSAL_SWR_KEY,
            ).confirmAgentGraphProposal,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateConfirmAgentGraphProposalOperation>[0]["request"]
}
