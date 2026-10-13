import useSWRMutation from "swr/mutation"
import { mutateDisconnectConnection } from "@/modules/api/graphql/mutations/mutation-disconnect-connection"
import type { MutateDisconnectConnectionRequest } from "@/modules/api/graphql/mutations/mutation-disconnect-connection"

/** What the disconnectConnection mutation is triggered with. */
interface DisconnectConnectionArg {
    readonly arg: MutateDisconnectConnectionRequest
}

/** The SWR key of the disconnectConnection mutation. */
export const MUTATE_DISCONNECT_CONNECTION_SWR_KEY = "MUTATE_DISCONNECT_CONNECTION_SWR"

/** SWR mutation for {@link mutateDisconnectConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDisconnectConnectionSwr = () =>
    useSWRMutation(MUTATE_DISCONNECT_CONNECTION_SWR_KEY, async (_key: string, { arg }: DisconnectConnectionArg) => {
        const result = await mutateDisconnectConnection({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("disconnectConnection answered no data")
        return result.data.disconnectConnection
    })
