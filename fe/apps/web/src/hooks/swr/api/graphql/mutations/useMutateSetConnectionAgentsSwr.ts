"use client"

import {
    mutateSetConnectionAgents,
    type mutateSetConnectionAgents as MutateSetConnectionAgentsOperation,
} from "@/modules/api/graphql/mutations/mutation-set-connection-agents"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRMutationResponse } from "swr/mutation"
import type { SetConnectionAgentsMutation } from "@/modules/api"

/** The SWR key of the setConnectionAgents mutation. */
export const MUTATE_SET_CONNECTION_AGENTS_SWR_KEY = "MUTATE_SET_CONNECTION_AGENTS_SWR"

/** SWR mutation for {@link mutateSetConnectionAgents}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetConnectionAgentsSwr = (): SWRMutationResponse<
    SetConnectionAgentsMutation["setConnectionAgents"],
    Error,
    typeof MUTATE_SET_CONNECTION_AGENTS_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SET_CONNECTION_AGENTS_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetConnectionAgents({ request: arg }), MUTATE_SET_CONNECTION_AGENTS_SWR_KEY)
                .setConnectionAgents,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetConnectionAgentsOperation>[0]["request"]
}
