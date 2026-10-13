import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateStartZaloConnection } from "@/modules/api/graphql/mutations/mutation-start-zalo-connection"

/** The SWR key of the startZaloConnection mutation. */
export const MUTATE_START_ZALO_CONNECTION_SWR_KEY = "MUTATE_START_ZALO_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartZaloConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartZaloConnectionSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_START_ZALO_CONNECTION_SWR_KEY,
        mutateStartZaloConnection,
        (data) => data.startZaloConnection,
    )
