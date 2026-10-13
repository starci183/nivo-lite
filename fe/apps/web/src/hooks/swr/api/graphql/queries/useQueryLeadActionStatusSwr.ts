import type { SWRConfiguration } from "swr"
import { useGraphqlQuerySwr } from "@/hooks/reuseables/useGraphqlQuerySwr"
import { queryLeadActionStatus } from "@/modules/api/graphql/queries/query-lead-action-status"
import type { QueryLeadActionStatusRequest } from "@/modules/api/graphql/queries/query-lead-action-status"

/** The SWR key of {@link useQueryLeadActionStatusSwr}. */
export const QUERY_LEAD_ACTION_STATUS_SWR_KEY = "QUERY_LEAD_ACTION_STATUS_SWR"

/** The back end `leadActionStatus` query. Pass `null` to wait for the arguments. */
export const useQueryLeadActionStatusSwr = (request: QueryLeadActionStatusRequest | null, config?: SWRConfiguration) =>
    useGraphqlQuerySwr(
        QUERY_LEAD_ACTION_STATUS_SWR_KEY,
        request,
        (input) => queryLeadActionStatus({ request: input }),
        (data) => data.leadActionStatus,
        config,
    )
