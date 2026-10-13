import useSWRMutation from "swr/mutation"
import { mutateStartZaloConnection } from "@/modules/api/graphql/mutations/mutation-start-zalo-connection"
import type { MutateStartZaloConnectionRequest } from "@/modules/api/graphql/mutations/mutation-start-zalo-connection"

/** What the startZaloConnection mutation is triggered with. */
interface StartZaloConnectionArg {
    readonly arg: MutateStartZaloConnectionRequest
}

/** The SWR key of the startZaloConnection mutation. */
export const MUTATE_START_ZALO_CONNECTION_SWR_KEY = "MUTATE_START_ZALO_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartZaloConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartZaloConnectionSwr = () =>
    useSWRMutation(MUTATE_START_ZALO_CONNECTION_SWR_KEY, async (_key: string, { arg }: StartZaloConnectionArg) => {
        const result = await mutateStartZaloConnection({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("startZaloConnection answered no data")
        return result.data.startZaloConnection
    })
