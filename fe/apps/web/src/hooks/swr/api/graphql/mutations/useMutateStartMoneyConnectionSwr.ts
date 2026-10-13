import useSWRMutation from "swr/mutation"
import { mutateStartMoneyConnection } from "@/modules/api/graphql/mutations/mutation-start-money-connection"
import type { MutateStartMoneyConnectionRequest } from "@/modules/api/graphql/mutations/mutation-start-money-connection"

/** What the startMoneyConnection mutation is triggered with. */
interface StartMoneyConnectionArg {
    readonly arg: MutateStartMoneyConnectionRequest
}

/** The SWR key of the startMoneyConnection mutation. */
export const MUTATE_START_MONEY_CONNECTION_SWR_KEY = "MUTATE_START_MONEY_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartMoneyConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartMoneyConnectionSwr = () =>
    useSWRMutation(MUTATE_START_MONEY_CONNECTION_SWR_KEY, async (_key: string, { arg }: StartMoneyConnectionArg) => {
        const result = await mutateStartMoneyConnection({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("startMoneyConnection answered no data")
        return result.data.startMoneyConnection
    })
