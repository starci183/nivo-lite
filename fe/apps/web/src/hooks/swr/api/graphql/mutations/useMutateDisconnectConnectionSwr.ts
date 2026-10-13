import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateDisconnectConnection } from "@/modules/api/graphql/mutations/mutation-disconnect-connection"

/** The SWR key of the disconnectConnection mutation. */
export const MUTATE_DISCONNECT_CONNECTION_SWR_KEY = "MUTATE_DISCONNECT_CONNECTION_SWR"

/** SWR mutation for {@link mutateDisconnectConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDisconnectConnectionSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_DISCONNECT_CONNECTION_SWR_KEY,
        mutateDisconnectConnection,
        (data) => data.disconnectConnection,
    )
