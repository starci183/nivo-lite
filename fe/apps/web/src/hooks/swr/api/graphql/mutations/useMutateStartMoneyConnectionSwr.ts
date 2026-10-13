import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateStartMoneyConnection } from "@/modules/api/graphql/mutations/mutation-start-money-connection"

/** The SWR key of the startMoneyConnection mutation. */
export const MUTATE_START_MONEY_CONNECTION_SWR_KEY = "MUTATE_START_MONEY_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartMoneyConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartMoneyConnectionSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_START_MONEY_CONNECTION_SWR_KEY,
        mutateStartMoneyConnection,
        (data) => data.startMoneyConnection,
    )
