"use client"

import { mutateConfirmAgentGraphProposal } from "@/modules/api/graphql/mutations/mutation-confirm-agent-graph-proposal"
import type { mutateConfirmAgentGraphProposal as MutateConfirmAgentGraphProposalOperation } from "@/modules/api/graphql/mutations/mutation-confirm-agent-graph-proposal"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the confirmAgentGraphProposal mutation. */
export const MUTATE_CONFIRM_AGENT_GRAPH_PROPOSAL_SWR_KEY = "MUTATE_CONFIRM_AGENT_GRAPH_PROPOSAL_SWR"

/** SWR mutation for {@link mutateConfirmAgentGraphProposal}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateConfirmAgentGraphProposalSwr = (): SWRMutationResponse<
    OperationData<typeof mutateConfirmAgentGraphProposal>["confirmAgentGraphProposal"],
    Error,
    typeof MUTATE_CONFIRM_AGENT_GRAPH_PROPOSAL_SWR_KEY,
    TriggerArg["arg"]
> =>
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
