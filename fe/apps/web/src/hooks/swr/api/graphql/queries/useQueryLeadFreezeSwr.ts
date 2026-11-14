"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRConfiguration } from "swr"
import { queryLeadFreeze, type QueryLeadFreezeRequest } from "@/modules/api/graphql/queries/query-lead-freeze"
import type { LeadFreezeQuery } from "@/modules/api"

/** The SWR key of {@link useQueryLeadFreezeSwr}. */
export const QUERY_LEAD_FREEZE_SWR_KEY = "QUERY_LEAD_FREEZE_SWR"

/** The back end `leadFreeze` query. Pass `null` to wait for the arguments. */
export const useQueryLeadFreezeSwr = (
    request: QueryLeadFreezeRequest | null,
    config?: SWRConfiguration,
): ReadResponse<LeadFreezeQuery["leadFreeze"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_LEAD_FREEZE_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryLeadFreezeRequest>) =>
            answeredData(await queryLeadFreeze({ request: input }), QUERY_LEAD_FREEZE_SWR_KEY).leadFreeze,
        config,
    )
