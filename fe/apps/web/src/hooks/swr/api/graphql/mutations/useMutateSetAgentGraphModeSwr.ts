"use client"

import {
    mutateSetAgentGraphMode,
    type mutateSetAgentGraphMode as MutateSetAgentGraphModeOperation,
} from "@/modules/api/graphql/mutations/mutation-set-agent-graph-mode"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { SetAgentGraphModeMutation } from "@/modules/api"

/** The SWR key of the setAgentGraphMode mutation. */
export const MUTATE_SET_AGENT_GRAPH_MODE_SWR_KEY = "MUTATE_SET_AGENT_GRAPH_MODE_SWR"

/** SWR mutation for {@link mutateSetAgentGraphMode}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetAgentGraphModeSwr = (): SWRMutationResponse<
    SetAgentGraphModeMutation["setAgentGraphMode"],
    Error,
    typeof MUTATE_SET_AGENT_GRAPH_MODE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SET_AGENT_GRAPH_MODE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetAgentGraphMode({ request: arg }), MUTATE_SET_AGENT_GRAPH_MODE_SWR_KEY)
                .setAgentGraphMode,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetAgentGraphModeOperation>[0]["request"]
}
