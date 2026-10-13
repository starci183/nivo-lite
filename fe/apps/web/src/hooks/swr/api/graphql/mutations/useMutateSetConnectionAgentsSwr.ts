import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateSetConnectionAgents } from "@/modules/api/graphql/mutations/mutation-set-connection-agents"

/** The SWR key of the setConnectionAgents mutation. */
export const MUTATE_SET_CONNECTION_AGENTS_SWR_KEY = "MUTATE_SET_CONNECTION_AGENTS_SWR"

/** SWR mutation for {@link mutateSetConnectionAgents}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetConnectionAgentsSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_SET_CONNECTION_AGENTS_SWR_KEY,
        mutateSetConnectionAgents,
        (data) => data.setConnectionAgents,
    )
