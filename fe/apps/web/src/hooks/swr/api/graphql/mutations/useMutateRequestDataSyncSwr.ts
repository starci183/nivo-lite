import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateRequestDataSync } from "@/modules/api/graphql/mutations/mutation-request-data-sync"

/** The SWR key of the requestDataSync mutation. */
export const MUTATE_REQUEST_DATA_SYNC_SWR_KEY = "MUTATE_REQUEST_DATA_SYNC_SWR"

/** SWR mutation for {@link mutateRequestDataSync}: `trigger(input)` answers the queued run and rejects with the back end failure. */
export const useMutateRequestDataSyncSwr = () =>
    useGraphQLMutationSwr(MUTATE_REQUEST_DATA_SYNC_SWR_KEY, mutateRequestDataSync, (data) => data.requestDataSync)
