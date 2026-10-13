import useSWRMutation from "swr/mutation"
import { mutateDeleteConnection } from "@/modules/api/graphql/mutations/mutation-delete-connection"
import type { MutateDeleteConnectionRequest } from "@/modules/api/graphql/mutations/mutation-delete-connection"

/** What the deleteConnection mutation is triggered with. */
interface DeleteConnectionArg {
    readonly arg: MutateDeleteConnectionRequest
}

/** The SWR key of the deleteConnection mutation. */
export const MUTATE_DELETE_CONNECTION_SWR_KEY = "MUTATE_DELETE_CONNECTION_SWR"

/** SWR mutation for {@link mutateDeleteConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDeleteConnectionSwr = () =>
    useSWRMutation(MUTATE_DELETE_CONNECTION_SWR_KEY, async (_key: string, { arg }: DeleteConnectionArg) => {
        const result = await mutateDeleteConnection({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("deleteConnection answered no data")
        return result.data.deleteConnection
    })
