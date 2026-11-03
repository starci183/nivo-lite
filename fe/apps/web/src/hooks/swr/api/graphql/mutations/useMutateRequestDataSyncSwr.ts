"use client"

import {
    mutateRequestDataSync,
    type mutateRequestDataSync as MutateRequestDataSyncOperation,
} from "@/modules/api/graphql/mutations/mutation-request-data-sync"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { RequestDataSyncMutation } from "@/modules/api"

/** The SWR key of the requestDataSync mutation. */
export const MUTATE_REQUEST_DATA_SYNC_SWR_KEY = "MUTATE_REQUEST_DATA_SYNC_SWR"

/** SWR mutation for {@link mutateRequestDataSync}: `trigger(input)` answers the queued run and rejects with the back end failure. */
export const useMutateRequestDataSyncSwr = (): SWRMutationResponse<
    RequestDataSyncMutation["requestDataSync"],
    Error,
    typeof MUTATE_REQUEST_DATA_SYNC_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REQUEST_DATA_SYNC_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRequestDataSync({ request: arg }), MUTATE_REQUEST_DATA_SYNC_SWR_KEY)
                .requestDataSync,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRequestDataSyncOperation>[0]["request"]
}
