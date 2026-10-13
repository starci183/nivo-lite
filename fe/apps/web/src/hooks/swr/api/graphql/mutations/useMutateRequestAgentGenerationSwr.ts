import { mutateRequestAgentGeneration } from "@/modules/api/graphql/mutations/mutation-request-agent-generation"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the requestAgentGeneration mutation. */
const MUTATE_REQUEST_AGENT_GENERATION_SWR_KEY = "MUTATE_REQUEST_AGENT_GENERATION_SWR"

/** SWR mutation for {@link mutateRequestAgentGeneration}: `trigger(input)` answers the queued id (or the refusal). */
export const useMutateRequestAgentGenerationSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_REQUEST_AGENT_GENERATION_SWR_KEY,
        mutateRequestAgentGeneration,
        (data) => data.requestAgentGeneration,
    )
