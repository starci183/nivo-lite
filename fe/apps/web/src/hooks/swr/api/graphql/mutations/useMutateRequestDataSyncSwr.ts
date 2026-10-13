import useSWRMutation from "swr/mutation"
import { mutateRequestDataSync } from "@/modules/api/graphql/mutations/mutation-request-data-sync"
import type { MutateRequestDataSyncRequest } from "@/modules/api/graphql/mutations/mutation-request-data-sync"

/** What the requestDataSync mutation is triggered with. */
interface RequestDataSyncArg {
    readonly arg: MutateRequestDataSyncRequest
}

/** The SWR key of the requestDataSync mutation. */
export const MUTATE_REQUEST_DATA_SYNC_SWR_KEY = "MUTATE_REQUEST_DATA_SYNC_SWR"

/** SWR mutation for {@link mutateRequestDataSync}: `trigger(input)` answers the queued run and rejects with the back end failure. */
export const useMutateRequestDataSyncSwr = () =>
    useSWRMutation(MUTATE_REQUEST_DATA_SYNC_SWR_KEY, async (_key: string, { arg }: RequestDataSyncArg) => {
        const result = await mutateRequestDataSync({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("requestDataSync answered no data")
        return result.data.requestDataSync
    })
