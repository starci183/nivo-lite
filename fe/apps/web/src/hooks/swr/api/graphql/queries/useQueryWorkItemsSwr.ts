import type { SWRConfiguration } from "swr"
import { useGraphqlQuerySwr } from "@/hooks/reuseables/useGraphqlQuerySwr"
import { queryWorkItems } from "@/modules/api/graphql/queries/query-work-items"
import type { QueryWorkItemsRequest } from "@/modules/api/graphql/queries/query-work-items"

/** The SWR key of {@link useQueryWorkItemsSwr}. */
export const QUERY_WORK_ITEMS_SWR_KEY = "QUERY_WORK_ITEMS_SWR"

/** The back end `workItems` query. Pass `null` to wait for the arguments. */
export const useQueryWorkItemsSwr = (request: QueryWorkItemsRequest | null, config?: SWRConfiguration) =>
    useGraphqlQuerySwr(
        QUERY_WORK_ITEMS_SWR_KEY,
        request,
        (input) => queryWorkItems({ request: input }),
        (data) => data.workItems,
        config,
    )
