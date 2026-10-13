import useSWR from "swr"
import { queryWorkItems } from "@/modules/api/graphql/queries"
import type { QueryWorkItemsRequest } from "@/modules/api/graphql/queries/types/work-items"

/** The SWR key of the `workItems` query; mutations that change it match it with {@link isQueryWorkItemsSwrKey}. */
export const QUERY_WORK_ITEMS_SWR_KEY = "QUERY_WORK_ITEMS_SWR"

/** Matches every key of `workItems` (the plain key and the argument tuples), for SWR mutate revalidation. */
export const isQueryWorkItemsSwrKey = (key: unknown): boolean =>
    key === QUERY_WORK_ITEMS_SWR_KEY || (Array.isArray(key) && key[0] === QUERY_WORK_ITEMS_SWR_KEY)

/** The work items of the active workspace, filtered by status (the loyalty pending tab asks for waiting_decision). */
export const useQueryWorkItemsSwr = (request: QueryWorkItemsRequest | null) =>
    useSWR(
        request === null ? null : [QUERY_WORK_ITEMS_SWR_KEY, request],
        async (key: readonly [string, QueryWorkItemsRequest]) => {
            const result = await queryWorkItems({ request: key[1] })
            if (!result.data) throw new Error("workItems answered no data")
            return result.data.workItems
        },
    )
