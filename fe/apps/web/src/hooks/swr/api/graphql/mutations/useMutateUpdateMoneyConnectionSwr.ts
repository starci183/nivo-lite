import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateUpdateMoneyConnection } from "@/modules/api/graphql/mutations/mutation-update-money-connection"

/** The SWR key of the updateMoneyConnection mutation. */
export const MUTATE_UPDATE_MONEY_CONNECTION_SWR_KEY = "MUTATE_UPDATE_MONEY_CONNECTION_SWR"

/** SWR mutation for {@link mutateUpdateMoneyConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateUpdateMoneyConnectionSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_UPDATE_MONEY_CONNECTION_SWR_KEY,
        mutateUpdateMoneyConnection,
        (data) => data.updateMoneyConnection,
    )
