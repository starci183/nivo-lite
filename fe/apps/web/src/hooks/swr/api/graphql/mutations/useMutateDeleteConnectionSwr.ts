import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateDeleteConnection } from "@/modules/api/graphql/mutations/mutation-delete-connection"

/** The SWR key of the deleteConnection mutation. */
export const MUTATE_DELETE_CONNECTION_SWR_KEY = "MUTATE_DELETE_CONNECTION_SWR"

/** SWR mutation for {@link mutateDeleteConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDeleteConnectionSwr = () =>
    useGraphQLMutationSwr(MUTATE_DELETE_CONNECTION_SWR_KEY, mutateDeleteConnection, (data) => data.deleteConnection)
