import useSWRMutation from "swr/mutation"
import { mutateSetConnectionAgents } from "@/modules/api/graphql/mutations/mutation-set-connection-agents"
import type { MutateSetConnectionAgentsRequest } from "@/modules/api/graphql/mutations/mutation-set-connection-agents"

/** What the setConnectionAgents mutation is triggered with. */
interface SetConnectionAgentsArg {
    readonly arg: MutateSetConnectionAgentsRequest
}

/** The SWR key of the setConnectionAgents mutation. */
export const MUTATE_SET_CONNECTION_AGENTS_SWR_KEY = "MUTATE_SET_CONNECTION_AGENTS_SWR"

/** SWR mutation for {@link mutateSetConnectionAgents}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetConnectionAgentsSwr = () =>
    useSWRMutation(MUTATE_SET_CONNECTION_AGENTS_SWR_KEY, async (_key: string, { arg }: SetConnectionAgentsArg) => {
        const result = await mutateSetConnectionAgents({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("setConnectionAgents answered no data")
        return result.data.setConnectionAgents
    })
