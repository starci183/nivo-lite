import useSWRMutation from "swr/mutation"
import { mutateUpdateMoneyConnection } from "@/modules/api/graphql/mutations/mutation-update-money-connection"
import type { MutateUpdateMoneyConnectionRequest } from "@/modules/api/graphql/mutations/mutation-update-money-connection"

/** What the updateMoneyConnection mutation is triggered with. */
interface UpdateMoneyConnectionArg {
    readonly arg: MutateUpdateMoneyConnectionRequest
}

/** The SWR key of the updateMoneyConnection mutation. */
export const MUTATE_UPDATE_MONEY_CONNECTION_SWR_KEY = "MUTATE_UPDATE_MONEY_CONNECTION_SWR"

/** SWR mutation for {@link mutateUpdateMoneyConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateUpdateMoneyConnectionSwr = () =>
    useSWRMutation(MUTATE_UPDATE_MONEY_CONNECTION_SWR_KEY, async (_key: string, { arg }: UpdateMoneyConnectionArg) => {
        const result = await mutateUpdateMoneyConnection({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("updateMoneyConnection answered no data")
        return result.data.updateMoneyConnection
    })
