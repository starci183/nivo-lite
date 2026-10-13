import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateCheckConnection } from "@/modules/api/graphql/mutations/mutation-check-connection"

/** The SWR key of the checkConnection mutation. */
export const MUTATE_CHECK_CONNECTION_SWR_KEY = "MUTATE_CHECK_CONNECTION_SWR"

/** SWR mutation for {@link mutateCheckConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCheckConnectionSwr = () =>
    useGraphQLMutationSwr(MUTATE_CHECK_CONNECTION_SWR_KEY, mutateCheckConnection, (data) => data.checkConnection)
