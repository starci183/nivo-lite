import useSWRMutation from "swr/mutation"
import { mutateCheckConnection } from "@/modules/api/graphql/mutations/mutation-check-connection"
import type { MutateCheckConnectionRequest } from "@/modules/api/graphql/mutations/mutation-check-connection"

/** What the checkConnection mutation is triggered with. */
interface CheckConnectionArg {
    readonly arg: MutateCheckConnectionRequest
}

/** The SWR key of the checkConnection mutation. */
export const MUTATE_CHECK_CONNECTION_SWR_KEY = "MUTATE_CHECK_CONNECTION_SWR"

/** SWR mutation for {@link mutateCheckConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCheckConnectionSwr = () =>
    useSWRMutation(MUTATE_CHECK_CONNECTION_SWR_KEY, async (_key: string, { arg }: CheckConnectionArg) => {
        const result = await mutateCheckConnection({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("checkConnection answered no data")
        return result.data.checkConnection
    })
