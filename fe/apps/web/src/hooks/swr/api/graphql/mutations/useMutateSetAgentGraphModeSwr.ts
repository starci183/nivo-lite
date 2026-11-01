"use client"

import { mutateSetAgentGraphMode } from "@/modules/api/graphql/mutations/mutation-set-agent-graph-mode"
import type { mutateSetAgentGraphMode as MutateSetAgentGraphModeOperation } from "@/modules/api/graphql/mutations/mutation-set-agent-graph-mode"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the setAgentGraphMode mutation. */
export const MUTATE_SET_AGENT_GRAPH_MODE_SWR_KEY = "MUTATE_SET_AGENT_GRAPH_MODE_SWR"

/** SWR mutation for {@link mutateSetAgentGraphMode}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetAgentGraphModeSwr = () =>
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
