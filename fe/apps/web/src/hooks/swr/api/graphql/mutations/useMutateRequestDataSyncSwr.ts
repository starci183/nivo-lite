"use client"

import { mutateRequestDataSync } from "@/modules/api/graphql/mutations/mutation-request-data-sync"
import type { mutateRequestDataSync as MutateRequestDataSyncOperation } from "@/modules/api/graphql/mutations/mutation-request-data-sync"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the requestDataSync mutation. */
export const MUTATE_REQUEST_DATA_SYNC_SWR_KEY = "MUTATE_REQUEST_DATA_SYNC_SWR"

/** SWR mutation for {@link mutateRequestDataSync}: `trigger(input)` answers the queued run and rejects with the back end failure. */
export const useMutateRequestDataSyncSwr = () =>
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
