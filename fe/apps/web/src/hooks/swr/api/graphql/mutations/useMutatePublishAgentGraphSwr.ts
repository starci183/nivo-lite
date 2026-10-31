"use client"

import { mutatePublishAgentGraph } from "@/modules/api/graphql/mutations/mutation-publish-agent-graph"
import type { mutatePublishAgentGraph as MutatePublishAgentGraphOperation } from "@/modules/api/graphql/mutations/mutation-publish-agent-graph"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the publishAgentGraph mutation. */
export const MUTATE_PUBLISH_AGENT_GRAPH_SWR_KEY = "MUTATE_PUBLISH_AGENT_GRAPH_SWR"

/** SWR mutation for {@link mutatePublishAgentGraph}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutatePublishAgentGraphSwr = () =>
    useSWRMutation(
        MUTATE_PUBLISH_AGENT_GRAPH_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutatePublishAgentGraph({ request: arg }), MUTATE_PUBLISH_AGENT_GRAPH_SWR_KEY)
                .publishAgentGraph,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutatePublishAgentGraphOperation>[0]["request"]
}
