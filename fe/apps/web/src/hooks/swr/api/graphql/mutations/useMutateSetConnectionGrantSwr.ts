import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateSetConnectionGrant } from "@/modules/api/graphql/mutations/mutation-set-connection-grant"

/** The SWR key of the setConnectionGrant mutation. */
export const MUTATE_SET_CONNECTION_GRANT_SWR_KEY = "MUTATE_SET_CONNECTION_GRANT_SWR"

/** SWR mutation for {@link mutateSetConnectionGrant}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetConnectionGrantSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_SET_CONNECTION_GRANT_SWR_KEY,
        mutateSetConnectionGrant,
        (data) => data.setConnectionGrant,
    )
